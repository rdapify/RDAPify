//! Sanity test: with the `metrics` cargo feature on, `/metrics` MUST
//! expose the canonical `rdap_*` series emitted by `rdap-metrics`.
//!
//! Run with:
//!     cargo test -p rdap-service --features metrics --test metrics_sanity
//!
//! Without the feature flag this test is a compile-time no-op (a single
//! `#[cfg(feature = "metrics")]` gate on the test function), so it does
//! not gate the default build.

#![cfg(feature = "metrics")]

use std::time::Duration;

/// Builds an `AppState`-less rendering of `/metrics` by:
///   1. installing the engine recorder,
///   2. emitting a few sample data points via `metrics_hooks::*`,
///   3. asserting the rendered text contains the canonical `rdap_*`
///      metric names.
///
/// We do not stand up the Axum router; the goal is to verify that the
/// engine handle's `render()` includes the names that
/// `tools/extract_tuning_data.sh` queries for. Doing it without the
/// router keeps this test a fast unit check.
#[test]
fn metrics_endpoint_includes_canonical_rdap_series() {
    use rdap_metrics::hooks as h;
    use rdap_metrics::types::{CacheOutcome, QueryType, RequestStatus};

    // Install the recorder. Re-installation across multiple test
    // executables in the same process would fail; in `cargo test`
    // each test binary is its own process so this is fine.
    let handle = rdap_metrics::install_recorder(&rdap_metrics::RecorderConfig::default())
        .expect("install_recorder must succeed in a fresh process");

    // Drive a tiny mix of hook calls so the registry has non-empty
    // series. Each helper call below maps to one `metrics::*!` call.
    h::record_request(
        QueryType::Domain,
        RequestStatus::Success,
        Duration::from_millis(40),
    );
    h::record_request(
        QueryType::Domain,
        RequestStatus::Success,
        Duration::from_millis(55),
    );
    h::record_request(
        QueryType::Ip,
        RequestStatus::Success,
        Duration::from_millis(20),
    );
    h::record_cache(CacheOutcome::Fresh);
    h::record_cache(CacheOutcome::Miss);
    h::inflight_inc();
    h::inflight_inc();
    h::inflight_dec();

    let body = handle.render();

    // The three names called out by the wiring-fix spec.
    for canonical in [
        "rdap_cache_hits_total",
        "rdap_inflight_requests",
        "rdap_latency_seconds",
    ] {
        assert!(
            body.contains(canonical),
            "/metrics body missing canonical series `{canonical}` — \
             was install_recorder() called and were any engine hooks \
             driven? Body length: {} bytes",
            body.len()
        );
    }

    // Sanity: at least one of the histogram bucket lines is present
    // (proves the histogram is registered, not just the description).
    assert!(
        body.contains("rdap_latency_seconds_bucket"),
        "histogram for rdap_latency_seconds is registered but no _bucket \
         lines were emitted — render shape is broken"
    );

    // Sanity: rendered body conforms to the Prometheus text format
    // (every metric is preceded by `# HELP` or starts a sample line).
    assert!(
        body.contains("# HELP "),
        "rendered text is missing `# HELP` lines — exposition format is malformed"
    );
}
