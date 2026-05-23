use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use prometheus_client::encoding::text::encode;
use prometheus_client::metrics::counter::Counter;
use prometheus_client::metrics::histogram::{exponential_buckets, Histogram};
use prometheus_client::registry::Registry;

/// All Prometheus metrics for the service.
///
/// Counters and histograms are cheap to clone — they share the same underlying
/// atomics.  The registry is wrapped in `Arc` so it can be shared across the
/// service state without requiring a lock (it is read-only after construction).
pub struct Metrics {
    /// Prometheus metric registry (read-only after `new()`).
    pub registry: Arc<Registry>,

    /// Total HTTP requests received by the service.
    pub http_requests_total: Counter<u64, AtomicU64>,
    /// HTTP request duration in seconds (histogram with exponential buckets).
    pub http_request_duration_seconds: Histogram,
    /// Total RDAP queries dispatched to upstream registries.
    pub rdap_requests_total: Counter<u64, AtomicU64>,
    /// Responses served from the in-memory cache.
    pub cache_hits_total: Counter<u64, AtomicU64>,
    /// Responses fetched live (cache miss).
    pub cache_misses_total: Counter<u64, AtomicU64>,
    /// RDAP queries that timed out before receiving a response.
    pub rdap_errors_timeout_total: Counter<u64, AtomicU64>,
    /// RDAP queries blocked by the local rate limiter.
    pub rdap_errors_rate_limited_total: Counter<u64, AtomicU64>,
    /// RDAP queries that received an HTTP error response (4xx/5xx).
    pub rdap_errors_http_total: Counter<u64, AtomicU64>,
    /// Responses served from cache that had exceeded their primary TTL
    /// (stale-while-revalidate hits).
    pub rdap_cache_stale_total: Counter<u64, AtomicU64>,
    /// Responses short-circuited by the negative cache (404 cached).
    pub rdap_cache_negative_total: Counter<u64, AtomicU64>,
    /// Batch jobs submitted to the `/batch` endpoint.
    pub batch_jobs_total: Counter<u64, AtomicU64>,
    /// Batch job processing duration in seconds.
    pub rdap_batch_duration_seconds: Histogram,
    /// Distribution of batch job sizes (number of queries per job).
    pub rdap_batch_size: Histogram,
}

impl Metrics {
    pub fn new() -> Self {
        let mut registry = Registry::default();

        let http_requests_total: Counter<u64, AtomicU64> = Default::default();
        // Latency buckets: 5ms … ~10s (12 exponential steps, factor 2)
        let http_request_duration_seconds = Histogram::new(exponential_buckets(0.005, 2.0, 12));
        let rdap_requests_total: Counter<u64, AtomicU64> = Default::default();
        let cache_hits_total: Counter<u64, AtomicU64> = Default::default();
        let cache_misses_total: Counter<u64, AtomicU64> = Default::default();
        let rdap_errors_timeout_total: Counter<u64, AtomicU64> = Default::default();
        let rdap_errors_rate_limited_total: Counter<u64, AtomicU64> = Default::default();
        let rdap_errors_http_total: Counter<u64, AtomicU64> = Default::default();
        let rdap_cache_stale_total: Counter<u64, AtomicU64> = Default::default();
        let rdap_cache_negative_total: Counter<u64, AtomicU64> = Default::default();
        let batch_jobs_total: Counter<u64, AtomicU64> = Default::default();
        // Batch duration: 0.1s → ~25s (9 exponential steps, factor 2)
        let rdap_batch_duration_seconds = Histogram::new(exponential_buckets(0.1, 2.0, 9));
        // Batch size distribution: 1 → 100 items
        let rdap_batch_size = Histogram::new([1.0, 5.0, 10.0, 25.0, 50.0, 100.0].into_iter());

        registry.register(
            "http_requests_total",
            "Total HTTP requests received by the service",
            http_requests_total.clone(),
        );
        registry.register(
            "http_request_duration_seconds",
            "HTTP request duration in seconds",
            http_request_duration_seconds.clone(),
        );
        // When the `metrics` cargo feature is on, the engine's
        // `rdap-metrics` registry already emits `rdap_requests_total`
        // (with `type` and `status` labels). Skipping registration here
        // avoids a duplicate metric definition in the rendered text — the
        // engine's series is the authoritative one. The local counter
        // field stays in the struct so existing callers continue to
        // compile (they just no-op into a counter that's never scraped).
        #[cfg(not(feature = "metrics"))]
        registry.register(
            "rdap_requests_total",
            "Total RDAP queries dispatched to upstream registries",
            rdap_requests_total.clone(),
        );
        registry.register(
            "cache_hits_total",
            "Responses served from the in-memory cache",
            cache_hits_total.clone(),
        );
        registry.register(
            "cache_misses_total",
            "Responses fetched live (cache miss)",
            cache_misses_total.clone(),
        );
        registry.register(
            "rdap_errors_timeout_total",
            "RDAP queries that timed out before receiving a response",
            rdap_errors_timeout_total.clone(),
        );
        registry.register(
            "rdap_errors_rate_limited_total",
            "RDAP queries blocked by the local rate limiter",
            rdap_errors_rate_limited_total.clone(),
        );
        registry.register(
            "rdap_errors_http_total",
            "RDAP queries that received an HTTP error response (4xx/5xx)",
            rdap_errors_http_total.clone(),
        );
        registry.register(
            "rdap_cache_stale_total",
            "Responses served from cache that had exceeded their primary TTL (SWR hits)",
            rdap_cache_stale_total.clone(),
        );
        registry.register(
            "rdap_cache_negative_total",
            "Responses short-circuited by the negative cache (404 cached)",
            rdap_cache_negative_total.clone(),
        );
        registry.register(
            "batch_jobs_total",
            "Batch jobs submitted to the /batch endpoint",
            batch_jobs_total.clone(),
        );
        registry.register(
            "rdap_batch_duration_seconds",
            "Batch job processing duration in seconds",
            rdap_batch_duration_seconds.clone(),
        );
        registry.register(
            "rdap_batch_size",
            "Distribution of batch job sizes (number of queries per job)",
            rdap_batch_size.clone(),
        );

        Self {
            registry: Arc::new(registry),
            http_requests_total,
            http_request_duration_seconds,
            rdap_requests_total,
            cache_hits_total,
            cache_misses_total,
            rdap_errors_timeout_total,
            rdap_errors_rate_limited_total,
            rdap_errors_http_total,
            rdap_cache_stale_total,
            rdap_cache_negative_total,
            batch_jobs_total,
            rdap_batch_duration_seconds,
            rdap_batch_size,
        }
    }

    /// Encodes all registered metrics to the Prometheus text exposition format.
    pub fn encode_to_text(&self) -> String {
        let mut buf = String::new();
        encode(&mut buf, &self.registry).unwrap_or_default();
        buf
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}
