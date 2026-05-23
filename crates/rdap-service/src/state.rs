use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use rdap_config::RdapifyConfig;
use rdapify_client::RdapClient;

use crate::metrics::Metrics;

/// Shared application state injected into every Axum handler via `State<AppState>`.
///
/// All fields are behind `Arc` so cloning is cheap (pointer copy only).
#[derive(Clone)]
pub struct AppState {
    /// RDAP client — wraps HTTP fetcher, bootstrap discovery, and memory cache.
    pub client: Arc<RdapClient>,
    /// Service configuration loaded at startup.
    pub config: Arc<RdapifyConfig>,
    /// Prometheus metrics counters and histograms.
    pub metrics: Arc<Metrics>,
    /// Last-seen stale-hit count from the cache (for delta computation).
    pub last_cache_stale: Arc<AtomicU64>,
    /// Last-seen negative-hit count from the cache (for delta computation).
    pub last_cache_negative: Arc<AtomicU64>,
    /// Engine metrics handle (canonical `rdap_*` series). Present only when
    /// the `metrics` cargo feature is enabled; rendered into `/metrics`
    /// alongside the local registry.
    #[cfg(feature = "metrics")]
    pub engine_metrics: Arc<rdap_metrics::MetricsHandle>,
}

impl AppState {
    /// Syncs stale and negative cache counters from the client's in-memory
    /// cache into the Prometheus metrics by computing the delta since the
    /// last call.  Called on each `/metrics` scrape.
    pub fn sync_cache_metrics(&self) {
        let Some(stats) = self.client.cache_stats() else {
            return;
        };

        let prev_stale = self.last_cache_stale.swap(stats.stale, Ordering::Relaxed);
        let prev_negative = self.last_cache_negative.swap(stats.negative, Ordering::Relaxed);

        let stale_delta = stats.stale.saturating_sub(prev_stale);
        let negative_delta = stats.negative.saturating_sub(prev_negative);

        for _ in 0..stale_delta {
            self.metrics.rdap_cache_stale_total.inc();
        }
        for _ in 0..negative_delta {
            self.metrics.rdap_cache_negative_total.inc();
        }
    }
}
