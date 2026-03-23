//! [`RdapClient`] — the main entry point for all RDAP queries.
//!
//! # Example
//! ```rust,no_run
//! use rdapify::RdapClient;
//!
//! #[tokio::main]
//! async fn main() -> rdapify::error::Result<()> {
//!     let client = RdapClient::new()?;
//!
//!     let domain = client.domain("example.com").await?;
//!     println!("Registrar: {:?}", domain.registrar);
//!
//!     let ip = client.ip("8.8.8.8").await?;
//!     println!("Country: {:?}", ip.country);
//!
//!     let asn = client.asn("AS15169").await?;
//!     println!("AS Name: {:?}", asn.name);
//!
//!     let ns = client.nameserver("ns1.google.com").await?;
//!     println!("IPv4: {:?}", ns.ip_addresses.v4);
//!
//!     let entity = client.entity("ARIN-HN-1", "https://rdap.arin.net/registry").await?;
//!     println!("Handle: {:?}", entity.handle);
//!
//!     Ok(())
//! }
//! ```

use std::collections::HashMap;
use std::net::IpAddr;

use idna::domain_to_ascii;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::bootstrap::Bootstrap;
use crate::cache::MemoryCache;
use crate::error::{RdapError, Result};
use crate::http::{Fetcher, FetcherConfig, Normalizer};
use crate::security::{SsrfConfig, SsrfGuard};
pub use crate::stream::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};
use crate::types::{
    AsnResponse, AvailabilityResult, DomainResponse, EntityResponse, IpResponse, NameserverResponse,
};

// ── Client configuration ──────────────────────────────────────────────────────

/// Configuration for [`RdapClient`].
///
/// Construct with [`ClientConfig::default()`] and customise as needed.
#[derive(Debug, Clone)]
pub struct ClientConfig {
    /// HTTP fetcher settings (timeout, retries, user-agent).
    pub fetcher: FetcherConfig,
    /// SSRF protection settings.
    pub ssrf: SsrfConfig,
    /// Whether to cache query responses in memory.
    pub cache: bool,
    /// Bootstrap base URL (defaults to the official IANA endpoint).
    pub bootstrap_url: Option<String>,
    /// Custom RDAP server overrides per TLD (e.g., `"com" → "https://my-rdap.example.com"`).
    /// These take priority over the IANA bootstrap lookup.
    pub custom_bootstrap_servers: HashMap<String, String>,
    /// Reuse TCP connections across requests (connection pooling).
    /// Delegates to `FetcherConfig.reuse_connections`. @default true
    pub reuse_connections: bool,
    /// Maximum number of idle keep-alive connections per host.
    /// Delegates to `FetcherConfig.max_connections_per_host`. @default 10
    pub max_connections_per_host: usize,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            fetcher: FetcherConfig::default(),
            ssrf: SsrfConfig::default(),
            cache: true,
            bootstrap_url: None,
            custom_bootstrap_servers: HashMap::new(),
            reuse_connections: true,
            max_connections_per_host: 10,
        }
    }
}

// ── Client ────────────────────────────────────────────────────────────────────

/// The main RDAP client.
///
/// Cheap to clone — all inner state is behind `Arc`s.
#[derive(Clone, Debug)]
pub struct RdapClient {
    fetcher: Fetcher,
    bootstrap: Bootstrap,
    normalizer: Normalizer,
    cache: Option<MemoryCache>,
}

impl RdapClient {
    /// Creates a client with the default configuration.
    pub fn new() -> Result<Self> {
        Self::with_config(ClientConfig::default())
    }

    /// Creates a client with custom configuration.
    pub fn with_config(config: ClientConfig) -> Result<Self> {
        let ssrf = SsrfGuard::with_config(config.ssrf);
        // Merge top-level connection pool settings into fetcher config
        let mut fetcher_config = config.fetcher;
        fetcher_config.reuse_connections = config.reuse_connections;
        fetcher_config.max_connections_per_host = config.max_connections_per_host;
        let fetcher = Fetcher::with_config(ssrf, fetcher_config)?;
        let reqwest_client = fetcher.reqwest_client();

        let mut bootstrap = match config.bootstrap_url {
            Some(url) => Bootstrap::with_base_url(url, reqwest_client),
            None => Bootstrap::new(reqwest_client),
        };

        if !config.custom_bootstrap_servers.is_empty() {
            bootstrap.set_custom_servers(config.custom_bootstrap_servers);
        }

        let cache = if config.cache {
            Some(MemoryCache::new())
        } else {
            None
        };

        Ok(Self {
            fetcher,
            bootstrap,
            normalizer: Normalizer::new(),
            cache,
        })
    }

