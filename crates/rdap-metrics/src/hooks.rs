//! Typed instrumentation hooks called from the engine's hot paths.
//!
//! Every function in this module is **either** an `#[inline(always)]` no-op
//! (when the `enabled` cargo feature is off) **or** a thin call into the
//! `metrics` facade (when the feature is on). The compiler elides no-op calls
//! entirely under release mode + LTO, so call sites can be unconditional and
//! the engine pays zero overhead in the default build.

use std::time::Duration;

use crate::types::{CacheOutcome, CircuitGaugeValue, QueryType, RequestStatus};

/// Canonical metric names. Kept in one place so the exporter and the hook
/// implementations agree, and so a `grep` for any name finds both sites.
pub mod names {
    pub const REQUESTS_TOTAL: &str = "rdap_requests_total";
    pub const LATENCY_SECONDS: &str = "rdap_latency_seconds";
    pub const CACHE_HITS_TOTAL: &str = "rdap_cache_hits_total";
    pub const CACHE_MISSES_TOTAL: &str = "rdap_cache_misses_total";
    pub const CACHE_STALE_SERVED_TOTAL: &str = "rdap_cache_stale_served_total";
    pub const CIRCUIT_BREAKER_STATE: &str = "rdap_circuit_breaker_state";
    pub const CIRCUIT_BREAKER_OPEN_TOTAL: &str = "rdap_circuit_breaker_open_total";
    pub const RETRY_TOTAL: &str = "rdap_retry_total";
    pub const RETRY_AFTER_SECONDS: &str = "rdap_retry_after_seconds";
    pub const INFLIGHT_REQUESTS: &str = "rdap_inflight_requests";
    pub const SEMAPHORE_UTILIZATION: &str = "rdap_semaphore_utilization";
    pub const SLOW_REQUESTS_TOTAL: &str = "rdap_slow_requests_total";
    pub const ERRORS_TOTAL: &str = "rdap_errors_total";
    /// v0.6.1 · Task 2 — every state transition (closed→open,
    /// open→half_open, half_open→closed, half_open→open).
    pub const CIRCUIT_BREAKER_TRANSITIONS_TOTAL: &str = "rdap_circuit_breaker_transitions_total";
    /// v0.6.1 · Task 3 — cache eviction counter (oldest-by-inserted_at,
    /// or fully-expired entry on read).
    pub const CACHE_EVICTIONS_TOTAL: &str = "rdap_cache_evictions_total";
    /// v0.6.1 · Task 3 — current resident cache entry count gauge.
    pub const CACHE_ENTRIES_CURRENT: &str = "rdap_cache_entries_current";
    /// v0.6.1 · Task 4 — actual delay (computed from backoff +
    /// Retry-After) applied between retry attempts. Distinct from
    /// `rdap_retry_after_seconds`, which only observes the server's
    /// header value.
    pub const RETRY_DELAY_SECONDS: &str = "rdap_retry_delay_seconds";
    /// v0.6.2 · Task 1 — time spent waiting to acquire a concurrency
    /// permit. `kind ∈ {global, per_host}` distinguishes the two
    /// stacked semaphores.
    pub const SEMAPHORE_WAIT_SECONDS: &str = "rdap_semaphore_wait_seconds";
    /// v0.6.2 · Task 2 — accumulated time the per-origin circuit
    /// breaker spent in the Open state (from `closed→open` to
    /// `open→half_open`). Expressed as a counter so dashboards can
    /// `rate()` it for "fraction of wall-clock spent open".
    pub const CIRCUIT_BREAKER_OPEN_SECONDS_TOTAL: &str = "rdap_circuit_breaker_open_seconds_total";
    /// v0.6.2 · Task 3 — observed depth of the per-host semaphore at
    /// the moment a request acquires a permit (`total - available`).
    /// Captures contention without an origin label — the histogram
    /// is global; per-origin cardinality is intentionally not exposed.
    pub const PER_HOST_QUEUE_DEPTH: &str = "rdap_per_host_queue_depth";
    /// v0.6.11 · per-origin inflight gauge. Live count of in-flight
    /// requests per origin. Cardinality is bounded by the per-host
    /// registry cap (≤ 1024 origins) — the gauge is only updated for
    /// fetches that successfully acquire the per-host semaphore, so
    /// a deployment with `per_host_concurrency_limit = None` emits no
    /// labelled series. Operationally complements `PER_HOST_QUEUE_DEPTH`
    /// (which is unlabelled): operators can now see live inflight per
    /// origin in addition to aggregate depth distribution.
    pub const PER_ORIGIN_INFLIGHT: &str = "rdap_per_origin_inflight";
}

// ── Real implementation (feature `enabled`) ────────────────────────────────

#[cfg(feature = "enabled")]
mod imp {
    use super::*;
    use metrics::{counter, gauge, histogram};

