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
    // rate_limit_blocked_total: will be added when rdap-rate-limit moves out of skeleton phase
    /// Batch jobs submitted to the `/batch` endpoint.
    pub batch_jobs_total: Counter<u64, AtomicU64>,
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
        let batch_jobs_total: Counter<u64, AtomicU64> = Default::default();

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
            "batch_jobs_total",
            "Batch jobs submitted to the /batch endpoint",
            batch_jobs_total.clone(),
        );

        Self {
            registry: Arc::new(registry),
            http_requests_total,
            http_request_duration_seconds,
            rdap_requests_total,
            cache_hits_total,
            cache_misses_total,
            batch_jobs_total,
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
