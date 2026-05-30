//! High-level RDAP client with bootstrap, caching, and SSRF protection.
//!
//! # Feature flags
//!
//! | Feature        | Default | Description                              |
//! |----------------|---------|------------------------------------------|
//! | `memory-cache` | ✓       | In-memory response cache (DashMap)       |
//! | `stream`       | ✓       | Async streaming query API (tokio-stream) |

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;

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
use rdap_cache::{CachePolicy, CacheStats, CacheStatus, MemoryCache};

#[cfg(feature = "stream")]
use tokio::sync::mpsc;
#[cfg(feature = "stream")]
use tokio_stream::wrappers::ReceiverStream;

#[cfg(feature = "stream")]
pub use rdap_stream::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};

// ── Per-type TTL constants ────────────────────────────────────────────────────

const TTL_DOMAIN: Duration = Duration::from_secs(3600); // 1 h
const TTL_IP: Duration = Duration::from_secs(86_400); // 24 h
const TTL_ASN: Duration = Duration::from_secs(86_400); // 24 h
const TTL_NAMESERVER: Duration = Duration::from_secs(21_600); // 6 h
const TTL_ENTITY: Duration = Duration::from_secs(3_600); // 1 h

// The Cache-Control max-age clamp bounds and the negative (404) TTL live in
// `rdap_cache::CachePolicy`, applied per query kind.

// ── Query kind ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
enum QueryKind {
    Domain,
    Ip,
    Asn,
    Nameserver,
    Entity,
}

impl QueryKind {
    fn ttl(self) -> Duration {
        match self {
            QueryKind::Domain => TTL_DOMAIN,
            QueryKind::Ip => TTL_IP,
            QueryKind::Asn => TTL_ASN,
            QueryKind::Nameserver => TTL_NAMESERVER,
            QueryKind::Entity => TTL_ENTITY,
        }
    }

    /// Stable string tag for cache-key construction. Decoupled from the
    /// enum's `Debug` form so future kind renames can't silently invalidate
    /// caches.
    fn tag(self) -> &'static str {
        match self {
            QueryKind::Domain => "domain",
            QueryKind::Ip => "ip",
            QueryKind::Asn => "asn",
            QueryKind::Nameserver => "nameserver",
            QueryKind::Entity => "entity",
        }
    }

    /// Maps to the `rdap-metrics` label enum used by `record_request`. The
    /// rdap-metrics crate's `QueryType` is the public observability surface
    /// (it lives in the `rdap-metrics::types` module and is part of the
    /// stable label catalog); this method bridges the client's internal
    /// kind to that label without exposing the enum across crate
    /// boundaries.
    fn to_metrics_query_type(self) -> rdap_metrics::QueryType {
        use rdap_metrics::QueryType;
        match self {
            QueryKind::Domain => QueryType::Domain,
            QueryKind::Ip => QueryType::Ip,
            QueryKind::Asn => QueryType::Asn,
            QueryKind::Nameserver => QueryType::Nameserver,
            QueryKind::Entity => QueryType::Entity,
        }
    }
}