    #[inline]
    pub fn record_request(t: QueryType, s: RequestStatus, latency: Duration) {
        counter!(
            names::REQUESTS_TOTAL,
            "type" => t.as_label(),
            "status" => s.as_label(),
        )
        .increment(1);
        histogram!(
            names::LATENCY_SECONDS,
            "type" => t.as_label(),
        )
        .record(latency.as_secs_f64());
    }

    #[inline]
    pub fn record_cache(outcome: CacheOutcome) {
        match outcome {
            CacheOutcome::Fresh => {
                counter!(names::CACHE_HITS_TOTAL, "freshness" => "fresh").increment(1);
            }
            CacheOutcome::Stale => {
                // Stale serves count both as a hit (with freshness="stale")
                // and against the dedicated stale-served counter so dashboards
                // can show "stale serves" without a label query.
                counter!(names::CACHE_HITS_TOTAL, "freshness" => "stale").increment(1);
                counter!(names::CACHE_STALE_SERVED_TOTAL).increment(1);
            }
            CacheOutcome::Miss => {
                counter!(names::CACHE_MISSES_TOTAL).increment(1);
            }
            CacheOutcome::Negative => {
                counter!(names::CACHE_HITS_TOTAL, "freshness" => "negative").increment(1);
            }
        }
    }

    /// Record a retry attempt. `class_label` should be a stable
    /// `&'static str` from the caller's classification enum (see
    /// `rdap-core::error_class::RetryClass::metric_label`).
    #[inline]
    pub fn record_retry(class_label: &'static str, retry_after: Option<Duration>) {
        counter!(names::RETRY_TOTAL, "class" => class_label).increment(1);
        if let Some(d) = retry_after {
            histogram!(names::RETRY_AFTER_SECONDS).record(d.as_secs_f64());
        }
    }

    /// Record an error returned to the caller. `class_label` should be a
    /// stable `&'static str` (see
    /// `rdap-core::error_class::ErrorClass::metric_label`).
    #[inline]
    pub fn record_error(class_label: &'static str) {
        counter!(names::ERRORS_TOTAL, "class" => class_label).increment(1);
    }

    /// Record a slow request. No label — the slow signal is a single
    /// counter so dashboards can plot a clean rate without label arithmetic.
    /// Per-type breakdown should be derived from `rdap_latency_seconds` if
    /// needed.
    #[inline]
    pub fn record_slow_request() {
        counter!(names::SLOW_REQUESTS_TOTAL).increment(1);
    }

    #[inline]
    pub fn inflight_inc() {
        gauge!(names::INFLIGHT_REQUESTS).increment(1.0);
    }

    #[inline]
    pub fn inflight_dec() {
        gauge!(names::INFLIGHT_REQUESTS).decrement(1.0);
    }

    #[inline]
    pub fn observe_circuit_open(origin: &str) {
        counter!(names::CIRCUIT_BREAKER_OPEN_TOTAL, "origin" => origin.to_string()).increment(1);
    }

    /// Sets the circuit-breaker gauge for one origin. Intended to be called
    /// from a `/metrics` scrape handler that walks the registry snapshot,
    /// not from the request hot path.
    #[inline]
    pub fn set_circuit_state(origin: &str, value: CircuitGaugeValue) {
        gauge!(names::CIRCUIT_BREAKER_STATE, "origin" => origin.to_string()).set(value.as_f64());
    }

    #[inline]
    pub fn set_semaphore_utilization(used: u64, total: u64) {
        let v = if total == 0 {
            0.0
        } else {
            used as f64 / total as f64
        };
        gauge!(names::SEMAPHORE_UTILIZATION).set(v);
    }

    /// v0.6.1 · Task 2 — record a circuit-breaker state transition.
    /// `from`/`to` are stable lowercase strings (`closed`/`open`/`half_open`).
    /// The `origin` label is bounded by the breaker registry's 1024 cap.
    #[inline]
    pub fn record_breaker_transition(origin: &str, from: &'static str, to: &'static str) {
        counter!(
            names::CIRCUIT_BREAKER_TRANSITIONS_TOTAL,
            "origin" => origin.to_string(),
            "from" => from,
            "to" => to,
        )
        .increment(1);
    }

    /// v0.6.1 · Task 3 — increment the cache-eviction counter.
    #[inline]
    pub fn record_cache_eviction() {
        counter!(names::CACHE_EVICTIONS_TOTAL).increment(1);
    }

    /// v0.6.1 · Task 3 — set the current cache-entries gauge. Called
    /// from cache mutation paths; cheap (gauge set on every insert /
    /// evict, no atomic loops).
    #[inline]
    pub fn set_cache_entries_current(n: usize) {
        gauge!(names::CACHE_ENTRIES_CURRENT).set(n as f64);
    }