    // ── Query methods ─────────────────────────────────────────────────────────

    /// Queries RDAP information for a domain name.
    ///
    /// Accepts both ASCII and Unicode (IDN) domain names.
    ///
    /// # Errors
    /// - [`RdapError::InvalidInput`] — invalid domain name
    /// - [`RdapError::NoServerFound`] — no RDAP server for the TLD
    /// - [`RdapError::Network`] — network-level failure
    pub async fn domain(&self, domain: &str) -> Result<DomainResponse> {
        let domain = normalise_domain(domain)?;
        let server = self.bootstrap.for_domain(&domain).await?;
        let url = format!("{}/domain/{}", server.trim_end_matches('/'), domain);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.domain(&domain, raw, &server, cached)
    }

    /// Queries RDAP information for an IP address (IPv4 or IPv6).
    ///
    /// # Errors
    /// - [`RdapError::InvalidInput`] — not a valid IP address
    /// - [`RdapError::SsrfBlocked`] — private/reserved IP address
    /// - [`RdapError::NoServerFound`] — no RDAP server for the IP range
    pub async fn ip(&self, ip: &str) -> Result<IpResponse> {
        let addr: IpAddr = ip
            .parse()
            .map_err(|_| RdapError::InvalidInput(format!("Invalid IP address: {ip}")))?;

        let server = match addr {
            IpAddr::V4(_) => self.bootstrap.for_ipv4(ip).await?,
            IpAddr::V6(_) => self.bootstrap.for_ipv6(ip).await?,
        };

        let url = format!("{}/ip/{}", server.trim_end_matches('/'), ip);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.ip(ip, raw, &server, cached)
    }

    /// Queries RDAP information for an Autonomous System Number.
    ///
    /// Accepts both numeric (`15169`) and prefixed (`"AS15169"`) forms.
    ///
    /// # Errors
    /// - [`RdapError::InvalidInput`] — not a valid ASN
    /// - [`RdapError::NoServerFound`] — no RDAP server for the ASN range
    pub async fn asn(&self, asn: impl AsRef<str>) -> Result<AsnResponse> {
        let asn_str = asn
            .as_ref()
            .trim_start_matches("AS")
            .trim_start_matches("as");
        let asn_num: u32 = asn_str
            .parse()
            .map_err(|_| RdapError::InvalidInput(format!("Invalid ASN: {}", asn.as_ref())))?;

        let server = self.bootstrap.for_asn(asn_num).await?;
        let url = format!("{}/autnum/{}", server.trim_end_matches('/'), asn_num);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.asn(asn_num, raw, &server, cached)
    }

    /// Queries RDAP information for a nameserver.
    ///
    /// # Errors
    /// - [`RdapError::InvalidInput`] — invalid hostname
    /// - [`RdapError::NoServerFound`] — no RDAP server for the nameserver's TLD
    pub async fn nameserver(&self, hostname: &str) -> Result<NameserverResponse> {
        let hostname = normalise_domain(hostname)?;
        let server = self.bootstrap.for_domain(&hostname).await?;
        let url = format!("{}/nameserver/{}", server.trim_end_matches('/'), hostname);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.nameserver(&hostname, raw, &server, cached)
    }

    /// Queries RDAP information for an entity (contact / registrar).
    ///
    /// Entities have no global bootstrap registry, so the caller must supply
    /// an explicit RDAP server URL.
    ///
    /// # Arguments
    /// - `handle`     — entity handle (e.g., `"ARIN-HN-1"`)
    /// - `server_url` — base URL of the RDAP server (e.g., `"https://rdap.arin.net/registry"`)
    ///
    /// # Errors
    /// - [`RdapError::InvalidInput`] — handle or server URL is empty
    /// - [`RdapError::SsrfBlocked`] — server URL targets a private address
    pub async fn entity(&self, handle: &str, server_url: &str) -> Result<EntityResponse> {
        if handle.is_empty() {
            return Err(RdapError::InvalidInput(
                "Entity handle must not be empty".to_string(),
            ));
        }
        if server_url.is_empty() {
            return Err(RdapError::InvalidInput(
                "Server URL must not be empty".to_string(),
            ));
        }

        let url = format!("{}/entity/{}", server_url.trim_end_matches('/'), handle);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.entity(handle, raw, server_url, cached)
    }

