# Adaptive Concurrency Control — Design Proposal

**Status:** Design (NOT IMPLEMENTED)
**Date:** 2026-05-01
**Target release:** post-v0.7.0 (gated on tuning data — see `TUNING_REPORT.md` §F)
**Feature flag:** `adaptive_concurrency` (off by default; zero cost when disabled)

---

## 1. Goal

Dynamically adjust the global `FetcherConfig::concurrency_limit` based on
observed p95 latency and error rate, so the engine self-throttles under
upstream degradation and self-recovers when conditions improve — without
operator intervention and without breaking any existing API.

This is a **closed-loop controller**, not a scheduler change. The existing
global `Arc<Semaphore>` and per-host semaphore registry are preserved; only
the *number of permits on the global semaphore* is varied at runtime.
Per-host limits remain static (out of scope for this design).

---

## 2. Non-goals

- Per-host adaptive control (per-host semaphores stay statically configured).
- Adaptation of timeouts, retry budgets, or backoff (independent levers).
- External-input control (pulling thresholds from Prometheus or a config
  reload). The controller reads in-process counters only.
- Replacement of the existing circuit breaker. Adaptive concurrency *complements*
  the breaker: the breaker is a hard binary gate per origin; adaptive control
  is a soft global throttle.

---

## 3. Constraints (from request)

| Constraint | Mechanism |
|---|---|
| No breaking changes to public API | New optional field with `Default` impl; controller spawned only if explicitly enabled |
| Bounded: min=32, max=512 | Hard clamp inside the controller; cannot be overridden at runtime |
| No oscillation | Asymmetric step (+10/−20) + dual-threshold hysteresis + min-interval-between-adjustments |
| Optional via feature flag | `[features] adaptive_concurrency = []` — controller module gated entirely |
| Zero cost when disabled | Feature-gated module; no spawn, no atomics, no metric registration |

---

## 4. Inputs

| Signal | Source (in-process) | Window |
|---|---|---|
| p95 request latency | rolling reservoir over `rdap_latency_seconds` samples (last 30 s) | 30 s |
| error rate | `rdap_errors_total` / `rdap_requests_total` delta over interval | 30 s |
| current permits available | `Arc<Semaphore>::available_permits()` — used only for the new gauge | instant |

**Why in-process and not Prometheus scrape?**

- Removes a circular dependency on the exporter being up.
- Removes ~50–200 ms of HTTP / parse overhead per evaluation tick.
- Sidesteps cardinality and aggregation surprises in PromQL across labels.

The controller maintains its **own** rolling histogram (separate from the
`metrics` facade) — a 128-bucket exponential reservoir over the last 30 s,
updated from the same callsite that records `rdap_latency_seconds`. Cost:
one `AtomicU64` increment per request when the feature is on.

---

## 5. Control loop

```
every 30 s:
    p95         := percentile(0.95, latency_window)
    error_rate  := errors_delta / max(requests_delta, 1)

    if  samples < MIN_SAMPLES (50)         → skip (cold start guard)
    if  now - last_adjust < MIN_INTERVAL   → skip (anti-flap guard)

    decision := DECIDE(p95, error_rate)
    apply(decision)
```

### Decision rules (with hysteresis)

```
INCREASE  if  p95 < 200 ms  AND  error_rate < 0.5 %
DECREASE  if  p95 > 400 ms  OR   error_rate > 2.0 %
HOLD      otherwise (200 ≤ p95 ≤ 400 ms)
```

The dead zone (200 ms < p95 ≤ 400 ms) is the hysteresis band — the system
neither grows nor shrinks while latency drifts inside it. Combined with the
asymmetric step sizes:

| Direction | Step | Rationale |
|---|---|---|
| INCREASE | +10 | Slow probe upward to find headroom; mistakes here cost only a brief overshoot |
| DECREASE | −20 | Fast retreat under pressure; mistakes here cost only a small under-utilisation |

Net effect: under steady-state mild degradation, the controller will *not*
adjust at all. Under sustained stress, it converges down quickly. Under
sustained good conditions, it ramps up gradually. Asymmetric steps + dead
zone are the standard prescription against oscillation in TCP-style AIMD
controllers; we are not inventing anything new here.

### Min-interval

