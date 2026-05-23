//! SLO validation. Pass criteria from the Stage E spec:
//!
//!   - p95 < 300 ms under normal load
//!   - error_rate < 1%
//!   - no unbounded memory growth (trusted to the OS — the harness can't
//!     prove a *negative* memory leak, but it does check that the cache
//!     and breaker registries stayed within their configured caps)
//!   - no retry storms (verify rdap_retry_total stays proportional)
//!   - no circuit flapping (verify rdap_circuit_breaker_open_total stays low)

use crate::stats::Stats;

#[derive(Debug, Clone, Copy)]
pub struct Thresholds {
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
    pub max_error_rate: f64,
    pub min_success_count: u64,
}

impl Thresholds {
    /// Stage E baseline (E1) — cache-warm targets.
    pub const fn e1_baseline() -> Self {
        Self {
            p50_ms: 10.0,
            p95_ms: 50.0,
            p99_ms: 100.0,
            max_error_rate: 0.01,
            min_success_count: 5_000,
        }
    }

    /// Stage E burst (E3) — admit some tail growth under spike.
    pub const fn e3_burst() -> Self {
        Self {
            // Burst latencies are dominated by queueing on the upstream
            // semaphore. p95 below the engine-wide 300 ms target is the
            // real bar; cold-start spread is normal.
            p50_ms: 50.0,
            p95_ms: 300.0,
            p99_ms: 1_000.0,
            max_error_rate: 0.01,
            min_success_count: 1_500,
        }
    }

    /// Stage E cold cache / fan-out (E2) — single-flight collapse means
    /// the FIRST caller per-domain pays upstream latency; followers wake
    /// up after the leader populates the cache, so the median is dominated
    /// by the cache-hit path. p95 should still be below the 300 ms engine
    /// SLO target.
    pub const fn e2_cold_cache() -> Self {
        Self {
            p50_ms: 100.0,
            p95_ms: 300.0,
            p99_ms: 1_000.0,
            max_error_rate: 0.01,
            min_success_count: 100_000,
        }
    }

    /// Stage E upstream-failure (E4) — 50 % 5xx. The breaker should trip
    /// quickly, so most requests after the trip return immediately with
    /// `CircuitOpen` and the **wall-clock** p95 actually drops compared
    /// to a non-breaker baseline. The Stage E spec target is p95 < 500 ms.
    pub const fn e4_upstream_failure() -> Self {
        Self {
            p50_ms: 100.0,
            p95_ms: 500.0,
            p99_ms: 2_000.0,
            // The "error rate" SLO is suspended for E4 by design — the
            // upstream is *deliberately* broken, so the engine's job is
            // to surface failures cleanly, not to mask them. A success
            // rate of ≥ 30 % is plenty (the rest are CircuitOpen + 5xx).
            max_error_rate: 1.0,
            min_success_count: 50,
        }
    }

    /// Stage E rate-limiting (E5) — every upstream response is 429 with
    /// `Retry-After: 2s`. Every query exhausts its retry budget, so
    /// **all** requests "fail" from the caller's POV. The latency floor is
    /// `(max_attempts - 1) × Retry-After`. We're *not* validating fast
    /// completion here — we're validating that the engine waits.
    pub const fn e5_rate_limit() -> Self {
        Self {
            // No upper p50/p95 bound — the test would fail on its own
            // success criterion (long waits). We cap p99 generously and
            // rely on the scenario's `extra_failures` to enforce the
            // *minimum* spacing guarantee.
            p50_ms: 30_000.0,
            p95_ms: 30_000.0,
            p99_ms: 30_000.0,
            max_error_rate: 1.0,
            min_success_count: 0,
        }
    }

    /// Stage E adversarial (E6) — 50 000+ unique domains. Every query is
    /// a cache miss; latency is dominated by the upstream's artificial
    /// delay (1 ms in the harness default). The point of this scenario
    /// is *not* latency but the bounded-data-structure invariant.
    pub const fn e6_adversarial() -> Self {
        Self {
            p50_ms: 50.0,
            p95_ms: 200.0,
            p99_ms: 500.0,
            max_error_rate: 0.01,
            min_success_count: 49_000,
        }
    }
}

#[derive(Debug)]
pub struct Verdict {
    pub passed: bool,
    pub failures: Vec<String>,
}

pub fn validate(stats: &Stats, thresh: Thresholds) -> Verdict {
    let mut failures = Vec::new();
    if stats.success() < thresh.min_success_count {
        failures.push(format!(
            "success count {} below floor {} (the test produced too few completed requests to validate)",
            stats.success(),
            thresh.min_success_count
        ));
    }
    if stats.error_rate() > thresh.max_error_rate {
        failures.push(format!(
            "error_rate {:.4} exceeds {:.4}",
            stats.error_rate(),
            thresh.max_error_rate
        ));
    }
    if stats.p50_ms() > thresh.p50_ms {
        failures.push(format!(
            "p50 {:.2} ms exceeds {:.2} ms",
            stats.p50_ms(),
            thresh.p50_ms
        ));
    }
    if stats.p95_ms() > thresh.p95_ms {
        failures.push(format!(
            "p95 {:.2} ms exceeds {:.2} ms",
            stats.p95_ms(),
            thresh.p95_ms
        ));
    }
    if stats.p99_ms() > thresh.p99_ms {
        failures.push(format!(
            "p99 {:.2} ms exceeds {:.2} ms",
            stats.p99_ms(),
            thresh.p99_ms
        ));
    }
    Verdict {
        passed: failures.is_empty(),
        failures,
    }
}