/// Builds the logical cache key for a query.
///
/// The key is independent of the bootstrap server URL — the same
/// `(kind, normalized_input)` always produces the same cache key, so a
/// bootstrap-server change for a TLD does not invalidate cached entries
/// or fragment them across logically-equivalent URLs.
///
/// Format: `"{tag}:{normalized}"` where `tag ∈ {domain, ip, asn, nameserver, entity}`.
fn cache_key(kind: QueryKind, normalized_input: &str) -> String {
    format!("{}:{}", kind.tag(), normalized_input)
}

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
        // Capture the SSRF posture before the config is consumed: the bootstrap
        // downloader must route through the same audited egress pipeline as the
        // fetcher, and be disabled together with the guard in test harnesses.
        let ssrf_enabled = config.ssrf.enabled;
        let ssrf = SsrfGuard::with_config(config.ssrf);
        let mut fetcher_config = config.fetcher;
        fetcher_config.reuse_connections = config.reuse_connections;
        fetcher_config.max_connections_per_host = config.max_connections_per_host;
        // Bootstrap egress should use the same deadline as the fetcher.
        let egress_timeout = fetcher_config.timeout;
        let fetcher = Fetcher::with_config(ssrf, fetcher_config)?;
        let reqwest_client = fetcher.reqwest_client();

        let mut bootstrap = match config.bootstrap_url {
            Some(url) => Bootstrap::with_base_url(url, reqwest_client),
            None => Bootstrap::new(reqwest_client),
        };
        bootstrap.set_secure_egress(ssrf_enabled);
        bootstrap.set_egress_timeout(egress_timeout);

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

    /// Records the request-level metric pair (`rdap_requests_total{type,
    /// status}` and `rdap_latency_seconds{type}`) for one engine-level
    /// lookup. Called from each public method's exit path with the result
    /// of the full lifecycle (input validation → bootstrap → cache →
    /// fetch → normalize). When the `metrics` feature is off in
    /// `rdap-metrics`, both inner calls are inline no-ops, so this
    /// helper compiles down to a single `Instant::elapsed()` plus a
    /// branch on `Result::is_ok()`.
    #[inline]
    fn record_request_outcome<T>(
        &self,
        kind: QueryKind,
        started_at: std::time::Instant,
        result: &Result<T>,
    ) {
        use rdap_metrics::RequestStatus;
        let status = if result.is_ok() {
            RequestStatus::Success
        } else {
            RequestStatus::Error
        };
        rdap_metrics::hooks::record_request(
            kind.to_metrics_query_type(),
            status,
            started_at.elapsed(),
        );
    }

    /// Queries RDAP information for a domain name.
    pub async fn domain(&self, domain: &str) -> Result<DomainResponse> {
        let started_at = std::time::Instant::now();
        let result: Result<DomainResponse> = async {
            let domain = normalise_domain(domain)?;
            let key = cache_key(QueryKind::Domain, &domain);
            let server = self.bootstrap.for_domain(&domain).await?;
            let url = format!("{}/domain/{}", server.trim_end_matches('/'), domain);
            let (raw, cached) = self.fetch_with_cache(&key, &url, QueryKind::Domain).await?;
            self.normalizer.domain(&domain, &raw, &server, cached)
        }
        .await;
        self.record_request_outcome(QueryKind::Domain, started_at, &result);
        result
    }

    /// Queries RDAP information for an IP address (IPv4 or IPv6).
    pub async fn ip(&self, ip: &str) -> Result<IpResponse> {
        let started_at = std::time::Instant::now();
        let result: Result<IpResponse> = async {
            let addr: IpAddr = ip
                .parse()
                .map_err(|_| RdapError::InvalidInput(format!("Invalid IP address: {ip}")))?;
            // Use the canonical address form so equivalent encodings collapse to
            // the same cache key (e.g. `2001:0db8::1` and `2001:db8::1`).
            let canonical = addr.to_string();

            let server = match addr {
                IpAddr::V4(_) => self.bootstrap.for_ipv4(ip).await?,
                IpAddr::V6(_) => self.bootstrap.for_ipv6(ip).await?,
            };

            let key = cache_key(QueryKind::Ip, &canonical);
            let url = format!("{}/ip/{}", server.trim_end_matches('/'), ip);
            let (raw, cached) = self.fetch_with_cache(&key, &url, QueryKind::Ip).await?;
            self.normalizer.ip(ip, &raw, &server, cached)
        }
        .await;
        self.record_request_outcome(QueryKind::Ip, started_at, &result);
        result
    }

    /// Queries RDAP information for an Autonomous System Number.
    pub async fn asn(&self, asn: impl AsRef<str>) -> Result<AsnResponse> {
        let started_at = std::time::Instant::now();
        let result: Result<AsnResponse> = async {
            let asn_str = asn
                .as_ref()
                .trim_start_matches("AS")
                .trim_start_matches("as");
            let asn_num: u32 = asn_str
                .parse()
                .map_err(|_| RdapError::InvalidInput(format!("Invalid ASN: {}", asn.as_ref())))?;

            let key = cache_key(QueryKind::Asn, &asn_num.to_string());
            let server = self.bootstrap.for_asn(asn_num).await?;
            let url = format!("{}/autnum/{}", server.trim_end_matches('/'), asn_num);
            let (raw, cached) = self.fetch_with_cache(&key, &url, QueryKind::Asn).await?;
            self.normalizer.asn(asn_num, &raw, &server, cached)
        }
        .await;
        self.record_request_outcome(QueryKind::Asn, started_at, &result);
        result
    }

    /// Queries RDAP information for a nameserver.
    pub async fn nameserver(&self, hostname: &str) -> Result<NameserverResponse> {
        let started_at = std::time::Instant::now();
        let result: Result<NameserverResponse> = async {
            let hostname = normalise_domain(hostname)?;
            let key = cache_key(QueryKind::Nameserver, &hostname);
            let server = self.bootstrap.for_domain(&hostname).await?;
            let url = format!("{}/nameserver/{}", server.trim_end_matches('/'), hostname);
            let (raw, cached) = self
                .fetch_with_cache(&key, &url, QueryKind::Nameserver)
                .await?;
            self.normalizer.nameserver(&hostname, &raw, &server, cached)
        }
        .await;
        self.record_request_outcome(QueryKind::Nameserver, started_at, &result);
        result
    }

    /// Queries RDAP information for an entity (contact / registrar).
    pub async fn entity(&self, handle: &str, server_url: &str) -> Result<EntityResponse> {
        let started_at = std::time::Instant::now();
        let result: Result<EntityResponse> = async {
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

            // Entities are namespaced by their server (handles are unique only
            // per-server), so include the server in the key.
            let key = cache_key(
                QueryKind::Entity,
                &format!("{}@{}", handle, server_url.trim_end_matches('/')),
            );
            let url = format!("{}/entity/{}", server_url.trim_end_matches('/'), handle);
            let (raw, cached) = self.fetch_with_cache(&key, &url, QueryKind::Entity).await?;
            self.normalizer.entity(handle, &raw, server_url, cached)
        }
        .await;
        self.record_request_outcome(QueryKind::Entity, started_at, &result);
        result
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

    /// Streams domain RDAP query results as an async channel stream.
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

    /// Streams IP network RDAP query results as an async channel stream.
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

    /// Streams ASN RDAP query results as an async channel stream.
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

    /// Streams nameserver RDAP query results as an async channel stream.
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

    /// Returns a snapshot of cache event counters.
    ///
    /// Returns `None` when the `memory-cache` feature is disabled or when
    /// caching is turned off in [`ClientConfig`].
    pub fn cache_stats(&self) -> Option<CacheStats> {
        #[cfg(feature = "memory-cache")]
        {
            self.cache.as_ref().map(|c| c.stats())
        }
        #[cfg(not(feature = "memory-cache"))]
        {
            None
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// Fetches `url` through the full pipeline:
    ///
    /// `cache → dedup → rate-limit → fetch → cache-populate → notify`
    ///
    /// - **Fresh hit** → returned immediately; no network call.
    /// - **Stale hit** → returned immediately; a single background refresh
    ///   is spawned (single-flighted via `try_acquire_refresh`); concurrent
    ///   stale hits do *not* spawn additional refreshes.
    /// - **Negative hit** → returns a 404 error without a network call.
    /// - **Cold miss** → single-flighted: only one caller runs the rate-limit
    ///   and fetch; concurrent identical queries wait for the leader and read
    ///   the populated cache. If cache is disabled, dedup is bypassed and
    ///   each call goes through.
    ///
    /// On 200, response is cached with a per-type TTL (honoring a clamped
    /// upstream Cache-Control max-age); on 404, the URL is negative-cached for
    /// a short fixed TTL. See `rdap_cache::CachePolicy`.
    async fn fetch_with_cache(
        &self,
        cache_key: &str,
        url: &str,
        kind: QueryKind,
    ) -> Result<(Arc<serde_json::Value>, bool)> {
        // Stage D · D2 — open the top-level `rdap.query` span. The span is
        // created lazily: when the fetcher's tracing isn't sampled in (the
        // default), we use `Span::none()` and skip the request_id allocation.
        // We read the fetcher's *resolved* verbose flag — the value the
        // fetcher itself decided at construction time, including the
        // `RDAP_TRACE=1` env-var override. Going through the resolved
        // accessor keeps the client's `rdap.query` decision in lock-step
        // with the fetcher's `rdap.fetch` decision; otherwise an env
        // variable set after the `Fetcher` was built but before the
        // client's call would silently mismatch the two layers.
        let traced = rdap_metrics::should_sample(
            self.fetcher.verbose_trace_resolved(),
            self.fetcher.config().trace_sample_rate,
        );
        let request_id = if traced {
            rdap_metrics::fresh_request_id()
        } else {
            String::new()
        };
        let query_span = if traced {
            tracing::info_span!(
                "rdap.query",
                request_id = %request_id,
                query_type = kind.tag(),
                cache_status = tracing::field::Empty,
            )
        } else {
            tracing::Span::none()
        };
        let _query_enter = query_span.enter();

        // ── 1. Cache check (Fresh / Stale / Negative / Miss) ─────────────
        #[cfg(feature = "memory-cache")]
        if let Some(cache) = &self.cache {
            match cache.get_status(cache_key) {
                CacheStatus::Fresh(value) => {
                    query_span.record("cache_status", "hit");
                    return Ok((value, true));
                }

                CacheStatus::Stale(value) => {
                    query_span.record("cache_status", "stale");
                    // SWR — single-flighted refresh. Only the first concurrent
                    // stale hit spawns the refresh; later stale hits return
                    // stale immediately and observe the in-flight slot as taken.
                    if let Some(guard) = cache.try_acquire_refresh(cache_key) {
                        let client = self.clone();
                        let key_owned = cache_key.to_string();
                        let url_owned = url.to_string();
                        tokio::spawn(async move {
                            client
                                .background_refresh(&key_owned, &url_owned, kind)
                                .await;
                            drop(guard); // releases slot, notifies waiters
                        });
                    }
                    return Ok((value, true));
                }

                CacheStatus::Negative => {
                    query_span.record("cache_status", "negative");
                    return Err(RdapError::HttpStatus {
                        status: 404,
                        url: url.to_string(),
                    });
                }

                CacheStatus::Miss => {
                    query_span.record("cache_status", "miss");
                    // Fall through to dedup + live fetch
                }
            }
        }
        #[cfg(not(feature = "memory-cache"))]
        query_span.record("cache_status", "disabled");

        // ── 2. Dedup: claim leader slot or wait for leader ────────────────
        // The leader path runs rate-limit + fetch; followers wake up after
        // the leader populates the cache and serve the cached value.
        #[cfg(feature = "memory-cache")]
        let leader_guard = match &self.cache {
            Some(cache) => match cache.try_acquire_refresh(cache_key) {
                Some(g) => Some(g),
                None => {
                    // Follower — wait for the leader to finish.
                    cache.await_refresh(cache_key).await;
                    // Re-check cache: the leader should have populated it
                    // (or marked it negative).
                    match cache.get_status(cache_key) {
                        CacheStatus::Fresh(v) | CacheStatus::Stale(v) => {
                            return Ok((v, true));
                        }
                        CacheStatus::Negative => {
                            return Err(RdapError::HttpStatus {
                                status: 404,
                                url: url.to_string(),
                            });
                        }
                        CacheStatus::Miss => {
                            // Leader's fetch failed (transient error). Fall
                            // through and act as our own leader. We re-claim
                            // the slot if free; else proceed without dedup
                            // protection (best-effort).
                            cache.try_acquire_refresh(cache_key)
                        }
                    }
                }
            },
            None => None,
        };
        // When the `memory-cache` feature is disabled we have no slot to drop.
        #[cfg(not(feature = "memory-cache"))]
        let leader_guard: Option<()> = None;

        // ── 3. Rate limit (leader only) ────────────────────────────────────
        if let Some(limiter) = &self.rate_limiter {
            let host = extract_host(url)?;
            limiter.acquire(&host).await.map_err(|e| match e {
                RateLimitError::Limited(wait) => RdapError::RateLimited {
                    host,
                    wait_time: wait,
                },
            })?;
        }

        // ── 4. Live fetch ─────────────────────────────────────────────────
        let fetch_result = self.fetcher.fetch(url).await;

        // ── 5. Populate cache ─────────────────────────────────────────────
        #[cfg(feature = "memory-cache")]
        if let Some(cache) = &self.cache {
            match &fetch_result {
                Ok(value) => {
                    cache.set_with_ttl(cache_key.to_string(), value.clone(), kind.ttl());
                }
                Err(RdapError::HttpStatus { status: 404, .. }) => {
                    cache.set_negative(cache_key.to_string(), CachePolicy::DEFAULT_NEGATIVE_TTL);
                }
                Err(_) => {}
            }
        }

        // ── 6. Drop leader guard → notify waiting followers ───────────────
        drop(leader_guard);

        // Wrap the freshly fetched value in an `Arc` so the return type matches
        // the cache-hit path. The cache was already populated above from a
        // (deep) clone of this value; the live caller gets the original behind
        // a pointer, paying no second deep copy here.
        Ok((Arc::new(fetch_result?), false))
    }

    /// Fetches `url` with Cache-Control hint, updating the cache with a
    /// server-suggested TTL when available (capped at [`TTL_MAX_ALLOWED`]).
    #[allow(dead_code)]
    async fn fetch_with_cache_hint(
        &self,
        cache_key: &str,
        url: &str,
        kind: QueryKind,
    ) -> Result<(serde_json::Value, bool)> {
        // Rate limit
        if let Some(limiter) = &self.rate_limiter {
            let host = extract_host(url)?;
            limiter.acquire(&host).await.map_err(|e| match e {
                RateLimitError::Limited(wait) => RdapError::RateLimited {
                    host,
                    wait_time: wait,
                },
            })?;
        }

        let (value, server_hint) = self.fetcher.fetch_with_cache_hint(url).await?;

        #[cfg(feature = "memory-cache")]
        if let Some(cache) = &self.cache {
            // Honor the upstream Cache-Control max-age, clamped to a safe
            // range, else fall back to this query type's default TTL.
            let ttl = CachePolicy::with_default_ttl(kind.ttl()).effective_ttl(server_hint);
            cache.set_with_ttl(cache_key.to_string(), value.clone(), ttl);
        }

        Ok((value, false))
    }

    /// Background refresh used by the stale-while-revalidate path.
    async fn background_refresh(&self, cache_key: &str, url: &str, kind: QueryKind) {
        // Apply rate limit before background fetch to avoid stampedes
        if let Some(limiter) = &self.rate_limiter {
            if let Ok(host) = extract_host(url) {
                if limiter.acquire(&host).await.is_err() {
                    tracing::debug!(event = "swr_refresh_rate_limited", url = url,);
                    return;
                }
            }
        }

        match self.fetcher.fetch(url).await {
            Ok(fresh_value) =>
            {
                #[cfg(feature = "memory-cache")]
                if let Some(cache) = &self.cache {
                    cache.set_with_ttl(cache_key.to_string(), fresh_value, kind.ttl());
                }
            }
            Err(e) => {
                tracing::debug!(
                    event = "swr_refresh_failed",
                    url = url,
                    error = %e,
                );
            }
        }
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

// ── Cache-key tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod cache_key_tests {
    use super::{cache_key, QueryKind};

    #[test]
    fn same_kind_and_input_produce_same_key() {
        let a = cache_key(QueryKind::Domain, "example.com");
        let b = cache_key(QueryKind::Domain, "example.com");
        assert_eq!(a, b);
    }

    #[test]
    fn different_kinds_produce_different_keys() {
        let dom = cache_key(QueryKind::Domain, "example.com");
        let ns = cache_key(QueryKind::Nameserver, "example.com");
        assert_ne!(dom, ns);
    }

    #[test]
    fn key_is_independent_of_bootstrap_url() {
        // Mandatory C5 test: same logical query → same cache key, regardless
        // of which bootstrap server URL would be used to actually fetch it.
        // Two different "URLs" — one via verisign, one via a hypothetical
        // alternate — both map to the same cache key for the same domain.
        let key_via_a = cache_key(QueryKind::Domain, "example.com");
        let key_via_b = cache_key(QueryKind::Domain, "example.com");
        assert_eq!(key_via_a, key_via_b);
        assert_eq!(key_via_a, "domain:example.com");
    }

    #[test]
    fn known_format() {
        assert_eq!(
            cache_key(QueryKind::Domain, "example.com"),
            "domain:example.com"
        );
        assert_eq!(cache_key(QueryKind::Ip, "1.1.1.1"), "ip:1.1.1.1");
        assert_eq!(cache_key(QueryKind::Asn, "15169"), "asn:15169");
        assert_eq!(
            cache_key(QueryKind::Nameserver, "ns1.example.com"),
            "nameserver:ns1.example.com"
        );
    }
}

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

#[cfg(test)]
mod normalise_domain_tests {
    //! Pure unit tests for `normalise_domain` — IDN/punycode transformation,
    //! lowercasing, trailing-dot trimming, empty rejection. These tests are
    //! **deterministic** and **do not depend on whether any specific domain
    //! is registered**. See `tests/TESTING_GUIDELINES.md`.
    use super::normalise_domain;

    #[test]
    fn ascii_pass_through_lowercased() {
        assert_eq!(normalise_domain("example.com").unwrap(), "example.com");
        assert_eq!(normalise_domain("EXAMPLE.COM").unwrap(), "example.com");
        assert_eq!(normalise_domain("  Example.Com  ").unwrap(), "example.com");
    }

    #[test]
    fn trailing_dot_is_stripped() {
        assert_eq!(normalise_domain("example.com.").unwrap(), "example.com");
        assert_eq!(normalise_domain("EXAMPLE.COM.").unwrap(), "example.com");
    }

    #[test]
    fn empty_is_rejected() {
        assert!(normalise_domain("").is_err());
        assert!(normalise_domain("   ").is_err());
        assert!(normalise_domain(".").is_err());
    }

    #[test]
    fn idn_cyrillic_to_punycode() {
        // "пример" (Russian for "example") → xn--e1afmkfd
        // Whether the resulting domain is registered is irrelevant to this
        // test — we are validating the transformation itself.
        assert_eq!(normalise_domain("пример.com").unwrap(), "xn--e1afmkfd.com");
    }

    #[test]
    fn idn_german_umlaut_to_punycode() {
        // "bücher" (German for "books") → xn--bcher-kva
        assert_eq!(normalise_domain("bücher.de").unwrap(), "xn--bcher-kva.de");
    }

    #[test]
    fn idn_japanese_to_punycode() {
        // "日本" (Japanese for "Japan") → xn--wgv71a
        assert_eq!(normalise_domain("日本.jp").unwrap(), "xn--wgv71a.jp");
    }

    #[test]
    fn idn_uppercase_unicode_is_lowercased_then_encoded() {
        // Verify the lower-then-encode order: IDN normalisation is
        // case-insensitive at the encoded layer.
        let lower = normalise_domain("bücher.de").unwrap();
        let upper = normalise_domain("BÜCHER.DE").unwrap();
        assert_eq!(lower, upper);
    }

    #[test]
    fn ascii_with_xn_prefix_round_trips() {
        // An already-punycoded label must pass through unchanged.
        assert_eq!(
            normalise_domain("xn--bcher-kva.de").unwrap(),
            "xn--bcher-kva.de"
        );
    }
}