`MIN_INTERVAL = 30 s` matches the loop period. After any adjustment we wait
at least one full window before re-evaluating, so the next p95 reflects
post-adjustment behaviour.

---

## 6. How the permit count is changed

The existing `Arc<Semaphore>` is **kept alive for the lifetime of the
fetcher**. Replacing the Arc atomically would race with in-flight
`acquire_owned()` calls and is therefore rejected.

The two viable mechanisms:

### A. `Arc<Semaphore>::add_permits(n)` — growth path
Native, lock-free, completes in O(1). Used directly for INCREASE.

### B. `acquire_many_owned(n).forget()` — shrink path
Tokio offers no `Semaphore::reduce_permits` API. To shrink, the controller
spawns one bounded async task that calls
`semaphore.clone().acquire_many_owned(20).await.forget()`. The await
yields until 20 permits are free, then the permits are *forgotten* (never
returned to the pool), effectively reducing capacity by 20.

**Important property:** the shrink is **eventually consistent**. If 100
requests are in flight when the controller decides to shrink by 20, the
shrink does not deny new requests until 20 of those 100 have completed.
This is the correct behaviour — it is gentle and never starves in-flight
work.

The shrink task is single-flight: only one outstanding shrink at a time.
If a second decrease decision arrives while the previous shrink is still
awaiting permits, the new request is **coalesced** (the pending target
permit count is updated; we do not stack tasks).

### Why not AtomicUsize?

An `AtomicUsize` "current limit" value would require every call site to
read it and gate manually, duplicating semaphore semantics and racing
against the existing `Arc<Semaphore>` permits. Mixing two limits is a recipe
for off-by-one and starvation bugs. We use the semaphore's own counter as
the single source of truth.

---

## 7. New surfaces

### Config (additive — backward compatible)

```rust
pub struct FetcherConfig {
    // … existing fields …

    /// Adaptive global-concurrency controller. None = disabled (default).
    /// Off-by-default and feature-gated; absence means the static
    /// `concurrency_limit` applies for the lifetime of the fetcher.
    #[cfg(feature = "adaptive_concurrency")]
    pub adaptive_concurrency: Option<AdaptiveConcurrencyConfig>,
}

#[cfg(feature = "adaptive_concurrency")]
pub struct AdaptiveConcurrencyConfig {
    pub min:                usize,         // clamp floor   — hard min 32
    pub max:                usize,         // clamp ceiling — hard max 512
    pub interval:           Duration,      // default 30 s
    pub p95_increase_below: Duration,      // default 200 ms
    pub p95_decrease_above: Duration,      // default 400 ms
    pub error_increase_below: f64,         // default 0.005
    pub error_decrease_above: f64,         // default 0.02
    pub step_up:            usize,         // default 10
    pub step_down:          usize,         // default 20
    pub min_samples:        usize,         // default 50
}
```

`min` and `max` are **additionally** clamped to `[32, 512]` inside the
controller, regardless of what the caller passed — the operator-supplied
range cannot widen beyond the design envelope.

### Metrics (two new series)

```
# HELP rdap_adaptive_concurrency_current Current permit ceiling chosen by the controller.
# TYPE rdap_adaptive_concurrency_current gauge
rdap_adaptive_concurrency_current 128

# HELP rdap_adaptive_concurrency_adjustments_total Concurrency-limit adjustments.
# TYPE rdap_adaptive_concurrency_adjustments_total counter
rdap_adaptive_concurrency_adjustments_total{direction="up"}   42
rdap_adaptive_concurrency_adjustments_total{direction="down"}  9
rdap_adaptive_concurrency_adjustments_total{direction="hold"} 0   # not emitted; HOLD is a no-op
```

Cardinality: `direction` is a closed enum {up, down}. `hold` is not
emitted. No `origin` label — this controller operates at the global level.

### Lifecycle

The controller is a single tokio task spawned by `Fetcher::with_config`
when `adaptive_concurrency.is_some()`. It receives an `Arc<Semaphore>`
clone and a `Weak<>` handle to the latency reservoir. On `Fetcher::drop`,
the task observes `Weak::upgrade()` returning `None` and exits cleanly.

---

## 8. Failure modes

