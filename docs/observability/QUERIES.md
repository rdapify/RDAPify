# RDAPify — Tuning Queries

> Copy-paste PromQL for every section of [`TUNING_REPORT.md`](TUNING_REPORT.md).
> Each query is grouped by which §-section of the report it populates.
> All queries assume Prometheus is scraping
> [`prometheus-alerts.yaml`](prometheus-alerts.yaml) and the engine's
> `/metrics` endpoint as documented in [`METRICS.md`](METRICS.md).
>
> **Substitute your window length** — every query below uses `[14d]` as
> the default. For 7-day windows replace with `[7d]`. For burn-rate
> alerts, internal sub-windows (`[5m]`, `[1h]`, `[30m]`, `[6h]`) are
> intentional and should not be changed.
>
> **Variables in examples**:
> - `${ALERT}` — replace with an alert name (e.g. `RdapifyHighErrorRate`)
> - `${ORIGIN}` — replace with an origin URL (e.g. `https://rdap.verisign.com:443`)
> - `${WINDOW}` — replace with the report window (`7d` or `14d`)
> - `${SCRAPE}` — replace with the scrape interval (`15` or `30`, in seconds)
>
> **Example values shown in this document are illustrative.** Real
> output will match your workload — see
> [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) for how to
> interpret the numbers, and the *Expected interpretation* note under
> each query.

---

## Index

