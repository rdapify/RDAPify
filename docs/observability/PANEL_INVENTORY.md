# RDAPify — Grafana Panel Inventory

> Inventory of every panel in
> [`grafana-dashboard.json`](grafana-dashboard.json), with the
> question each one answers and a signal-strength classification.
>
> **No panels are removed here.** Removal requires production usage
> data (Grafana panel-view counts or operator-rated low-utility
> entries in [`TUNING_REPORT.md`](TUNING_REPORT.md) §D). This
> inventory exists so the operator filling that report has a
> structured target.

---

## Classification scheme

| Category | Meaning |
|----------|---------|
| **high-signal** | Drives a critical or warning alert directly, *or* is one of the panels INCIDENT.md §2 ("first 5 minutes") points at. Should always be visible on the at-a-glance view. |
| **diagnostic-only** | Decomposition / supporting view used during incident triage. Useful but not the dashboard entry-point. |
| **candidate-for-removal** | _Empty._ A panel can only be moved here after [`TUNING_REPORT.md`](TUNING_REPORT.md) §D shows it was not consulted in any incident in a ≥ 14-day window AND PR review confirms the data isn't needed for trend baselining. |
| **structural** | Grafana row separator (no data). Organisational only. |

Source authority: every classification below is justifiable from the
linked alert (`prometheus-alerts.yaml`) or the incident guide
(`INCIDENT.md`). No production usage data is used.

---

## Inventory

### Top of dashboard

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 99 | Engine health | composite of error rate, p95, inflight (see [`INCIDENT.md`](INCIDENT.md) §1) | Is the engine OK / DEGRADED / FAILING right now? | **high-signal** | Added v0.6.4. The single most-watched panel. |

### Section: Overview — latency & throughput

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 100 | _row: Overview — latency & throughput_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 1 | Latency — p50 / p95 / p99 | `histogram_quantile({0.5,0.95,0.99}, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))` | What is end-to-end query latency right now? | **high-signal** | Drives `RdapifyP95LatencyAboveSlo`, `RdapifyLatencyBudgetFastBurn`, `RdapifyLatencyBudgetSlowBurn`. SLO target 300 ms p95. |
| 2 | Throughput by outcome | `sum by (status) (rate(rdap_requests_total[5m]))` | How many requests / s and what fraction succeed? | **high-signal** | The denominator for error rate and availability calculations. |
| 3 | Error rate | `sum(rate(rdap_errors_total[5m])) / clamp_min(sum(rate(rdap_requests_total[5m])), 1)` | What fraction of requests are failing? | **high-signal** | Drives `RdapifyHighErrorRate`, `RdapifyErrorBudgetFastBurn`, `RdapifyErrorBudgetSlowBurn`. |
| 4 | Errors by class | `sum by (class) (rate(rdap_errors_total[5m]))` | When error rate spikes, *what kind* of error is dominant? | **high-signal** | Entry-point for [`runbooks/high-error-rate.md`](runbooks/high-error-rate.md) §3. Cardinality bound = 6. |

### Section: Cache

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 110 | _row: Cache_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 5 | Cache hit ratio | `sum(rate(rdap_cache_hits_total[5m])) / clamp_min(sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])), 1)` | Is the cache earning its memory? | **high-signal** | Drives `RdapifyCacheHitRatioLow`. Operational target > 70 %. |
| 6 | Cache hits / misses / stale | `sum by (freshness) (rate(rdap_cache_hits_total[5m]))` + misses + stale_served | When hit ratio drops, is it eviction or stale-window pressure? | diagnostic-only | Decomposition of panel 5. |
| 7 | Cache entries (vs max_entries) | `rdap_cache_entries_current` | Is the working set near the cap? | diagnostic-only | Co-drives `RdapifyCacheCapacityPressure` (info). |
| 8 | Cache evictions | `rate(rdap_cache_evictions_total[5m])` | Is the cache thrashing? | diagnostic-only | Co-drives `RdapifyCacheCapacityPressure` (info). |

### Section: Concurrency

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 120 | _row: Concurrency_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 9 | Inflight upstream requests | `rdap_inflight_requests` | Is the engine pinned at its concurrency cap? | **high-signal** | Drives `RdapifyInflightSaturation` (critical). Should return to 0 when traffic stops — non-zero idle = leaked permit. |
| 10 | Semaphore wait p95 | `histogram_quantile(0.95, sum by (le, kind) (rate(rdap_semaphore_wait_seconds_bucket[5m])))` | Are requests queueing inside the engine before any HTTP work? | **high-signal** | Drives `RdapifySemaphoreWaitElevated`. `kind` ∈ {global, per_host}. |
| 11 | Global semaphore utilization | `rdap_semaphore_utilization` | What fraction of permits are in use right now? | diagnostic-only | Snapshot gauge — populated by an operator-side poller (see [`METRICS.md`](METRICS.md) §gauges). May be flat if poller isn't wired. |

