# RDAPify — Service Level Objectives

> **Stage D · D5.** Defines the availability and latency targets the engine
> commits to, the metrics that measure them, and the alerting rules that
> protect them. Operational warning thresholds (more conservative than the
> SLO) live in [`MONITORING.md`](./MONITORING.md).

These targets describe the **engine itself** — the latency and error rate
between the public `RdapClient::lookup_*` entry point and the value returned
to the caller. Network conditions reaching upstream RDAP servers are out of
scope; SLO accounting is over the engine's own success / latency, conditional
on the upstream being reachable. Cache hits count as successful queries with
the latency they actually exhibit (typically sub-millisecond).

---

## 1. Availability

| SLI            | Target          | Window | Source metric                                             |
|----------------|-----------------|--------|-----------------------------------------------------------|
| Success rate   | **≥ 99 %**      | 30 d   | `rdap_requests_total{status="success"} / rdap_requests_total` |

A request counts as **successful** if the engine returns a parsed RDAP
response to the caller. A 4xx upstream response that the engine surfaces
unchanged is *not* a success — but it also **does not move the circuit
breaker** (see `is_breaker_failure`), so a noisy registry that 404s a lot
will not cause cascading failures.

---

## 2. Latency

Targets are measured at the public `RdapClient` boundary. Buckets used for
`rdap_latency_seconds` are
`[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]`.

| SLI            | Target           | Notes                              |
|----------------|------------------|------------------------------------|
| **p50**        | **< 50 ms**      | Cache-hit dominated                |
| **p95**        | **< 300 ms**     | Includes one upstream attempt      |
| **p99**        | **< 1 s**        | Allows one retry on transient err  |

PromQL:

```promql
# p50 latency for domain queries over the last 5 minutes
histogram_quantile(0.50, sum by (le, type) (rate(rdap_latency_seconds_bucket[5m])))

# p95 across all query types
histogram_quantile(0.95, sum by (le)       (rate(rdap_latency_seconds_bucket[5m])))

# p99
histogram_quantile(0.99, sum by (le)       (rate(rdap_latency_seconds_bucket[5m])))
```

Slow-request signal — `rdap_slow_requests_total` — counts requests above
`MetricsConfig.slow_request_threshold_ms` (default **500 ms**, deliberately
above the p95 target so the counter only ticks on outliers worth seeing).

---

## 3. Error budget

- **Budget:** 1 % of total queries / 30 d.
- **Burn rate alert:** trigger on a 5-minute burn rate above 14.4× (the
  Google SRE long-window rule for 1-hour exhaustion).

PromQL:

```promql
# Hourly burn rate (errors / total)
rate(rdap_errors_total[1h]) / rate(rdap_requests_total[1h])

# Burn rate over 5m at 14.4× alert threshold
( rate(rdap_errors_total[5m]) / rate(rdap_requests_total[5m]) ) > (14.4 * 0.01)
```

`CircuitOpen` errors **count toward the budget** — the breaker tripping
means users see failures, regardless of whose fault the underlying
unhealthiness is.

---

## 4. Alerts (design)

The alerting design has three tiers. Tier 1 pages on-call; Tier 2 emails
the team; Tier 3 logs only. **Counters and labels described here are part
of the public Prometheus contract — see DECISIONS D-008.**

### 4.1 Tier 1 — Page on-call (engine-down territory)

- **Sustained error spike**
  ```promql
  ( sum(rate(rdap_errors_total[5m]))
  / sum(rate(rdap_requests_total[5m])) ) > 0.05
  ```
  Fires when the rolling 5-minute error rate exceeds 5× the SLO ceiling.

- **Inflight saturation**
  ```promql
  rdap_inflight_requests >= 0.95 * rdap_semaphore_utilization_total
  ```
  (Compose against your concurrency cap; the gauge `rdap_inflight_requests`
  approaches the configured `concurrency_limit` only under sustained
  upstream slowness.)

### 4.2 Tier 2 — Notify team (degradation)

- **Multi-origin breaker open**
  ```promql
  count by () (rdap_circuit_breaker_state == 1) > 2
  ```
  More than two upstream registries simultaneously in Open is unusual;
  worth a look.

- **Retry surge (5xx)**
  ```promql
  rate(rdap_retry_total{class="http_5xx"}[5m])
    > 3 * avg_over_time(rate(rdap_retry_total{class="http_5xx"}[5m])[1h:5m])
  ```
  3× the recent average — symptomatic of an upstream incident.

- **p95 above SLO for ≥ 10 m**
  ```promql
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m]))) > 0.300
  ```
  Continuous 10 minutes is the alert dwell.

### 4.3 Tier 3 — Log only

- **Slow-request rate climbing**
  ```promql
  rate(rdap_slow_requests_total[5m]) > 1
  ```
  More than one slow request per second is worth a daily summary.

- **Single-origin breaker open**
  ```promql
  rdap_circuit_breaker_state == 1
  ```
  One registry having a bad day is normal; surface it for context but
  don't page.

---

## 5. What's deliberately *not* an SLI

