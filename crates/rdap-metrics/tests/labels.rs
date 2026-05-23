//! Stage D · D1/D4 — label-shape and cardinality tests for the Prometheus
//! exporter. Run only with the `enabled` feature on; the no-op variant has
//! no exposable surface to inspect.
//!
//! `ErrorClass` and `RetryClass` themselves are tested in `rdap-core`'s own
//! unit suite (`error_class.rs`) — those are the canonical types. This file
//! verifies that the label *strings* the engine emits land correctly in the
//! Prometheus output regardless of source.

#![cfg(feature = "enabled")]

use std::sync::OnceLock;
use std::time::Duration;

use rdap_metrics::hooks;
use rdap_metrics::types::{CacheOutcome, CircuitGaugeValue, QueryType, RequestStatus};
use rdap_metrics::{install_recorder, MetricsHandle, RecorderConfig};

fn handle() -> &'static MetricsHandle {
    static H: OnceLock<MetricsHandle> = OnceLock::new();
    H.get_or_init(|| {
        install_recorder(&RecorderConfig::default()).expect("first install must succeed")
    })
}

#[test]
fn record_request_emits_correct_label_set() {
    let h = handle();
    hooks::record_request(
        QueryType::Domain,
        RequestStatus::Success,
        Duration::from_millis(42),
    );
    hooks::record_request(
        QueryType::Ip,
        RequestStatus::Error,
        Duration::from_millis(900),
    );

    let out = h.render();
    assert!(
        out.lines().any(|l| {
            l.starts_with("rdap_requests_total{")
                && l.contains(r#"type="domain""#)
                && l.contains(r#"status="success""#)
        }),
        "expected rdap_requests_total line with type=domain,status=success, got:\n{out}"
    );
    assert!(
        out.lines().any(|l| {
            l.starts_with("rdap_requests_total{")
                && l.contains(r#"type="ip""#)
                && l.contains(r#"status="error""#)
        }),
        "expected rdap_requests_total line with type=ip,status=error, got:\n{out}"
    );
    assert!(out.contains("# TYPE rdap_latency_seconds histogram"));
    assert!(out.contains(r#"rdap_latency_seconds_count{type="domain"}"#));
}

#[test]
fn record_cache_distinguishes_freshness_classes() {
    let _ = handle();
    hooks::record_cache(CacheOutcome::Fresh);
    hooks::record_cache(CacheOutcome::Stale);
    hooks::record_cache(CacheOutcome::Miss);
    hooks::record_cache(CacheOutcome::Negative);
    let out = handle().render();
    assert!(out.contains(r#"freshness="fresh""#));
    assert!(out.contains(r#"freshness="stale""#));
    assert!(out.contains(r#"freshness="negative""#));
    assert!(out.contains("rdap_cache_misses_total"));
    assert!(out.contains("rdap_cache_stale_served_total"));
}

#[test]
fn inflight_origin_gauge_increments_decrements_per_label() {
    // v0.6.11 — verify the per-origin inflight gauge:
    //   1. inc(A) inc(A) → gauge value for A is 2
    //   2. inc(B) → A still 2, B is 1 (per-label isolation)
    //   3. dec(A) dec(A) dec(B) → both back to 0 (no leak)
    fn read_origin_gauge(out: &str, origin: &str) -> Option<f64> {
        let prefix = format!(
            "rdap_per_origin_inflight{{origin=\"{origin}\"}} "
        );
        out.lines().find_map(|l| {
            l.strip_prefix(&prefix)
                .and_then(|v| v.trim().parse::<f64>().ok())
        })
    }

    let h = handle();
    let origin_a = "https://rdap.test-a:443";
    let origin_b = "https://rdap.test-b:443";

    // Capture baselines (other tests may have touched these labels).
    let base_a = read_origin_gauge(&h.render(), origin_a).unwrap_or(0.0);
    let base_b = read_origin_gauge(&h.render(), origin_b).unwrap_or(0.0);

    // 1. Two inc on A.
    hooks::inflight_origin_inc(origin_a);
    hooks::inflight_origin_inc(origin_a);
    let v_a = read_origin_gauge(&h.render(), origin_a)
        .expect("rdap_per_origin_inflight{origin=A} not rendered after inc");
    assert!(
        (v_a - (base_a + 2.0)).abs() < 1e-9,
        "expected A gauge = baseline+2 ({}+2={}), got {v_a}",
        base_a,
        base_a + 2.0
    );

    // 2. inc on B — A unchanged, B incremented.
    hooks::inflight_origin_inc(origin_b);
    let v_a2 = read_origin_gauge(&h.render(), origin_a).unwrap();
    let v_b = read_origin_gauge(&h.render(), origin_b)
        .expect("rdap_per_origin_inflight{origin=B} not rendered");
    assert!(
        (v_a2 - (base_a + 2.0)).abs() < 1e-9,
        "A leaked to B's inc"
    );
    assert!(
        (v_b - (base_b + 1.0)).abs() < 1e-9,
        "B should be baseline+1, got {v_b}"
    );

    // 3. Balance every inc with a dec — gauges return to baseline.
    hooks::inflight_origin_dec(origin_a);
    hooks::inflight_origin_dec(origin_a);
    hooks::inflight_origin_dec(origin_b);
    let v_a3 = read_origin_gauge(&h.render(), origin_a).unwrap();
    let v_b2 = read_origin_gauge(&h.render(), origin_b).unwrap();
    assert!(
        (v_a3 - base_a).abs() < 1e-9,
        "A did not return to baseline: {v_a3} vs {base_a}"
    );
    assert!(
        (v_b2 - base_b).abs() < 1e-9,
        "B did not return to baseline: {v_b2} vs {base_b}"
    );
}

#[test]
fn cache_eviction_counter_advances_and_entries_gauge_tracks_set() {
    // T2 case 6 — verify the eviction counter advances by exactly N
    // after N hook calls, and that the entries gauge reflects the last
    // `set_cache_entries_current` value.
    //
    // We assert deltas, not absolutes: this suite shares one global
    // recorder across tests, so other tests may have advanced these
    // metrics first.
    fn read_unlabelled_counter(out: &str, name: &str) -> u64 {
        let prefix = format!("{name} ");
        out.lines()
            .find_map(|l| l.strip_prefix(&prefix).and_then(|v| v.trim().parse().ok()))
            .unwrap_or(0)
    }

    let h = handle();

    let before = read_unlabelled_counter(&h.render(), "rdap_cache_evictions_total");
    hooks::record_cache_eviction();
    hooks::record_cache_eviction();
    hooks::record_cache_eviction();
    let after = read_unlabelled_counter(&h.render(), "rdap_cache_evictions_total");
    assert_eq!(
        after - before,
        3,
        "rdap_cache_evictions_total must advance by exactly 3 (before={before}, after={after})"
    );

    // Gauge: set to 7, observe; set to 0, observe.
    hooks::set_cache_entries_current(7);
    let out = h.render();
    assert!(
        out.lines().any(|l| l == "rdap_cache_entries_current 7"),
        "expected `rdap_cache_entries_current 7`, got:\n{out}"
    );
    hooks::set_cache_entries_current(0);
    let out = h.render();
    assert!(
        out.lines().any(|l| l == "rdap_cache_entries_current 0"),
        "expected `rdap_cache_entries_current 0`, got:\n{out}"
    );
}

#[test]
fn record_error_takes_static_label_and_emits_class_label_value() {
    // `record_error` is the rdap-core::ErrorClass::metric_label() pipeline.
    // We pass label strings directly here to verify the exporter shape.
    let _ = handle();
    hooks::record_error("network");
    hooks::record_error("circuit_open");
    let out = handle().render();
    assert!(
        out.lines()
            .any(|l| l.starts_with("rdap_errors_total{") && l.contains(r#"class="network""#)),
        "expected rdap_errors_total line with class=network:\n{out}"
    );
    assert!(
        out.lines()
            .any(|l| l.starts_with("rdap_errors_total{") && l.contains(r#"class="circuit_open""#)),
        "expected rdap_errors_total line with class=circuit_open:\n{out}"
    );
}

#[test]
fn record_retry_takes_static_label_and_emits_retry_after_when_present() {
    let _ = handle();
    hooks::record_retry("http_5xx", Some(Duration::from_millis(250)));
    hooks::record_retry("rate_limited", None);
    let out = handle().render();
    assert!(
        out.lines()
            .any(|l| l.starts_with("rdap_retry_total{") && l.contains(r#"class="http_5xx""#)),
        "expected rdap_retry_total{{class=http_5xx}} line:\n{out}"
    );
    assert!(out.contains("# TYPE rdap_retry_after_seconds histogram"));
    // Histogram count > 0 since we recorded at least one Retry-After hint.
    let count_line = out
        .lines()
        .find(|l| l.starts_with("rdap_retry_after_seconds_count "))
        .expect("retry_after_seconds_count line missing");
    let v: u64 = count_line
        .split_whitespace()
        .last()
        .unwrap()
        .parse()
        .unwrap();
    assert!(
        v >= 1,
        "expected ≥1 sample in retry_after histogram, got {v}"
    );
}

#[test]
fn record_slow_request_is_unlabelled_counter() {
    let _ = handle();
    let before = handle()
        .render()
        .lines()
        .find(|l| l.starts_with("rdap_slow_requests_total "))
        .map(|l| l.split_whitespace().last().unwrap().parse::<u64>().unwrap())
        .unwrap_or(0);
    hooks::record_slow_request();
    hooks::record_slow_request();
    let after = handle()
        .render()
        .lines()
        .find(|l| l.starts_with("rdap_slow_requests_total "))
        .map(|l| l.split_whitespace().last().unwrap().parse::<u64>().unwrap())
        .unwrap();
    assert!(
        after >= before + 2,
        "slow counter must increment ({before} → {after})"
    );
}

#[test]
fn query_type_labels_are_stable_strings() {
    assert_eq!(QueryType::Domain.as_label(), "domain");
    assert_eq!(QueryType::Ip.as_label(), "ip");
    assert_eq!(QueryType::Asn.as_label(), "asn");
    assert_eq!(QueryType::Nameserver.as_label(), "nameserver");
    assert_eq!(QueryType::Entity.as_label(), "entity");
}

#[test]
fn inflight_gauge_increments_and_decrements() {
    let _ = handle();
    hooks::inflight_inc();
    hooks::inflight_inc();
    hooks::inflight_inc();
    hooks::inflight_dec();
    let out = handle().render();
    let line = out
        .lines()
        .find(|l| l.starts_with("rdap_inflight_requests "))
        .expect("inflight gauge line missing");
    let value: f64 = line.split_whitespace().nth(1).unwrap().parse().unwrap();
    assert!(value >= 0.0, "inflight gauge went negative: {value}");
}

#[test]
fn circuit_state_gauge_uses_numeric_encoding() {
    let _ = handle();
    hooks::set_circuit_state("https://rdap.test.example:443", CircuitGaugeValue::Open);
    let out = handle().render();
    assert!(
        out.contains(r#"rdap_circuit_breaker_state{origin="https://rdap.test.example:443"} 1"#),
        "expected circuit_breaker_state gauge value 1 (Open), got:\n{out}"
    );
}

#[test]
fn cardinality_is_bounded_under_repeated_emission() {
    // Drive 10_000 events through every counter using a *bounded* set of
    // label values. A real blow-up would materialise as thousands of
    // distinct series; we assert the rendered text stays compact.
    let _ = handle();
    let error_classes = [
        "network",
        "invalid_response",
        "rate_limited",
        "circuit_open",
        "timeout",
        "internal",
    ];
    let retry_classes = ["network", "timeout", "rate_limited", "http_5xx", "http_4xx"];
    for i in 0..10_000u32 {
        let q = match i % 5 {
            0 => QueryType::Domain,
            1 => QueryType::Ip,
            2 => QueryType::Asn,
            3 => QueryType::Nameserver,
            _ => QueryType::Entity,
        };
        let s = if i % 2 == 0 {
            RequestStatus::Success
        } else {
            RequestStatus::Error
        };
        hooks::record_request(q, s, Duration::from_millis(((i % 100) + 1) as u64));

        hooks::record_cache(match i % 4 {
            0 => CacheOutcome::Fresh,
            1 => CacheOutcome::Stale,
            2 => CacheOutcome::Miss,
            _ => CacheOutcome::Negative,
        });

        hooks::record_error(error_classes[(i as usize) % error_classes.len()]);
        hooks::record_retry(retry_classes[(i as usize) % retry_classes.len()], None);
    }

    let out = handle().render();
    let series_lines = out
        .lines()
        .filter(|l| l.starts_with("rdap_") && (l.contains('{') || l.contains(' ')))
        .count();
    assert!(
        series_lines < 500,
        "cardinality blow-up: {series_lines} series lines emitted"
    );
}