    /// Checks whether a domain is available for registration by analysing the
    /// RDAP response. Does not use WHOIS.
    ///
    /// - Returns `available: true` when the registry returns HTTP 404.
    /// - Returns `available: false` with `expires_at` (if present) for registered domains.
    ///
    /// # Errors
    /// Propagates any error other than HTTP 404 (e.g., network failures,
    /// no RDAP server found for the TLD, invalid input).
    ///
    /// # Example
    /// ```rust,no_run
    /// # use rdapify::RdapClient;
    /// # #[tokio::main] async fn main() -> rdapify::error::Result<()> {
    /// let client = RdapClient::new()?;
    /// let res = client.domain_available("example.com").await?;
    /// println!("Available: {}", res.available);
    /// # Ok(()) }
    /// ```
    pub async fn domain_available(&self, name: &str) -> Result<AvailabilityResult> {
        let domain_name = normalise_domain(name)?;
        match self.domain(name).await {
            Ok(response) => Ok(AvailabilityResult {
                domain: domain_name,
                available: false,
                expires_at: response.expiration_date().map(|s| s.to_string()),
            }),
            Err(RdapError::HttpStatus { status: 404, .. }) => Ok(AvailabilityResult {
                domain: domain_name,
                available: true,
                expires_at: None,
            }),
            Err(e) => Err(e),
        }
    }

    /// Checks availability for multiple domains concurrently.
    ///
    /// Runs up to `concurrency` queries in parallel (default: 10).
    /// Each result is independent — a failure for one domain does not affect
    /// the others. Failed lookups return an `Err` entry in the output vector.
    ///
    /// # Example
    /// ```rust,no_run
    /// # use rdapify::RdapClient;
    /// # #[tokio::main] async fn main() -> rdapify::error::Result<()> {
    /// let client = RdapClient::new()?;
    /// let results = client
    ///     .domain_available_batch(
    ///         vec!["example.com".to_string(), "test.org".to_string()],
    ///         None,
    ///     )
    ///     .await;
    /// for res in results {
    ///     match res {
    ///         Ok(a)  => println!("{}: available={}", a.domain, a.available),
    ///         Err(e) => println!("error: {e}"),
    ///     }
    /// }
    /// # Ok(()) }
    /// ```
    pub async fn domain_available_batch(
        &self,
        names: Vec<String>,
        concurrency: Option<usize>,
    ) -> Vec<Result<AvailabilityResult>> {
        let limit = concurrency.unwrap_or(10).max(1);
        let mut output: Vec<Option<Result<AvailabilityResult>>> =
            (0..names.len()).map(|_| None).collect();

        for (chunk_start, chunk) in names.chunks(limit).enumerate() {
            let base = chunk_start * limit;
            let mut set = tokio::task::JoinSet::new();

            for (i, name) in chunk.iter().enumerate() {
                let client = self.clone();
                let name = name.clone();
                let idx = base + i;
                set.spawn(async move { (idx, client.domain_available(&name).await) });
            }

            while let Some(res) = set.join_next().await {
                if let Ok((idx, result)) = res {
                    output[idx] = Some(result);
                }
            }
        }

        output.into_iter().flatten().collect()
    }

    // ── Streaming API ─────────────────────────────────────────────────────────

    /// Streams RDAP domain results for multiple queries, yielding each result
    /// as it completes.
    ///
    /// # Back-pressure
    /// Results are buffered in a channel of `config.buffer_size` items.  If
    /// the consumer falls behind, the producer blocks until there is space.
    ///
    /// # Cancellation
    /// Drop the returned stream to stop all in-flight work (the background
    /// task detects the closed receiver and exits cleanly).
    ///
    /// # Example
    /// ```rust,no_run
    /// # use rdapify::{RdapClient, stream::{DomainEvent, StreamConfig}};
    /// # use tokio_stream::StreamExt;
    /// # #[tokio::main] async fn main() -> rdapify::error::Result<()> {
    /// let client = RdapClient::new()?;
    /// let names = vec!["example.com".to_string(), "google.com".to_string()];
    /// let mut stream = client.stream_domain(names, StreamConfig::default());
    /// while let Some(event) = stream.next().await {
    ///     match event {
    ///         DomainEvent::Result(r)           => println!("Got: {:?}", r.as_ref().query),
    ///         DomainEvent::Error { query, .. } => println!("Error for {query}"),
    ///     }
    /// }
    /// # Ok(()) }
    /// ```
    pub fn stream_domain(
        &self,
        names: Vec<String>,
        config: StreamConfig,
    ) -> ReceiverStream<DomainEvent> {
        let (tx, rx) = mpsc::channel(config.buffer_size);
        let client = self.clone();

        tokio::spawn(async move {
            for name in names {
                let event = match client.domain(&name).await {
                    Ok(r) => DomainEvent::Result(Box::new(r)),
                    Err(e) => DomainEvent::Error {
                        query: name,
                        error: e,
                    },
                };
                if tx.send(event).await.is_err() {
                    // Receiver was dropped — cancel gracefully.
                    break;
                }
            }
        });

        ReceiverStream::new(rx)
    }