- **Cache hit rate**: a property of workload, not the engine. Tracked
  for ops insight (`rdap_cache_hits_total / (rdap_cache_hits_total + rdap_cache_misses_total)`)
  but not held to a target.
- **Retry count per request**: bounded structurally (`max_attempts`
  default 3); excessive retries surface as latency.
- **Circuit-breaker open count**: a *signal*, not an SLI — registries are
  expected to occasionally misbehave, and the breaker is what protects
  the SLO when they do.

---

## 6. Reporting

- **Daily SRE digest**: 24-hour error budget consumption, p95/p99 trend.
- **Weekly review**: 7-day burn rate, longest stretches above p95, per-class
  error breakdown.
- **30-day report**: full SLO compliance vs. budget; rolled into the engine
  release notes for the next minor version.

---

## 7. Real-world validation

> The targets in §1–§3 were derived from the Stage E load test
> (single-origin saturation, synthetic queries). Production traffic
> is more diverse. **Validate the targets against your traffic
> before signing them as a contract.** This section says how.

### 7.1 The 30-day baseline

Once metrics have been emitting for a full 30 days, run each SLI's
baseline query and compare to the target. Targets that come back
significantly tighter than your steady-state should be **loosened**;
targets you can't meet today should be **investigated, not
relaxed**.

```promql
# 30-day p95 latency baseline (compare to ≤ 300 ms target).
quantile_over_time(0.95,
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[30d:5m]
)

# 30-day error rate baseline (compare to ≤ 1 % target).
quantile_over_time(0.95,
  (sum(rate(rdap_errors_total[5m]))
    / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[30d:5m]
)

# 30-day availability baseline (compare to ≥ 99 % target).
quantile_over_time(0.05,
  (sum(rate(rdap_requests_total{status="success"}[5m]))
    / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[30d:5m]
)
```

### 7.2 Decision matrix

| Observation | What it tells you | Action |
|-------------|-------------------|--------|
| Steady-state p95 = 80 ms; target = 300 ms | Headroom is comfortable | Keep the target — the gap is what protects you on bad days |
| Steady-state p95 = 280 ms; target = 300 ms | One bad day from breaching | Either fix latency or **propose a looser SLO** with stakeholder sign-off; do not silently miss |
| Steady-state error rate = 0.1 %; target = 1 % | 10× headroom | Keep the target; budget burn alerts are doing useful work |
| Steady-state error rate = 0.95 %; target = 1 % | Persistently near ceiling | Investigate dominant `class`; the SLO is correct, the engine isn't healthy |
| 99.9 % availability achieved over 30 d; target = 99 % | Real availability is one tier higher | Consider tightening the SLO (with stakeholder sign-off) |

### 7.3 What "fix latency or relax SLO" means

When steady-state p95 is approaching the SLO ceiling, three options:

1. **Fix the cause.** See [`runbooks/p95-slo.md`](observability/runbooks/p95-slo.md) §2 — usually
   one of: cap too low, cache hit ratio degrading, one query type
   dragging the tail.
2. **Stakeholder-approved SLO change.** Move the target with a
   public note; never silently. Document the change in
   `RDAPify-Internal/DECISIONS.md`.
3. **Accept budget burn.** If the breach is bursty (peak hours
   only), consume the budget knowingly — the budget exists for
   exactly this.

Picking (1) is best, (2) is honest, (3) is fine in moderation.
Doing nothing and hoping is the failure mode.

### 7.4 Workload-specific SLOs

Some workloads have different latency profiles by query type. If a
specific `type` consistently exceeds the global p95 target while
others are well under, consider a **per-type SLO** rather than a
global one:

```promql
histogram_quantile(0.95,
  sum by (le, type) (rate(rdap_latency_seconds_bucket[5m]))
)
```

Per-type targets do not change any metric or alert; they live in
this document and in stakeholder communication. The default is a
single global target — split only when one type's behaviour is
materially different and the difference is stable over weeks.

### 7.5 Validation cadence

| Cadence | Action |
|---------|--------|
| **30 d** (first month) | Baseline all SLIs against §1–§3. File a tuning ticket per gap. |
| **Quarterly** | Re-baseline. Update §1–§3 if traffic mix has shifted significantly. |
| **After a major workload change** (new caller, query mix shift, > 2× growth) | Out-of-cycle re-baseline. |
| **After every major incident** | Confirm the SLO accurately reflected user impact. If not, update §5 ("what's *not* an SLI"). |

### 7.6 Calibration discipline

The discipline for changing thresholds and tracking alert noise
lives in [`observability/CALIBRATION.md`](observability/CALIBRATION.md)
— SLO updates and alert calibration follow the same review process.
A change to either §1, §2, §3, or any alert threshold should:

1. Capture before / after baselines.
2. Reference the incident or analysis that motivated the change.
3. Land as a single PR touching this file *and* the matching
   alert / runbook.
4. Be summarised in the next monthly noise-tracking review.

---

_Last updated: 2026-04-30 — v0.6.5 (added §7 real-world validation)._
_Authority: this document and `RDAPify-Internal/DECISIONS.md` D-008._
