//! High-level RDAP client with bootstrap, caching, and SSRF protection.
//!
//! # Feature flags
//!
//! | Feature        | Default | Description                              |
//! |----------------|---------|------------------------------------------|
//! | `memory-cache` | ✓       | In-memory response cache (DashMap)       |
//! | `stream`       | ✓       | Async streaming query API (tokio-stream) |

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;

use idna::domain_to_ascii;
use url::Url;

use rdap_bootstrap::Bootstrap;
use rdap_core::{Fetcher, FetcherConfig, Normalizer};
use rdap_rate_limit::{RateLimitConfig, RateLimitError, RdapRateLimiter};
use rdap_security::{SsrfConfig, SsrfGuard};
use rdap_types::error::{RdapError, Result};
use rdap_types::{
    AsnResponse, AvailabilityResult, DomainResponse, EntityResponse, IpResponse, NameserverResponse,
};

#[cfg(feature = "memory-cache")]
use rdap_cache::MemoryCache;

#[cfg(feature = "stream")]
use tokio::sync::mpsc;
#[cfg(feature = "stream")]
use tokio_stream::wrappers::ReceiverStream;

#[cfg(feature = "stream")]
pub use rdap_stream::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};

// ── Client configuration ──────────────────────────────────────────────────────

/// Configuration for [`RdapClient`].
#[derive(Debug, Clone)]
pub struct ClientConfig {
    /// HTTP fetcher settings (timeout, retries, user-agent, validation limits).
    pub fetcher: FetcherConfig,
    /// SSRF protection settings.
    pub ssrf: SsrfConfig,
    /// Whether to cache query responses in memory.
    ///
    /// Has no effect when the `memory-cache` feature is disabled.
    pub cache: bool,
    /// Bootstrap base URL (defaults to the official IANA endpoint).
    pub bootstrap_url: Option<String>,
    /// Custom RDAP server overrides per TLD.
    pub custom_bootstrap_servers: HashMap<String, String>,
    /// Reuse TCP connections across requests.
    pub reuse_connections: bool,
    /// Maximum number of idle keep-alive connections per host.
    pub max_connections_per_host: usize,
    /// Outbound rate-limit configuration.
    ///
    /// Set to `None` to disable rate limiting (not recommended in production).
    pub rate_limit: Option<RateLimitConfig>,
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
            rate_limit: Some(RateLimitConfig::default()),
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
    #[cfg(feature = "memory-cache")]
    cache: Option<MemoryCache>,
    /// Outbound rate limiter — applied after cache miss, before HTTP fetch.
    rate_limiter: Option<Arc<RdapRateLimiter>>,
}

impl RdapClient {
    /// Creates a client with the default configuration.
    pub fn new() -> Result<Self> {
        Self::with_config(ClientConfig::default())
    }

    /// Creates a client with custom configuration.
    pub fn with_config(config: ClientConfig) -> Result<Self> {
        let ssrf = SsrfGuard::with_config(config.ssrf);
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

        #[cfg(feature = "memory-cache")]
        let cache = if config.cache {
            Some(MemoryCache::new())
        } else {
            None
        };

        let rate_limiter = config
            .rate_limit
            .map(|cfg| Arc::new(RdapRateLimiter::new(cfg)));

        Ok(Self {
            fetcher,
            bootstrap,
            normalizer: Normalizer::new(),
            #[cfg(feature = "memory-cache")]
            cache,
            rate_limiter,
        })
    }

    // ── Query methods ─────────────────────────────────────────────────────────

    /// Queries RDAP information for a domain name.
    pub async fn domain(&self, domain: &str) -> Result<DomainResponse> {
        let domain = normalise_domain(domain)?;
        let server = self.bootstrap.for_domain(&domain).await?;
        let url = format!("{}/domain/{}", server.trim_end_matches('/'), domain);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.domain(&domain, raw, &server, cached)
    }