### Section: Circuit breaker

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 130 | _row: Circuit breaker_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 12 | Breaker state by origin | `rdap_circuit_breaker_state` | Which upstream origins are Open / HalfOpen / Closed? | **high-signal** | Drives `RdapifySingleBreakerOpen` (info). Even though the alert is info-tier, the panel is the primary triage view in [`runbooks/breaker-open-surge.md`](runbooks/breaker-open-surge.md) §3. |
| 13 | Breaker transitions | `sum by (from, to) (rate(rdap_circuit_breaker_transitions_total[5m]))` | Is recovery clean or are we flapping? | **high-signal** | Drives `RdapifyBreakerFlapping`. `from`/`to` cardinality = 4 valid pairs. |
| 14 | Breaker open time / second (by origin) | `rate(rdap_circuit_breaker_open_seconds_total[5m])` | How much wall-clock per second is each origin's breaker spending Open? | **high-signal** | Drives `RdapifyBreakerOpenSurge` (critical). Threshold > 30 s/s = > 50 % of time Open. |

### Section: Retries

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 140 | _row: Retries_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 15 | Retries by class | `sum by (class) (rate(rdap_retry_total[5m]))` | When retries spike, what failure class is driving them? | **high-signal** | Drives `RdapifyRetrySpike`. `class` ∈ {network, timeout, rate_limited, http_5xx, http_4xx}. |
| 16 | Retry delay distribution | `histogram_quantile({0.5,0.95,0.99}, sum by (le) (rate(rdap_retry_delay_seconds_bucket[5m])))` | How long is the engine actually waiting between retries? | diagnostic-only | Distinct from `rdap_retry_after_seconds` (what upstream asked for). No direct alert. |

### Section: Per-host pressure

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 150 | _row: Per-host pressure_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 17 | Per-host queue depth (heatmap) | `sum by (le) (rate(rdap_per_host_queue_depth_bucket[5m]))` | Are individual upstream origins building queues? | diagnostic-only | No direct alert; informs `per_host_concurrency_limit` sizing. Heatmap reveals depth bands. |

### Section: Slow requests

| panel_id | title | metric / query | question_it_answers | category | notes |
|---|---|---|---|---|---|
| 160 | _row: Slow requests_ | _(none)_ | _(structural)_ | structural | Section divider. |
| 18 | Slow request rate | `rate(rdap_slow_requests_total[5m])` | How many requests per second exceed `slow_request_threshold` (default 500 ms)? | diagnostic-only | Drives `RdapifySlowRequestRising` (info). Leading indicator for `RdapifyP95LatencyAboveSlo`. |

---

## Summary

| Category | Panel count |
|----------|-------------|
| high-signal | 11 |
| diagnostic-only | 7 |
| candidate-for-removal | 0 |
| structural (rows) | 8 |
| **Total** | **26** |

The dashboard ships 18 data panels + 1 stat (Engine health) + 7 row
separators = 26 panels.

---

## How to use this inventory

### During an incident

The "first 5 minutes" of [`INCIDENT.md`](INCIDENT.md) §2 directs the
operator to the **high-signal** panels. The diagnostic-only panels
are consulted from runbook §3 (Verify) once a hypothesis exists.

### During TUNING_REPORT collection

When filling in [`TUNING_REPORT.md`](TUNING_REPORT.md) §D, rate each
runbook's effectiveness in part by whether the panels it pointed
you at gave you the answer. If a runbook frequently sent operators
to a diagnostic-only panel that wasn't actually informative, that
panel becomes a **candidate-for-removal** evidence row in §E.

### Adding a new panel

A new panel must:

1. Answer a question that an existing panel does not already
   answer (avoid duplication).
2. Bind to an alert in [`prometheus-alerts.yaml`](prometheus-alerts.yaml)
   *or* a runbook §3 (Verify) step.
3. Use a metric already in [`METRICS.md`](METRICS.md) — adding a
   panel is **not** an excuse to add a metric.
4. Have a row added here at the same time.

### Removing a panel

Removal requires:

1. A [`TUNING_REPORT.md`](TUNING_REPORT.md) §D row showing the
   panel went unconsulted across every incident in the report's
   window.
2. A §E ledger entry with that §D row as evidence.
3. Approval from a reviewer per [`CALIBRATION.md`](CALIBRATION.md)
   §7 ("When NOT to tune") — added v0.6.6.
4. The panel's row in this inventory updated to **candidate-for-removal**
   in the same PR that proposes the removal.

---

_Last updated: 2026-04-30 (v0.6.6)._
