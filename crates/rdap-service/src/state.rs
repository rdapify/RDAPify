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
}