    /// Queries RDAP information for an IP address (IPv4 or IPv6).
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
    pub async fn nameserver(&self, hostname: &str) -> Result<NameserverResponse> {
        let hostname = normalise_domain(hostname)?;
        let server = self.bootstrap.for_domain(&hostname).await?;
        let url = format!("{}/nameserver/{}", server.trim_end_matches('/'), hostname);
        let (raw, cached) = self.fetch_with_cache(&url).await?;
        self.normalizer.nameserver(&hostname, raw, &server, cached)
    }

    /// Queries RDAP information for an entity (contact / registrar).
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

    /// Checks whether a domain is available for registration.
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

    // ── Streaming API (requires `stream` feature) ─────────────────────────────

    #[cfg(feature = "stream")]
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
                    break;
                }
            }
        });

        ReceiverStream::new(rx)
    }

    #[cfg(feature = "stream")]
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

    #[cfg(feature = "stream")]
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

    #[cfg(feature = "stream")]
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

    /// Clears the response cache and bootstrap cache.
    pub async fn clear_cache(&self) {
        #[cfg(feature = "memory-cache")]
        if let Some(cache) = &self.cache {
            cache.clear();
        }
        self.bootstrap.clear_cache().await;
    }

    /// Returns the number of entries in the response cache.
    ///
    /// Returns 0 when the `memory-cache` feature is disabled.
    pub fn cache_size(&self) -> usize {
        #[cfg(feature = "memory-cache")]
        {
            self.cache.as_ref().map(|c| c.len()).unwrap_or(0)
        }
        #[cfg(not(feature = "memory-cache"))]
        {
            0
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    async fn fetch_with_cache(&self, url: &str) -> Result<(serde_json::Value, bool)> {
        // ── Cache check (rate limiter NOT applied on cache hits) ──────────────
        #[cfg(feature = "memory-cache")]
        if let Some(cache) = &self.cache {
            if let Some(cached) = cache.get(url) {
                return Ok((cached, true));
            }
        }

        // ── Rate limit (cache miss only) ──────────────────────────────────────
        if let Some(limiter) = &self.rate_limiter {
            let host = extract_host(url)?;
            limiter.acquire(&host).await.map_err(|e| match e {
                RateLimitError::Limited(wait) => RdapError::RateLimited {
                    host,
                    wait_time: wait,
                },
            })?;
        }

        // ── Live fetch ────────────────────────────────────────────────────────
        let value = self.fetcher.fetch(url).await?;

        #[cfg(feature = "memory-cache")]
        if let Some(cache) = &self.cache {
            cache.set(url.to_string(), value.clone());
        }

        Ok((value, false))
    }
}

impl Default for RdapClient {
    fn default() -> Self {
        Self::new().expect("Default RdapClient construction failed")
    }
}

// ── Host extraction ───────────────────────────────────────────────────────────

/// Extracts the hostname from an RDAP server URL for rate-limit keying.
///
/// For example, `"https://rdap.verisign.com/com/v1/domain/example.com"` →
/// `"rdap.verisign.com"`.
fn extract_host(url: &str) -> Result<String> {
    Url::parse(url)
        .map_err(|e| RdapError::InvalidUrl {
            url: url.to_string(),
            source: e,
        })?
        .host_str()
        .map(String::from)
        .ok_or_else(|| RdapError::InvalidInput(format!("URL has no host: {url}")))
}

// ── Domain normalisation ──────────────────────────────────────────────────────

fn normalise_domain(domain: &str) -> Result<String> {
    let domain = domain.trim().trim_end_matches('.').to_lowercase();

    if domain.is_empty() {
        return Err(RdapError::InvalidInput(
            "Domain name must not be empty".to_string(),
        ));
    }

    if domain.is_ascii() {
        return Ok(domain);
    }

    domain_to_ascii(&domain).map_err(|_| {
        RdapError::InvalidInput(format!("Invalid internationalised domain name: {domain}"))
    })
}
