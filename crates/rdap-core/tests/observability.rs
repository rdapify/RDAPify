//! Stage D · D2/D3/D4 — end-to-end observability tests for the fetcher.
//!
//! These run only with `--features metrics` enabled because they assert the
//! Prometheus surface. With the feature off all hook calls are no-ops and
//! there is nothing to inspect.

#![cfg(feature = "metrics")]

use std::sync::OnceLock;
use std::time::Duration;

use rdap_core::{Fetcher, FetcherConfig};
use rdap_metrics::{install_recorder, MetricsHandle, RecorderConfig};
use rdap_security::{SsrfConfig, SsrfGuard};

/// Process-global recorder. The `metrics` facade allows only one, so all
/// integration tests in this binary share it.
fn handle() -> &'static MetricsHandle {
    static H: OnceLock<MetricsHandle> = OnceLock::new();
    H.get_or_init(|| install_recorder(&RecorderConfig::default()).expect("install"))
}

fn fetcher(slow_ms: u64) -> Fetcher {
    let ssrf = SsrfGuard::with_config(SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    Fetcher::with_config(
        ssrf,
        FetcherConfig {
            max_attempts: 1,
            slow_request_threshold: Duration::from_millis(slow_ms),
            ..Default::default()
        },
    )
    .unwrap()
}

/// Find a numeric counter line by its prefix and return the rightmost
/// numeric value on that line. Lines look like:
///
///   rdap_errors_total{class="invalid_response"} 3
fn counter_value(out: &str, prefix: &str) -> Option<u64> {
    out.lines()
        .find(|l| l.starts_with(prefix))
        .and_then(|l| l.split_whitespace().last())
        .and_then(|n| n.parse().ok())
}

/// v0.6.11 — find the per-origin inflight gauge value for a specific
/// origin label (returns 0.0 if no series exists yet).
fn per_origin_inflight(out: &str, origin: &str) -> f64 {
    let prefix = format!("rdap_per_origin_inflight{{origin=\"{origin}\"}} ");
    out.lines()
        .find_map(|l| {
            l.strip_prefix(&prefix)
                .and_then(|v| v.trim().parse::<f64>().ok())
        })
        .unwrap_or(0.0)
}

#[tokio::test]
async fn slow_request_counter_increments_when_threshold_exceeded() {
    let _ = handle();
    let before = counter_value(&handle().render(), "rdap_slow_requests_total ").unwrap_or(0);

    // Mock that delays the response body by ~30 ms.
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_chunked_body(|w| {
            std::thread::sleep(Duration::from_millis(30));
            w.write_all(br#"{"objectClassName":"domain","ldhName":"X"}"#)
        })
        .create_async()
        .await;

    let url = format!("{}/rdap/x", server.url());
    // Threshold 1 ms — any response is slow.
    let f = fetcher(1);
    let _ = f.fetch(&url).await.unwrap();

    let after = counter_value(&handle().render(), "rdap_slow_requests_total ").unwrap();
    assert!(
        after > before,
        "rdap_slow_requests_total should have incremented ({before} → {after})"
    );
}

#[tokio::test]
async fn slow_request_counter_does_not_increment_under_threshold() {
    let _ = handle();
    let before = counter_value(&handle().render(), "rdap_slow_requests_total ").unwrap_or(0);

    // Fast mock — responds immediately. Threshold is 10 s so the request is
    // never slow.
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/fast")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"objectClassName":"domain","ldhName":"FAST"}"#)
        .create_async()
        .await;
    let url = format!("{}/rdap/fast", server.url());
    let f = fetcher(10_000);
    let _ = f.fetch(&url).await.unwrap();

    let after = counter_value(&handle().render(), "rdap_slow_requests_total ").unwrap_or(0);
    assert_eq!(
        after, before,
        "rdap_slow_requests_total must NOT increment for fast responses"
    );
}

#[tokio::test]
async fn errors_total_increments_with_invalid_response_class_on_4xx() {
    let _ = handle();
    let target_label = r#"rdap_errors_total{class="invalid_response"}"#;
    let before = counter_value(&handle().render(), target_label).unwrap_or(0);

    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/missing")
        .with_status(404)
        .with_body("{}")
        .create_async()
        .await;
    let url = format!("{}/rdap/missing", server.url());
    let f = fetcher(10_000);
    let _ = f.fetch(&url).await.unwrap_err();

    let after = counter_value(&handle().render(), target_label).unwrap_or(0);
    assert!(
        after > before,
        "rdap_errors_total{{class=invalid_response}} must increment on 404 ({before} → {after})"
    );
}

#[tokio::test]
async fn retry_total_increments_with_http_5xx_class_on_500() {
    let _ = handle();
    let target_label = r#"rdap_retry_total{class="http_5xx"}"#;
    let before = counter_value(&handle().render(), target_label).unwrap_or(0);

    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(500)
        .with_body("{}")
        .expect_at_least(1)
        .create_async()
        .await;

    // Allow up to 2 attempts so retry happens at least once.
    let ssrf = SsrfGuard::with_config(SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    let f = Fetcher::with_config(
        ssrf,
        FetcherConfig {
            max_attempts: 2,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(2),
            slow_request_threshold: Duration::from_secs(60),
            ..Default::default()
        },
    )
    .unwrap();
    let url = format!("{}/rdap/x", server.url());
    let _ = f.fetch(&url).await.unwrap_err();

    let after = counter_value(&handle().render(), target_label).unwrap_or(0);
    assert!(
        after > before,
        "rdap_retry_total{{class=http_5xx}} must increment on 500 ({before} → {after})"
    );
}

#[tokio::test]
async fn errors_total_increments_with_circuit_open_class_when_breaker_short_circuits() {
    let _ = handle();
    let target_label = r#"rdap_errors_total{class="circuit_open"}"#;
    let before = counter_value(&handle().render(), target_label).unwrap_or(0);

    // Spin up a 500-only server and beat its breaker into Open state, then
    // verify the *next* call increments the circuit_open counter.
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(500)
        .with_body("{}")
        .expect_at_least(5)
        .create_async()
        .await;

    let ssrf = SsrfGuard::with_config(SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    let f = Fetcher::with_config(
        ssrf,
        FetcherConfig {
            max_attempts: 1, // each call is one HTTP attempt
            slow_request_threshold: Duration::from_secs(60),
            ..Default::default()
        },
    )
    .unwrap();
    let url = format!("{}/rdap/x", server.url());
    for _ in 0..5 {
        let _ = f.fetch(&url).await;
    }
    // The 6th call must be short-circuited by the breaker.
    let _ = f.fetch(&url).await.unwrap_err();

    let after = counter_value(&handle().render(), target_label).unwrap_or(0);
    assert!(
        after > before,
        "rdap_errors_total{{class=circuit_open}} must increment after breaker opens ({before} → {after})"
    );
}

// ── v0.6.1 — new metric coverage ────────────────────────────────────────

#[tokio::test]
async fn breaker_transition_metric_emits_closed_to_open() {
    let _ = handle();
    // Match any line for this counter regardless of label order. The
    // 500-storm test above already runs the same breaker pattern, so
    // the transitions counter should be non-zero by the time we read.
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(500)
        .with_body("{}")
        .expect_at_least(5)
        .create_async()
        .await;

    let f = fetcher(60_000);
    let url = format!("{}/rdap/x", server.url());
    for _ in 0..6 {
        let _ = f.fetch(&url).await;
    }

    let out = handle().render();
    assert!(
        out.lines().any(|l| {
            l.starts_with("rdap_circuit_breaker_transitions_total{")
                && l.contains(r#"from="closed""#)
                && l.contains(r#"to="open""#)
        }),
        "expected closed→open transition counter line; got:\n{out}"
    );
}

#[tokio::test]
async fn cache_entries_current_gauge_renders_once_set() {
    // The cache-entries gauge is set on every cache insert / eviction.
    // The rdap-core fetcher does not directly populate a cache (that's
    // the client's job), so we drive the hook directly to verify the
    // render shape is what dashboards will see.
    let _ = handle();
    rdap_metrics::hooks::set_cache_entries_current(42);
    let out = handle().render();
    assert!(
        out.lines().any(|l| l.starts_with("rdap_cache_entries_current ")),
        "expected rdap_cache_entries_current gauge value in:\n{out}"
    );
    assert!(
        out.contains("# TYPE rdap_cache_entries_current gauge"),
        "expected gauge type line"
    );
}

#[tokio::test]
async fn cache_evictions_total_counter_increments() {
    let _ = handle();
    let target = "rdap_cache_evictions_total ";
    let before = counter_value(&handle().render(), target).unwrap_or(0);
    rdap_metrics::hooks::record_cache_eviction();
    rdap_metrics::hooks::record_cache_eviction();
    let after = counter_value(&handle().render(), target).unwrap_or(0);
    assert!(
        after >= before + 2,
        "rdap_cache_evictions_total must climb (was {before}, now {after})"
    );
}

// ── v0.6.2 — observability metric coverage ──────────────────────────────

#[tokio::test]
async fn semaphore_wait_seconds_histogram_records_global_kind() {
    // Drive a single fetch with a per-host cap disabled so ONLY the
    // global kind is observed. We can't reliably assert `kind="per_host"`
    // here without inducing contention; the global side fires on every
    // fetch.
    let _ = handle();
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"objectClassName":"domain","ldhName":"X"}"#)
        .create_async()
        .await;

    let ssrf = rdap_security::SsrfGuard::with_config(rdap_security::SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    let f = rdap_core::Fetcher::with_config(
        ssrf,
        rdap_core::FetcherConfig {
            max_attempts: 1,
            slow_request_threshold: std::time::Duration::from_secs(60),
            per_host_concurrency_limit: None,
            ..Default::default()
        },
    )
    .unwrap();
    let url = format!("{}/rdap/x", server.url());
    let _ = f.fetch(&url).await.unwrap();

    let out = handle().render();
    let count_line = out
        .lines()
        .find(|l| {
            l.starts_with("rdap_semaphore_wait_seconds_count{")
                && l.contains(r#"kind="global""#)
        })
        .expect("rdap_semaphore_wait_seconds_count{kind=global} line missing");
    let v: u64 = count_line
        .split_whitespace()
        .last()
        .unwrap()
        .parse()
        .unwrap();
    assert!(
        v >= 1,
        "expected ≥1 sample on global semaphore wait, got {v}"
    );
}

#[tokio::test]
async fn per_host_queue_depth_histogram_records_when_per_host_enabled() {
    let _ = handle();
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"objectClassName":"domain","ldhName":"X"}"#)
        .create_async()
        .await;

    let ssrf = rdap_security::SsrfGuard::with_config(rdap_security::SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    let f = rdap_core::Fetcher::with_config(
        ssrf,
        rdap_core::FetcherConfig {
            max_attempts: 1,
            slow_request_threshold: std::time::Duration::from_secs(60),
            per_host_concurrency_limit: Some(8),
            ..Default::default()
        },
    )
    .unwrap();
    let url = format!("{}/rdap/x", server.url());
    let _ = f.fetch(&url).await.unwrap();

    let out = handle().render();
    let count_line = out
        .lines()
        .find(|l| l.starts_with("rdap_per_host_queue_depth_count "))
        .expect("rdap_per_host_queue_depth_count line missing");
    let v: u64 = count_line
        .split_whitespace()
        .last()
        .unwrap()
        .parse()
        .unwrap();
    assert!(v >= 1, "expected ≥1 per-host queue-depth sample, got {v}");
}

#[tokio::test]
async fn breaker_open_seconds_total_increments_after_cooldown_elapses() {
    let _ = handle();
    // Use a very short cooldown so the test runs in a few seconds and
    // we can witness Open → HalfOpen.
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(500)
        .with_body("{}")
        .expect_at_least(5)
        .create_async()
        .await;

    let ssrf = rdap_security::SsrfGuard::with_config(rdap_security::SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    // Custom breaker registry with a 1-second cooldown so the test is fast.
    let breakers =
        rdap_core::CircuitBreakerRegistry::with_config(/* threshold */ 5, /* cooldown_ms */ 1_000);
    let f = rdap_core::Fetcher::with_config_and_breakers(
        ssrf,
        rdap_core::FetcherConfig {
            max_attempts: 1,
            slow_request_threshold: std::time::Duration::from_secs(60),
            per_host_concurrency_limit: None,
            ..Default::default()
        },
        breakers,
    )
    .unwrap();
    let url = format!("{}/rdap/x", server.url());

    // Open the breaker.
    for _ in 0..5 {
        let _ = f.fetch(&url).await;
    }
    // Sleep through the cooldown so the next call transitions Open→HalfOpen.
    tokio::time::sleep(std::time::Duration::from_millis(1_100)).await;
    let _ = f.fetch(&url).await; // triggers the transition
    // The transition emits add_breaker_open_duration. With a 1.0–1.1 s
    // window and `as_secs()` truncation, we expect the counter to climb
    // by >= 1 (the increment is skipped when secs == 0).
    let out = handle().render();
    let line = out.lines().find(|l| {
        l.starts_with("rdap_circuit_breaker_open_seconds_total{") && l.contains("origin=")
    });
    assert!(
        line.is_some(),
        "expected rdap_circuit_breaker_open_seconds_total{{origin=...}} line; got:\n{out}"
    );
}

#[tokio::test]
async fn retry_delay_seconds_histogram_records_on_5xx_retry() {
    let _ = handle();
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(500)
        .with_body("{}")
        .expect_at_least(2)
        .create_async()
        .await;

    let ssrf = rdap_security::SsrfGuard::with_config(rdap_security::SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    // Allow a retry so the delay histogram has a sample.
    let f = rdap_core::Fetcher::with_config(
        ssrf,
        rdap_core::FetcherConfig {
            max_attempts: 2,
            initial_backoff: std::time::Duration::from_millis(1),
            max_backoff: std::time::Duration::from_millis(2),
            slow_request_threshold: std::time::Duration::from_secs(60),
            per_host_concurrency_limit: None,
            ..Default::default()
        },
    )
    .unwrap();
    let url = format!("{}/rdap/x", server.url());
    let _ = f.fetch(&url).await.unwrap_err();

    let out = handle().render();
    let count_line = out
        .lines()
        .find(|l| l.starts_with("rdap_retry_delay_seconds_count "))
        .expect("retry_delay_seconds count line missing");
    let v: u64 = count_line
        .split_whitespace()
        .last()
        .unwrap()
        .parse()
        .unwrap();
    assert!(v >= 1, "expected ≥1 sample in retry_delay histogram, got {v}");
}

// ── v0.6.11 — per-origin inflight gauge: balanced inc/dec on every exit path

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn per_origin_inflight_returns_to_zero_after_success() {
    let _ = handle();

    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"objectClassName":"domain","ldhName":"OK"}"#)
        .expect_at_least(1)
        .create_async()
        .await;

    let url = format!("{}/rdap/x", server.url());
    let host_port = server.host_with_port();
    // Origin Display format is "<scheme>://<host>:<port>"; the mockito
    // server's `host_with_port()` already returns "host:port".
    let origin_label = format!("http://{host_port}");

    let f = fetcher(60_000);

    // Capture baseline (other tests may have touched this label).
    let baseline = per_origin_inflight(&handle().render(), &origin_label);

    // 5 sequential successful fetches.
    for _ in 0..5 {
        let _ = f.fetch(&url).await.unwrap();
    }

    let after = per_origin_inflight(&handle().render(), &origin_label);
    assert!(
        (after - baseline).abs() < 1e-9,
        "per-origin gauge leaked: baseline={baseline}, after={after} (origin={origin_label})"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn per_origin_inflight_returns_to_zero_after_retry_path() {
    let _ = handle();

    // Server returns 500 — the retry path drops both permits and the
    // origin-inflight guard before sleeping. After all attempts complete
    // (failure), the gauge must be back at baseline.
    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(500)
        .with_body("{}")
        .expect_at_least(2)
        .create_async()
        .await;

    let url = format!("{}/rdap/x", server.url());
    let host_port = server.host_with_port();
    let origin_label = format!("http://{host_port}");

    // Allow up to 3 attempts so the retry-with-drop path executes at
    // least once.
    let ssrf = SsrfGuard::with_config(SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    let f = Fetcher::with_config(
        ssrf,
        FetcherConfig {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(50),
            ..Default::default()
        },
    )
    .unwrap();

    let baseline = per_origin_inflight(&handle().render(), &origin_label);

    let _ = f.fetch(&url).await; // expected to fail after all retries

    let after = per_origin_inflight(&handle().render(), &origin_label);
    assert!(
        (after - baseline).abs() < 1e-9,
        "per-origin gauge leaked on retry path: baseline={baseline}, after={after} (origin={origin_label})"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn per_origin_inflight_does_not_appear_when_per_host_disabled() {
    // When per_host_concurrency_limit = None, the guard is not created
    // (per the design: cardinality stays bounded by the per-host
    // registry's existence). The fetch must not change the per-origin
    // gauge for this origin.
    //
    // Asserted via before/after delta rather than "series does not
    // exist" — the metrics recorder is process-global, and a label
    // combination that has ever been touched stays in the rendered
    // output (at value 0). before/after delta is the robust shape
    // matching the rest of this test file.
    let _ = handle();

    let mut server = mockito::Server::new_async().await;
    let _mock = server
        .mock("GET", "/rdap/x")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"objectClassName":"domain","ldhName":"OK"}"#)
        .create_async()
        .await;

    let host_port = server.host_with_port();
    let origin_label = format!("http://{host_port}");

    let ssrf = SsrfGuard::with_config(SsrfConfig {
        enabled: false,
        ..Default::default()
    });
    let f = Fetcher::with_config(
        ssrf,
        FetcherConfig {
            max_attempts: 1,
            per_host_concurrency_limit: None, // ← opt out of per-host gating
            ..Default::default()
        },
    )
    .unwrap();

    let url = format!("{}/rdap/x", server.url());

    let before = per_origin_inflight(&handle().render(), &origin_label);
    let _ = f.fetch(&url).await.unwrap();
    let after = per_origin_inflight(&handle().render(), &origin_label);

    assert!(
        (after - before).abs() < 1e-9,
        "per-origin gauge moved when per_host disabled: before={before}, after={after} (origin={origin_label})"
    );
}