    /// v0.6.1 · Task 4 — observe the actual computed retry delay (after
    /// max(backoff, Retry-After) and the RETRY_AFTER_MAX cap). Distinct
    /// from `record_retry`'s Retry-After histogram, which observes only
    /// the server-supplied hint.
    #[inline]
    pub fn observe_retry_delay(d: Duration) {
        histogram!(names::RETRY_DELAY_SECONDS).record(d.as_secs_f64());
    }

    /// v0.6.2 · Task 1 — record time spent waiting for a permit.
    /// `kind` is a stable `&'static str` (`"global"` or `"per_host"`).
    /// Cardinality bound: 2 series.
    #[inline]
    pub fn observe_semaphore_wait(kind: &'static str, d: Duration) {
        histogram!(names::SEMAPHORE_WAIT_SECONDS, "kind" => kind).record(d.as_secs_f64());
    }

    /// v0.6.2 · Task 2 — accumulate time spent in the Open state for
    /// one origin. Called once per `Open→HalfOpen` transition with
    /// the elapsed open duration.
    ///
    /// Resolution: **whole seconds** (truncating). The `metrics` 0.23
    /// counter API takes `u64` only, so sub-second precision is lost.
    /// This is acceptable because the default breaker cooldown is
    /// 30 s — typical open windows are tens of seconds. Operators
    /// reading this counter for fractional analysis should compute
    /// `rate(...)` over a multi-minute window.
    #[inline]
    pub fn add_breaker_open_duration(origin: &str, d: Duration) {
        let secs = d.as_secs();
        if secs == 0 {
            // Sub-second open windows are rare (would mean failure threshold
            // hit and cooldown elapsed in < 1 s) and would otherwise
            // increment by 0, polluting the rate with an empty event.
            return;
        }
        counter!(
            names::CIRCUIT_BREAKER_OPEN_SECONDS_TOTAL,
            "origin" => origin.to_string(),
        )
        .increment(secs);
    }

    /// v0.6.2 · Task 3 — observe the current per-host semaphore queue
    /// depth (`total_permits - available_permits`) at the moment a
    /// request acquires its permit.
    #[inline]
    pub fn observe_per_host_queue_depth(depth: usize) {
        histogram!(names::PER_HOST_QUEUE_DEPTH).record(depth as f64);
    }

    /// v0.6.11 — increment the per-origin inflight gauge by 1. Called
    /// by the fetcher *after* the per-host semaphore permit is
    /// successfully acquired. Cardinality is bounded by the per-host
    /// registry cap (≤ 1024 origins).
    #[inline]
    pub fn inflight_origin_inc(origin: &str) {
        gauge!(names::PER_ORIGIN_INFLIGHT, "origin" => origin.to_string()).increment(1.0);
    }

    /// v0.6.11 — decrement the per-origin inflight gauge by 1. Called
    /// from `OriginInflightGuard::drop` in the fetcher, ensuring every
    /// success / retry / error exit path balances the inc.
    #[inline]
    pub fn inflight_origin_dec(origin: &str) {
        gauge!(names::PER_ORIGIN_INFLIGHT, "origin" => origin.to_string()).decrement(1.0);
    }
}

// ── No-op stubs (feature `enabled` off) ────────────────────────────────────

#[cfg(not(feature = "enabled"))]
mod imp {
    use super::*;

    #[inline(always)]
    pub fn record_request(_t: QueryType, _s: RequestStatus, _latency: Duration) {}
    #[inline(always)]
    pub fn record_cache(_outcome: CacheOutcome) {}
    #[inline(always)]
    pub fn record_retry(_class_label: &'static str, _retry_after: Option<Duration>) {}
    #[inline(always)]
    pub fn record_error(_class_label: &'static str) {}
    #[inline(always)]
    pub fn record_slow_request() {}
    #[inline(always)]
    pub fn inflight_inc() {}
    #[inline(always)]
    pub fn inflight_dec() {}
    #[inline(always)]
    pub fn observe_circuit_open(_origin: &str) {}
    #[inline(always)]
    pub fn set_circuit_state(_origin: &str, _value: CircuitGaugeValue) {}
    #[inline(always)]
    pub fn set_semaphore_utilization(_used: u64, _total: u64) {}
    #[inline(always)]
    pub fn record_breaker_transition(_origin: &str, _from: &'static str, _to: &'static str) {}
    #[inline(always)]
    pub fn record_cache_eviction() {}
    #[inline(always)]
    pub fn set_cache_entries_current(_n: usize) {}
    #[inline(always)]
    pub fn observe_retry_delay(_d: Duration) {}
    #[inline(always)]
    pub fn observe_semaphore_wait(_kind: &'static str, _d: Duration) {}
    #[inline(always)]
    pub fn add_breaker_open_duration(_origin: &str, _d: Duration) {}
    #[inline(always)]
    pub fn observe_per_host_queue_depth(_depth: usize) {}
    #[inline(always)]
    pub fn inflight_origin_inc(_origin: &str) {}
    #[inline(always)]
    pub fn inflight_origin_dec(_origin: &str) {}
}

pub use imp::*;