| # | Failure | Effect | Mitigation |
|---|---|---|---|
| F1 | No samples in window (cold start, idle traffic) | Controller has no signal to act on | Skip tick when `samples < min_samples`; hold previous value |
| F2 | Latency reservoir corrupted (impossible without unsafe; theoretical) | p95 returns garbage | `forbid(unsafe_code)` workspace-wide; reservoir is `AtomicU64` arrays only — no UB path |
| F3 | Controller task panics | Concurrency frozen at last value | Wrap loop in `catch_unwind` equivalent (tokio `JoinHandle::is_finished` watchdog); on panic, log structured `rdap_adaptive_panic` event and respawn once. After second panic, give up and emit a one-shot warning — operator must restart. |
| F4 | `acquire_many_owned` deadlock (never returns) | Pending shrink stuck; growth still works | Wrap shrink in `tokio::time::timeout(2 × interval)`; on timeout, abort the shrink and increment `rdap_adaptive_concurrency_shrink_timeouts_total`. |
| F5 | Operator misconfigures min/max outside [32, 512] | Could starve the engine or remove safety | Hard inner clamp ignores caller-supplied values outside the envelope; emit `tracing::warn!` once at startup |
| F6 | Metric scrape arrives mid-shrink and reads stale `available_permits` | Gauge briefly off by ≤ step_down | Acceptable — the gauge represents *target* capacity and is sampled at metric scrape time, not at adjust time |
| F7 | Both error rate and latency cross thresholds in the *same* direction repeatedly during recovery | Could overshoot during ramp-up | Asymmetric step (+10/−20) and the hysteresis dead zone provide ~3× more headroom on the recovery side than the throttling side; convergence test in §10 must demonstrate this |
| F8 | Rapid alternation just outside the dead zone (p95 = 199 ms ↔ 201 ms) | Same direction every tick — but no flap because INCREASE/HOLD is harmless | INCREASE → HOLD oscillation is benign; the controller never *bounces* between INCREASE and DECREASE because the dead zone is 200 ms wide |
| F9 | Permits leaked elsewhere in the codebase | Effective capacity drifts below configured value | Existing RAII guards (`OriginInflightGuard`, etc.) prevent this; the test suite already asserts no-leak across success / retry / drop paths |
| F10 | Caller passes `concurrency_limit < min` as the static value | Initial state below the floor | Initialise the semaphore to `clamp(static_limit, min, max)` and emit a one-shot warning |

---

## 9. Edge cases

| # | Case | Handling |
|---|---|---|
| E1 | Fetcher dropped while shrink task is awaiting permits | Shrink task holds an `Arc<Semaphore>` clone; the `Weak` handle to the reservoir upgrades to `None` next tick → controller exits → shrink task's permit acquire eventually unblocks (or times out) and the forgotten permits simply disappear with the dropped Arc. No leak. |
| E2 | Caller has *also* set per-host limits | Per-host caps are independent. Adaptive control on the global gate may oversubscribe a small per-host limit, but per-host semaphores correctly enforce their own ceiling — the global limit is an upper bound, not a guaranteed floor for any host. |
| E3 | Burst traffic crosses thresholds within a single 30 s window | At most one adjustment per window; bursts are smoothed by the window boundary. p95 over 30 s naturally absorbs sub-second spikes. |
| E4 | Feature flag off | The entire module is `#[cfg(feature = "adaptive_concurrency")]`; the field on `FetcherConfig` is gated; no symbol leaks; benchmarks against the default build show 0% regression. Verified by `tests/no_overhead_when_disabled.rs`. |
| E5 | Caller mutates the live `Fetcher` (impossible — `&self` only) | N/A — config is captured at construction and is not externally mutable |
| E6 | `min == max` (e.g., operator pins to 64) | Decisions still evaluate but `apply()` clamps to a no-op; counter still increments with `direction="up"` or `"down"` to surface the *intent* — useful for diagnosing why the cap is not moving |
| E7 | All requests fail (100% error rate) → controller wants to shrink | Existing circuit breakers will already be opening per origin, draining the in-flight pool; the controller's shrink completes naturally as breakers reject. No interaction bug. |
| E8 | Latency reservoir contains only one sample (single in-flight request just completed) | `min_samples = 50` guard skips the tick |
| E9 | Sustained latency right at the threshold (e.g., 200.0 ms exactly) | Decision rule uses strict `<` and `>` — equality falls into HOLD. No tie-breaking ambiguity. |
| E10 | Operator queries `concurrency_limit()` at runtime | Returns the live `Arc<Semaphore>` — `available_permits()` reflects current capacity. The static config field is a snapshot of the *initial* value; we do not retroactively rewrite it. Documented in the rustdoc. |

