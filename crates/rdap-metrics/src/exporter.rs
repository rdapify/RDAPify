//! Prometheus recorder install and text-format render helpers.
//!
//! This module is only compiled when the `enabled` feature is on.

use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};

use crate::hooks::names;

/// Errors raised during recorder installation.
#[derive(Debug)]
pub enum MetricsError {
    /// A recorder was already installed in this process. Only one global
    /// recorder is supported by the `metrics` facade.
    AlreadyInstalled,
    /// The exporter builder rejected the configuration.
    Build(String),
}

impl std::fmt::Display for MetricsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AlreadyInstalled => f.write_str("metrics recorder already installed"),
            Self::Build(s) => write!(f, "metrics builder error: {s}"),
        }
    }
}

impl std::error::Error for MetricsError {}

/// Configuration for the Prometheus recorder.
#[derive(Clone, Debug)]
pub struct RecorderConfig {
    /// Histogram bucket boundaries for `rdap_latency_seconds` and
    /// `rdap_retry_after_seconds`. Values are seconds.
    pub histogram_buckets: Vec<f64>,
}

impl Default for RecorderConfig {
    fn default() -> Self {
        Self {
            histogram_buckets: default_buckets(),
        }
    }
}

/// Default histogram buckets (seconds) — covers fast cache hits to long
/// upstream tails. Aligns with the bucket choice in
/// `RDAPify-Internal/planning/V1_STABILIZATION_PLAN.md` Domain 8.
pub fn default_buckets() -> Vec<f64> {
    vec![
        0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
    ]
}

/// Handle returned by [`install_recorder`]. Render a Prometheus text payload
/// from this handle on each `/metrics` scrape.
#[derive(Clone)]
pub struct MetricsHandle {
    inner: PrometheusHandle,
}

impl MetricsHandle {
    /// Renders the current registry as Prometheus text format.
    pub fn render(&self) -> String {
        self.inner.render()
    }
}

impl std::fmt::Debug for MetricsHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MetricsHandle").finish_non_exhaustive()
    }
}

/// Installs the process-global Prometheus recorder. Must be called once at
/// process start; subsequent calls return [`MetricsError::AlreadyInstalled`].
///
/// Registers metric descriptions so the rendered text includes `# HELP`
/// lines for every metric the engine emits.
pub fn install_recorder(cfg: &RecorderConfig) -> Result<MetricsHandle, MetricsError> {
    let builder = PrometheusBuilder::new()
        .set_buckets_for_metric(
            Matcher::Full(names::LATENCY_SECONDS.to_string()),
            &cfg.histogram_buckets,
        )
        .map_err(|e| MetricsError::Build(e.to_string()))?
        .set_buckets_for_metric(
            Matcher::Full(names::RETRY_AFTER_SECONDS.to_string()),
            &cfg.histogram_buckets,
        )
        .map_err(|e| MetricsError::Build(e.to_string()))?;

    let handle = builder
        .install_recorder()
        .map_err(|e| MetricsError::Build(e.to_string()))?;

    register_descriptions();

    Ok(MetricsHandle { inner: handle })
}

/// Renders the current Prometheus registry to text format.
pub fn render(handle: &MetricsHandle) -> String {
    handle.render()
}

fn register_descriptions() {
    use metrics::{describe_counter, describe_gauge, describe_histogram, Unit};

    describe_counter!(
        names::REQUESTS_TOTAL,
        "Total RDAP requests partitioned by query type and outcome."
    );
    describe_histogram!(
        names::LATENCY_SECONDS,
        Unit::Seconds,
        "End-to-end latency of an RDAP request (cache + upstream + parsing)."
    );
    describe_counter!(
        names::CACHE_HITS_TOTAL,
        "Cache hits served, partitioned by freshness (fresh / stale / negative)."
    );
    describe_counter!(
        names::CACHE_MISSES_TOTAL,
        "Cache misses (no entry, or fully expired beyond the stale window)."
    );
    describe_counter!(
        names::CACHE_STALE_SERVED_TOTAL,
        "Stale-while-revalidate hits served while a refresh was pending."
    );
    describe_gauge!(
        names::CIRCUIT_BREAKER_STATE,
        "Per-origin circuit-breaker state (0=Closed, 1=Open, 2=HalfOpen)."
    );
    describe_counter!(
        names::CIRCUIT_BREAKER_OPEN_TOTAL,
        "Per-origin count of Closed→Open transitions since process start."
    );
    describe_counter!(
        names::RETRY_TOTAL,
        "Retried request attempts, partitioned by failure class."
    );
    describe_histogram!(
        names::RETRY_AFTER_SECONDS,
        Unit::Seconds,
        "Server-supplied Retry-After hint honoured by the client."
    );
    describe_gauge!(
        names::INFLIGHT_REQUESTS,
        "Upstream HTTP requests currently in flight."
    );
    describe_gauge!(
        names::SEMAPHORE_UTILIZATION,
        "Fraction of upstream-concurrency permits currently in use (0.0–1.0)."
    );
    describe_counter!(
        names::SLOW_REQUESTS_TOTAL,
        "Requests whose total latency exceeded the slow-request threshold."
    );
    describe_counter!(
        names::ERRORS_TOTAL,
        "Errors returned to the caller, partitioned by error class."
    );
    // v0.6.1 · Task 2/3/4 additions
    describe_counter!(
        names::CIRCUIT_BREAKER_TRANSITIONS_TOTAL,
        "Per-origin circuit-breaker state transitions (from→to)."
    );
    describe_counter!(
        names::CACHE_EVICTIONS_TOTAL,
        "Cache entries evicted (oldest-by-inserted_at on insert pressure, or fully expired on read)."
    );
    describe_gauge!(
        names::CACHE_ENTRIES_CURRENT,
        "Current resident cache entries."
    );
    describe_histogram!(
        names::RETRY_DELAY_SECONDS,
        Unit::Seconds,
        "Actual delay applied between retry attempts (max of backoff jitter and Retry-After header)."
    );
    // v0.6.2 additions
    describe_histogram!(
        names::SEMAPHORE_WAIT_SECONDS,
        Unit::Seconds,
        "Time spent waiting to acquire a concurrency permit, partitioned by kind={global,per_host}."
    );
    describe_counter!(
        names::CIRCUIT_BREAKER_OPEN_SECONDS_TOTAL,
        "Cumulative seconds the per-origin circuit breaker spent in the Open state. Truncated to whole seconds."
    );
    describe_histogram!(
        names::PER_HOST_QUEUE_DEPTH,
        Unit::Count,
        "Per-host semaphore depth (used permits) at acquire time."
    );
    describe_gauge!(
        names::PER_ORIGIN_INFLIGHT,
        Unit::Count,
        "Live count of in-flight requests per origin. Cardinality bounded by the per-host registry cap (≤ 1024 origins)."
    );
}