    /// Streams RDAP IP results for multiple queries.
    ///
    /// See [`stream_domain`](RdapClient::stream_domain) for details on
    /// back-pressure and cancellation semantics.
    pub fn stream_ip(
        &self,
        addresses: Vec<String>,
        config: StreamConfig,
    ) -> ReceiverStream<IpEvent> {
        let (tx, rx) = mpsc::channel(config.buffer_size);
        let client = self.clone();

        tokio::spawn(async move {
            for addr in addresses {
                let event = match client.ip(&addr).await {
                    Ok(r) => IpEvent::Result(Box::new(r)),
                    Err(e) => IpEvent::Error {
                        query: addr,
                        error: e,
                    },
                };
                if tx.send(event).await.is_err() {
                    break;
                }
            }
        });

        ReceiverStream::new(rx)
    }

    /// Streams RDAP ASN results for multiple queries.
    ///
    /// See [`stream_domain`](RdapClient::stream_domain) for details on
    /// back-pressure and cancellation semantics.
    pub fn stream_asn(&self, asns: Vec<String>, config: StreamConfig) -> ReceiverStream<AsnEvent> {
        let (tx, rx) = mpsc::channel(config.buffer_size);
        let client = self.clone();

        tokio::spawn(async move {
            for asn in asns {
                let event = match client.asn(&asn).await {
                    Ok(r) => AsnEvent::Result(Box::new(r)),
                    Err(e) => AsnEvent::Error {
                        query: asn,
                        error: e,
                    },
                };
                if tx.send(event).await.is_err() {
                    break;
                }
            }
        });

        ReceiverStream::new(rx)
    }

    /// Streams RDAP nameserver results for multiple queries.
    ///
    /// See [`stream_domain`](RdapClient::stream_domain) for details on
    /// back-pressure and cancellation semantics.
    pub fn stream_nameserver(
        &self,
        nameservers: Vec<String>,
        config: StreamConfig,
    ) -> ReceiverStream<NameserverEvent> {
        let (tx, rx) = mpsc::channel(config.buffer_size);
        let client = self.clone();

        tokio::spawn(async move {
            for ns in nameservers {
                let event = match client.nameserver(&ns).await {
                    Ok(r) => NameserverEvent::Result(Box::new(r)),
                    Err(e) => NameserverEvent::Error {
                        query: ns,
                        error: e,
                    },
                };
                if tx.send(event).await.is_err() {
                    break;
                }
            }
        });

        ReceiverStream::new(rx)
    }

    // ── Cache management ──────────────────────────────────────────────────────

    /// Clears the response cache and the bootstrap cache.
    pub async fn clear_cache(&self) {
        if let Some(cache) = &self.cache {
            cache.clear();
        }
        self.bootstrap.clear_cache().await;
    }

    /// Returns the current number of cached responses.
    pub fn cache_size(&self) -> usize {
        self.cache.as_ref().map(|c| c.len()).unwrap_or(0)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// Returns `(value, was_cached)`.
    async fn fetch_with_cache(&self, url: &str) -> Result<(serde_json::Value, bool)> {
        if let Some(cache) = &self.cache {
            if let Some(cached) = cache.get(url) {
                return Ok((cached, true));
            }
        }

        let value = self.fetcher.fetch(url).await?;

        if let Some(cache) = &self.cache {
            cache.set(url.to_string(), value.clone());
        }

        Ok((value, false))
    }
}

// ── Domain normalisation ──────────────────────────────────────────────────────

/// Converts a domain name to its ACE (ASCII-Compatible Encoding) form.
/// Plain ASCII domains are returned unchanged (lowercased).
fn normalise_domain(domain: &str) -> Result<String> {
    let domain = domain.trim().trim_end_matches('.').to_lowercase();

    if domain.is_empty() {
        return Err(RdapError::InvalidInput(
            "Domain name must not be empty".to_string(),
        ));
    }

    // If already ASCII, skip idna processing.
    if domain.is_ascii() {
        return Ok(domain);
    }

    // Convert Unicode domain to ACE (Punycode).
    domain_to_ascii(&domain).map_err(|_| {
        RdapError::InvalidInput(format!("Invalid internationalised domain name: {domain}"))
    })
}

// ── Convenience constructors ──────────────────────────────────────────────────

impl Default for RdapClient {
    fn default() -> Self {
        Self::new().expect("Default RdapClient construction failed")
    }
}