---

## 10. Test strategy

Three integration tests, all under `#[cfg(feature = "adaptive_concurrency")]`:

### T1 — convergence under stable conditions
Inject a latency reservoir feeding stable 80 ms p95 and 0.1% error rate
for 10 simulated windows. Assert: limit increases monotonically by 10
per window until clamped at `max=512`, then holds.

### T2 — reduction under failure spike
Start at 128. Inject 600 ms p95 + 5% error rate for 3 windows. Assert:
limit decreases by 20 per window (128 → 108 → 88 → 68). Then return
inputs to nominal: assert limit recovers gradually (+10/window).

### T3 — no oscillation in dead zone
Drive p95 in a sine wave between 250 ms and 350 ms (entirely inside the
dead zone) for 60 windows. Assert: zero adjustments emitted; counter
remains at 0; `rdap_adaptive_concurrency_current` is constant.

### T4 — no overhead when disabled
A criterion benchmark: `cargo bench --bench fetcher` with default features
(adaptive off) vs an instrumentation harness that asserts zero allocations
and zero atomics specific to the controller. Acceptance: bit-for-bit
identical to the no-feature build.

### T5 — RAII no-leak under shrink contention
Start at 256 permits. Saturate with 256 in-flight long-running requests.
Trigger 5 shrink decisions back-to-back (coalesced to target 156).
Drop the long-running tasks. Assert: `available_permits()` settles
exactly to 156; `rdap_adaptive_concurrency_current = 156`; no permit
leak; no panic.

---

## 11. Open questions (to resolve before implementation)

1. **Reservoir implementation** — is a 128-bucket atomic exponential
   histogram the right shape, or should we steal `metrics-util`'s
   `AtomicBucket` and avoid maintaining a parallel structure? Cost-benefit
   to be measured before commit.
2. **Should adaptation also consider `rdap_inflight_requests`?** A high
   inflight count with low latency suggests headroom is real; with high
   latency it suggests queue buildup. Folding inflight into the decision
   rule would give finer signal — but adds a third dimension to the test
   matrix. Probably a v2 enhancement.
3. **Interaction with `rdapify-pro` rate-limit middleware** — Pro adds
   token-bucket rate limits per tenant. These run *outside* the
   semaphore; they should not interfere, but cross-repo regression
   coverage is needed before Pro adopts the feature.
4. **Telemetry retention** — should we persist the controller's decision
   history (last N adjustments + inputs) for post-incident debug? An
   in-memory ring buffer of 100 entries is cheap; surfacing it requires
   a debug endpoint or a tracing event per decision. Default plan:
   one `tracing::info!` event per non-HOLD decision (rare).

---

## 12. Open Core boundary

This feature lives entirely in **`rdapify-rust/` (Apache-2.0)**. It does
not require, and does not expose hooks for, anything in `rdapify-pro/`.
Pro can opt to enable the same feature flag on its build of `rdap-core`
and gain the same behaviour with no additional integration work.

The observability surface (`rdap_adaptive_concurrency_*` metrics) follows
the existing `rdap_*` prefix discipline established in
`DECISIONS.md` (Stage D metric prefix).

---

## 13. Decision log

This document is a **proposal**. It is not implemented and is not on the
critical path until tuning data from the next observation window
(`TUNING_REPORT.md` §F) demonstrates that static `concurrency_limit=128`
materially under- or over-provisions the engine in production.

If the tuning data shows the static value is correct within ±20%, this
proposal is **deferred** and the freeze rules continue to apply.

---

## See also

- `docs/observability/CALIBRATION.md` — current static concurrency rationale
- `docs/observability/TUNING_REPORT.md` §F — gating data
- `docs/SLO.md` — latency targets that anchor the threshold values
- `docs/PERFORMANCE_SPEC.md` — engine throughput envelope