- [§A · Window scope](#a--window-scope-helpers)
- [§B · Alert evaluation (precision / recall)](#b--alert-evaluation)
- [§C.1 · Latency baselines](#c1--latency-baselines)
- [§C.2 · Error rate / availability](#c2--error-rate--availability)
- [§C.3 · Cache](#c3--cache)
- [§C.4 · Concurrency](#c4--concurrency)
- [§C.5 · Retries](#c5--retries)
- [§C.6 · Breaker](#c6--breaker-open-rate)
- [Cross-cutting helpers](#cross-cutting-helpers)

---

## §A · Window scope helpers

### Confirm engine has been UP for the entire window

```promql
min_over_time(up{job="rdapify"}[${WINDOW}])
```

**Explanation**: `up` is 1 when the scrape succeeded, 0 when it failed.
`min_over_time(...)[${WINDOW}]` returns the worst sample across the
window. **Expected**: `1`. Anything less means there was a scrape
gap — invalidate the window per [`CALIBRATION.md`](CALIBRATION.md)
§7.3 (admissibility) or restrict the window to the contiguous UP
range.

### Total request volume in window

```promql
sum(increase(rdap_requests_total[${WINDOW}]))
```

**Explanation**: total queries served during the window.
**Interpretation**: feeds §A "Average request rate" (divide by window
seconds). If the result is < a few thousand, the alert precision /
recall calculations in §B will be too noisy to trust — extend the
window or accept that the alert set is correctly calibrated for low
volume.

### Average request rate

```promql
sum(rate(rdap_requests_total[${WINDOW}]))
```

**Interpretation**: requests-per-second averaged across the window.
Goes into §A *"Average request rate"*.

### Peak 1-minute request rate

```promql
max_over_time(sum(rate(rdap_requests_total[1m]))[${WINDOW}:1m])
```

**Interpretation**: highest 1-minute average sustained during the
window. Goes into §A *"Peak request rate"*.

---

## §B · Alert evaluation

> The `ALERTS` and `ALERTS_FOR_STATE` series are emitted by Prometheus
> automatically for every rule defined in
> [`prometheus-alerts.yaml`](prometheus-alerts.yaml). They are the
> ground truth for "did the alert fire". Combining them with the
> incident tracker gives precision and recall.
>
> **Real / true_positive / false_positive classification is human work**
> — see [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md). PromQL
> can give you fire counts but cannot decide which fires were real.

### Distinct fires per alert in the window

```promql
sum by (alertname) (
  changes(ALERTS{alertstate="firing"}[${WINDOW}])
)
```

**Explanation**: `changes()` counts the number of times the value
changed during the window. Each transition into the firing state
counts as one fire. **Interpretation**: this is the `fires` column
in §B.

### Total firing time per alert (seconds)

```promql
sum by (alertname) (
  count_over_time(ALERTS{alertstate="firing"}[${WINDOW}])
) * ${SCRAPE}
```

**Explanation**: `count_over_time` returns the number of samples
where the metric was emitted. Multiply by scrape interval to get
wall-clock seconds spent firing. **Interpretation**: divides into the
"average duration per fire" (= total firing seconds / fires count).
Useful for deciding whether to extend `for:` (long average duration
= alerts persist; short = transient firings worth dampening).

### Fires per severity tier

```promql
sum by (severity) (
  changes(ALERTS{alertstate="firing"}[${WINDOW}])
)
```

**Interpretation**: aggregate noise per tier. Goes into §B "tier
summary". Targets: critical ≤ a-handful-per-week, warning ≤ a-few
per day, info untouched.

### Currently-firing alerts (sanity check before tuning)

```promql
ALERTS{alertstate="firing"}
```

**Explanation**: a non-empty result means an alert is firing **right
now**. Per [`CALIBRATION.md`](CALIBRATION.md) §7.4, do not run the
v0.6.7 tuning workflow while any rdapify alert is firing.
**Expected for a clean tuning window**: empty result.

---

## §C.1 · Latency baselines

### Median p95 latency over the window

```promql
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m]
)
```

**Explanation**: outer `quantile_over_time(0.5, ...)` picks the
median sample of the 5-min p95 series across the window. This is the
**typical** p95, not the worst-case.
**Interpretation**: feeds §C.1 "Observed (median)" for p95.
**Expected for a healthy engine**: ≤ 300 ms (the SLO ceiling). If
>300 ms, recall trigger fires — see ALERT_CLASSIFICATION.md.

### Same for p50 and p99

```promql
# p50 typical
quantile_over_time(0.5,
  histogram_quantile(0.50, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m]
)

# p99 typical
quantile_over_time(0.5,
  histogram_quantile(0.99, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m]
)
```

### Worst-case p95 (max sample inside window)

```promql
max_over_time(
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m]
)
```

**Interpretation**: feeds §C.1 "Max" column. The single worst
5-minute window during the report period. Headroom = (300 ms − this).

### p95 latency by query type (find the slow type)

```promql
histogram_quantile(0.95,
  sum by (le, type) (rate(rdap_latency_seconds_bucket[${WINDOW}]))
)
```

**Interpretation**: when the global p95 is healthy but one query
type drags, this query surfaces it. Useful for §C.1 "Comments".

---

## §C.2 · Error rate / availability

### Median error rate over the window

```promql
quantile_over_time(0.5,
  (sum(rate(rdap_errors_total[5m]))
    / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[${WINDOW}:5m]
)
```

**Interpretation**: typical error rate. **Expected**: ≤ 0.01 (1 % SLO).
Feeds §C.2 "Observed (median)".

### Worst 5-minute window — 5th-percentile availability

```promql
quantile_over_time(0.05,
  (sum(rate(rdap_requests_total{status="success"}[5m]))
    / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[${WINDOW}:5m]
)
```

**Explanation**: 5th-percentile of availability ≈ "the worst the
engine looked, ignoring the worst 5 % outliers". A more stable
floor than the absolute minimum. **Interpretation**: feeds §C.2
"Min". Compare against the 99 % SLO target.

### Error rate decomposed by class

```promql
sum by (class) (rate(rdap_errors_total[${WINDOW}]))
  / clamp_min(sum(rate(rdap_requests_total[${WINDOW}])), 1)
```

**Interpretation**: dominant class shows where errors come from.
Goes into §C.2 "Dominant class" and informs `circuit_open` /
`rate_limited` / `network` / `internal` decomposition for incident
postmortems.

### Availability for §C.2 *positive* framing

```promql
sum(rate(rdap_requests_total{status="success"}[${WINDOW}]))
  / clamp_min(sum(rate(rdap_requests_total[${WINDOW}])), 1)
```

**Expected**: ≥ 0.99. Feeds §C.2 "Availability — Observed".

---

## §C.3 · Cache

### Hit ratio over the window

```promql
quantile_over_time(0.5,
  (sum(rate(rdap_cache_hits_total[5m]))
    / clamp_min(sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])), 1))[${WINDOW}:5m]
)
```

**Interpretation**: typical hit ratio across the window. Operational
target > 70 %; alert at < 50 %. Feeds §C.3 "Hit ratio Observed".

### Hits broken down by freshness

```promql
sum by (freshness) (increase(rdap_cache_hits_total[${WINDOW}]))
```

**Interpretation**: `fresh` should dominate; `stale` is SWR; `negative`
is cached 404s. If `negative` rate climbs over time, callers are
feeding the engine bad input — flag in §C.3 "Comments".

### Eviction rate

```promql
quantile_over_time(0.5,
  rate(rdap_cache_evictions_total[5m])[${WINDOW}:5m]
)
```

**Interpretation**: median eviction rate in evictions/second.
Sustained > 0 means working set ≥ cap. Feeds §C.3 "Eviction rate
(r/s)".

### Peak resident entries vs cap

```promql
max_over_time(rdap_cache_entries_current[${WINDOW}])
```

**Interpretation**: divide by your `cache.max_entries` to get the
`peak_entries / cap` ratio for §C.3. Expected: ≤ 1.0. **Note**:
under heavy concurrent insert load, the gauge can briefly read
above cap (transient overshoot — see [`CHANGELOG.md`](../../CHANGELOG.md)
v0.6.6 notes). Use the median, not the max, if your scrape happened
to land on a transient.

---

## §C.4 · Concurrency

### Global semaphore wait p95

```promql
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m])))[${WINDOW}:5m]
)
```

**Expected**: ≤ 100 ms (`RdapifySemaphoreWaitElevated` alert
threshold). Feeds §C.4 "Global wait p95 — Observed".

### Per-host semaphore wait p95

```promql
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="per_host"}[5m])))[${WINDOW}:5m]
)
```

**Interpretation**: advisory; informs `per_host_concurrency_limit`
sizing.

### Inflight peak

```promql
max_over_time(rdap_inflight_requests[${WINDOW}])
```

**Expected**: ≤ 240 (`RdapifyInflightSaturation` alert threshold,
≈ 95 % of the default 256-cap).

### Inflight returns to 0 in idle traffic (leak check)

```promql
min_over_time(rdap_inflight_requests[15m])
```

**Expected**: 0 during any 15-minute idle period in the window.
Non-zero idle = permit leak. Page the engine team.

---

## §C.5 · Retries

### Median retry rate

```promql
quantile_over_time(0.5,
  sum(rate(rdap_retry_total[5m]))[${WINDOW}:5m]
)
```

**Interpretation**: typical retries per second. Feeds §C.5 "Retry
rate (r/s) — Observed".

### Retry amplification (retries per request)

```promql
sum(increase(rdap_retry_total[${WINDOW}]))
  / clamp_min(sum(increase(rdap_requests_total[${WINDOW}])), 1)
```

**Interpretation**: bounded by `max_attempts × avg-retry-prob`.
**Expected**: < 0.3 in a healthy steady state. > 1.0 means we're
retrying more than originally requesting, which usually indicates
upstream is in retry-storm mode. Feeds §C.5 "Retry amplification".

### Dominant retry class

```promql
topk(1, sum by (class) (rate(rdap_retry_total[${WINDOW}])))
```

**Interpretation**: which failure class triggers most retries —
goes into §C.5 "Dominant class". Drives the diagnostic split in
[`runbooks/retry-spike.md`](runbooks/retry-spike.md) §3.

### Retry delay p95

```promql
histogram_quantile(0.95,
  sum by (le) (rate(rdap_retry_delay_seconds_bucket[${WINDOW}]))
)
```

**Interpretation**: how long the engine actually waits between
retries (after `max(backoff_jitter, Retry-After)`). Compare with
upstream's `Retry-After` distribution to see whose hint is binding.

---

## §C.6 · Breaker open rate

### Top origins by open-time-per-second

```promql
topk(5,
  sum by (origin) (rate(rdap_circuit_breaker_open_seconds_total[${WINDOW}]))
)
```

**Interpretation**: each value is "fraction of wall-clock the breaker
was Open". > 30 fires `RdapifyBreakerOpenSurge`. Goes into §C.6
"Top-origin open rate" with the offending origin in §C.6 "Comments".

### Total flap count in window

```promql
  sum(increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[${WINDOW}]))
+ sum(increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[${WINDOW}]))
```

**Interpretation**: total trips (initial + probe-fails). Compare
against `half_open→closed` (clean recoveries) — a healthy ratio is
> 1 (most recoveries are clean). Feeds §C.6 "Total flaps in window".

### Origins ever observed Open in the window

```promql
count(max_over_time(rdap_circuit_breaker_state[${WINDOW}]) >= 1)
```

**Interpretation**: distinct upstreams that had any breaker activity.
Helps decide whether multiple origins were affected (network-egress
issue) or just one (registry-side issue). Feeds §C.6 "Distinct
origins ever Open".

### Recovery rate — `half_open → closed` per origin

```promql
sum by (origin) (
  increase(rdap_circuit_breaker_transitions_total{from="half_open",to="closed"}[${WINDOW}])
)
```

**Interpretation**: clean recoveries by origin. Compare against the
`half_open→open` count for the same origin to spot flap patterns
that are not net recoveries.

---

## Cross-cutting helpers

### Saturation snapshot — "is the engine at any cap right now?"

```promql
max(rdap_inflight_requests) / 256 > bool 0.9
```

**Interpretation**: returns 1 if inflight is > 90 % of the default
cap, else 0. (Replace 256 with your configured `concurrency_limit`.)
Useful as a sanity check before drawing baselines from the window.

### Approximate-budget burn projection (error budget)

```promql
# Burn rate over the window (errors per request).
sum(increase(rdap_errors_total[${WINDOW}]))
  / clamp_min(sum(increase(rdap_requests_total[${WINDOW}])), 1)
```

**Interpretation**: divide by 0.01 (1 % SLO) to get the burn-rate
multiplier. > 1 = budget is burning faster than allowed; sustained
> 14.4 fires `RdapifyErrorBudgetFastBurn`. Feeds the "burn" framing
in §B notes if applicable.

### Cardinality probe — total active series

```promql
count({__name__=~"rdap_.*"})
```

**Interpretation**: total active time series with the `rdap_` prefix.
**Expected**: 50–500 in normal operation. > 1000 implies a
cardinality blowup — investigate. See [`METRICS.md`](METRICS.md)
"Cardinality summary".

### Quick health check — "is the engine producing metrics at all?"

```promql
absent(rdap_requests_total)
```

**Interpretation**: returns 1 if the metric is missing (engine not
scraping or `--features metrics` not on); empty otherwise. **Expected
for a deployed engine**: empty result.

---

## How to use this document

1. **Open Prometheus UI** or `curl /api/v1/query` (see
   [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md)).
2. **Set the `${WINDOW}` and `${SCRAPE}` variables** for your
   deployment.
3. **Run each query under the matching §-section** and paste the
   numeric results into [`TUNING_REPORT.md`](TUNING_REPORT.md).
4. **For any query that returns an unexpected value**, follow the
   interpretation note here, then consult the matching runbook in
   [`runbooks/`](runbooks/).
5. **Real-vs-false-positive classification of fires** belongs in
   [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md), not here.

For an end-to-end checklist, see [`TUNING_WORKFLOW.md`](TUNING_WORKFLOW.md).

---

_Last updated: 2026-04-30 (v0.6.8). All queries assume the metric
set in [`METRICS.md`](METRICS.md) v0.6.6+; no new metrics added in
v0.6.8._
