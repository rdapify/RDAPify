# RDAPify — Metric Reference

> **Purpose**: full reference for every Prometheus metric the engine
> emits, plus the canonical PromQL query for each. Pairs with
> `grafana-dashboard.json` and `prometheus-alerts.yaml` in this directory.
>
> **Canonical naming**: every metric has the `rdap_*` prefix per
> [DECISIONS.md D-008](../../../RDAPify-Internal/DECISIONS.md). Names are
> stable across the 0.6.x release series.
>
> **Emitting the metrics**: enable the engine's `metrics` feature
> (`rdapify` crate) and install the recorder via
> `rdap_metrics::install_recorder(&RecorderConfig::default())` at
> process start. With the feature off, every metric in this document
> compiles to a `#[inline(always)]` no-op.

---

## Cardinality summary

| Label | Bound | Notes |
|---|---|---|
| `type` | 5 | `domain`, `ip`, `asn`, `nameserver`, `entity` |
| `status` | 2 | `success`, `error` |
| `class` (errors) | 6 | `network`, `timeout`, `rate_limited`, `invalid_response`, `circuit_open`, `internal` |
| `class` (retries) | 5 | `network`, `timeout`, `rate_limited`, `http_5xx`, `http_4xx` |
| `freshness` | 3 | `fresh`, `stale`, `negative` |
| `from` / `to` (breaker) | 3 each | `closed`, `open`, `half_open`. Active set capped at 4 transitions |
| `kind` (semaphore) | 2 | `global`, `per_host` |
| `origin` | 1 024 | Bounded by the breaker registry's moka cap. Used by 4 breaker metrics + 1 per-origin inflight metric (added v0.6.11). |

Worst-case total series: ~ 13 000 (dominated by per-origin breaker
metrics × 1024 max origins). Most deployments see 50–100 active series.

---

## Counters

### `rdap_requests_total{type, status}`

| Field | Value |
|---|---|
| Type | counter |
| Labels | `type`, `status` |
| Cardinality | 5 × 2 = 10 |
| Source | `rdap-metrics::hooks::record_request` |
| Meaning | Total RDAP queries served, partitioned by query kind and outcome. **The denominator** for SLO error-rate / availability calculations. |

```promql
# Total request rate
sum(rate(rdap_requests_total[5m]))

# By type
sum by (type) (rate(rdap_requests_total[5m]))

# Availability
sum(rate(rdap_requests_total{status="success"}[5m])) /
clamp_min(sum(rate(rdap_requests_total[5m])), 1)
```

---

### `rdap_errors_total{class}`

| Field | Value |
|---|---|
| Type | counter |
| Labels | `class` ∈ {`network`, `timeout`, `rate_limited`, `invalid_response`, `circuit_open`, `internal`} |
| Cardinality | 6 |
| Source | `rdap-core::error_class::classify_error` (called from fetcher error path) |
| Meaning | Errors returned to the caller, partitioned by semantic class. The mapping from `RdapError` to class is documented in `rdap-core/src/error_class.rs` and is exhaustive (no `_` fallback) — adding a new error variant produces a compile error. |

```promql
# Error rate (the SLO denominator)
sum(rate(rdap_errors_total[5m])) /
clamp_min(sum(rate(rdap_requests_total[5m])), 1)

# By class
sum by (class) (rate(rdap_errors_total[5m]))
```

---

### `rdap_retry_total{class}`

| Field | Value |
|---|---|
| Type | counter |
| Labels | `class` ∈ {`network`, `timeout`, `rate_limited`, `http_5xx`, `http_4xx`} |
| Cardinality | 5 |
| Source | `rdap-metrics::hooks::record_retry` |
| Meaning | Retry attempts, partitioned by the failure class that triggered the retry. Bounded by `max_attempts` × request rate. |

```promql
# Retry rate per class
sum by (class) (rate(rdap_retry_total[5m]))

# Retry amplification (retries per request)
sum(rate(rdap_retry_total[5m])) /
clamp_min(sum(rate(rdap_requests_total[5m])), 1)
```

---

### `rdap_cache_hits_total{freshness}`

| Field | Value |
|---|---|
| Type | counter |
| Labels | `freshness` ∈ {`fresh`, `stale`, `negative`} |
| Cardinality | 3 |
| Source | `rdap-cache::MemoryCache::get_status` (called from client) |
| Meaning | Cache hits served. `fresh` = within TTL. `stale` = within stale window (returned with refresh in flight). `negative` = remembered 404 / NXDOMAIN. |

```promql
# Hit ratio
sum(rate(rdap_cache_hits_total[5m])) /
clamp_min(
  sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])),
  1
)
```

---

### `rdap_cache_misses_total`

| Field | Value |
|---|---|
| Type | counter |
| Labels | _none_ |
| Cardinality | 1 |
| Source | `rdap-cache::MemoryCache::get_status` |
| Meaning | Cache lookups that returned `Miss` (no entry, or fully expired beyond the stale window). |

---

### `rdap_cache_stale_served_total`

| Field | Value |
|---|---|
| Type | counter |
| Labels | _none_ |
| Cardinality | 1 |
| Source | `rdap-cache::MemoryCache::get_status` (stale window arm) |
| Meaning | Stale-while-revalidate hits — value returned to the caller while a background refresh is in flight. |

```promql
# Fraction of hits served stale
sum(rate(rdap_cache_stale_served_total[5m])) /
clamp_min(sum(rate(rdap_cache_hits_total[5m])), 1)
```

---

### `rdap_cache_evictions_total`

| Field | Value |
|---|---|
| Type | counter |
| Labels | _none_ |
| Cardinality | 1 |
| Source | `rdap-cache::MemoryCache` (every eviction path: capacity, expired-on-read, `evict_expired`, `clear`) |
| Meaning | Each eviction increments by 1. Sustained non-zero rate = cache is at the configured capacity. |

```promql
# Steady-state cache pressure
rate(rdap_cache_evictions_total[5m])
```

---

### `rdap_circuit_breaker_open_total{origin}`

| Field | Value |
|---|---|
| Type | counter |
| Labels | `origin` (bounded by registry cap, 1 024) |
| Cardinality | ≤ 1 024 |
| Source | `rdap-core::fetcher` (every closed→open transition) |
| Meaning | Per-origin count of breaker trips. |

```promql
# Trips in the last hour, sorted descending
topk(10, increase(rdap_circuit_breaker_open_total[1h]))
```

---

### `rdap_circuit_breaker_transitions_total{origin, from, to}`

| Field | Value |
|---|---|
| Type | counter |
| Labels | `origin`, `from`, `to` |
| Cardinality | ≤ 1 024 × 4 = 4 096 (4 valid transitions: closed→open, open→half_open, half_open→closed, half_open→open) |
| Source | `rdap-core::fetcher` (pre/post state read around each breaker call) |
| Meaning | Every transition is one increment. Distinguishes recovery (`half_open→closed`) from re-opening (`half_open→open`). |

```promql
# Recovery rate
sum(rate(rdap_circuit_breaker_transitions_total{from="half_open",to="closed"}[5m]))

# Flap detector — closed→open + half_open→open
  sum(increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[5m]))
+ sum(increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[5m]))
```

---

### `rdap_circuit_breaker_open_seconds_total{origin}`

| Field | Value |
|---|---|
| Type | counter (whole seconds, truncating) |
| Labels | `origin` |
| Cardinality | ≤ 1 024 |
| Source | `rdap-core::fetcher` (incremented on `Open→HalfOpen` transition with the elapsed window) |
| Meaning | Cumulative wall-clock seconds the breaker spent Open. Sub-second windows are not recorded — the underlying `metrics` 0.23 counter API is `u64`-only. With the default 30 s cooldown this is a non-issue. |

```promql
# Fraction of the last 5 m the breaker was Open (per origin)
rate(rdap_circuit_breaker_open_seconds_total[5m])
```

---

### `rdap_slow_requests_total`

| Field | Value |
|---|---|
| Type | counter |
| Labels | _none_ (intentional — slow is an aggregate signal) |
| Cardinality | 1 |
| Source | `rdap-core::fetcher` (when elapsed > `slow_request_threshold`, default 500 ms) |
| Meaning | Requests slower than the threshold. Per-type breakdown is available via `rdap_latency_seconds_bucket`. |

```promql
rate(rdap_slow_requests_total[5m])
```

---

## Gauges

### `rdap_inflight_requests`

| Field | Value |
|---|---|
| Type | gauge |
| Labels | _none_ |
| Cardinality | 1 |
| Source | `rdap-core::fetcher` (incremented per HTTP attempt, decremented on every exit including retry-decision sleep) |
| Meaning | Upstream HTTP attempts currently in flight. Approaches `concurrency_limit` under sustained pressure. **Should always return to 0 when traffic stops** — non-zero idle = leaked permit. |

```promql
# Saturation alert
rdap_inflight_requests / 256 > 0.9   # adjust 256 if cap is non-default
```

---

### `rdap_semaphore_utilization`

| Field | Value |
|---|---|
| Type | gauge (0.0–1.0) |
| Labels | _none_ |
| Cardinality | 1 |
| Source | external — operator's scrape handler computes `used / total` and writes via `rdap_metrics::hooks::set_semaphore_utilization` |
| Meaning | Fraction of upstream-concurrency permits in use. The hook exists; wiring it into a periodic poller is the operator's responsibility (one option: tokio interval task that reads `Fetcher::concurrency_limit().available_permits()`). |

```promql
rdap_semaphore_utilization
```

---

### `rdap_circuit_breaker_state{origin}`

| Field | Value |
|---|---|
| Type | gauge (0=Closed, 1=Open, 2=HalfOpen) |
| Labels | `origin` |
| Cardinality | ≤ 1 024 |
| Source | external — operator's scrape handler walks `CircuitBreakerRegistry::snapshot()` and writes via `rdap_metrics::hooks::set_circuit_state` |
| Meaning | Current state per origin. Numeric encoding lets dashboards alert on `>= 1` (Open or HalfOpen). |

```promql
# Number of origins currently Open
count(rdap_circuit_breaker_state == 1)
```

---

### `rdap_cache_entries_current`

| Field | Value |
|---|---|
| Type | gauge |
| Labels | _none_ |
| Cardinality | 1 |
| Source | `rdap-cache::MemoryCache` (set on every mutation: insert, eviction, expiry) |
| Meaning | Current resident entry count. Renders only after the first set; before that, the metric is invisible to Prometheus. |

```promql
# Approaching cap
rdap_cache_entries_current / 1000 > 0.95   # adjust 1000 if cap is non-default
```

---

### `rdap_per_origin_inflight{origin}`

| Field | Value |
|---|---|
| Type | gauge |
| Labels | `origin` |
| Cardinality | ≤ 1 024 (bounded by the per-host registry cap) |
| Source | `rdap-core::fetcher::OriginInflightGuard` — RAII guard incremented after a successful per-host semaphore acquire, decremented on drop (every fetch exit path: success, retry-with-drop, error-final) |
| Meaning | Live count of in-flight upstream HTTP requests per origin. Added v0.6.11. Operationally complements the unlabelled `rdap_per_host_queue_depth` histogram by exposing per-origin instantaneous load. |

**When the gauge is emitted**: only when `per_host_concurrency_limit` is `Some(N)` for the deployed engine. With `per_host = None` (e.g. single-origin synthetic-load tests), no labelled series are produced — the cardinality budget is intentionally tied to per-host gating being active.

**Cardinality control**: the per-host registry caps at 1 024 distinct origins (DashMap soft-bound, fail-open). Origins beyond the cap fall back to the global semaphore alone and emit no per-origin gauge — same fail-open semantics as the breaker family.

```promql
# Live inflight to one specific origin
rdap_per_origin_inflight{origin="https://rdap.verisign.com:443"}

# Top 5 most-loaded origins right now
topk(5, rdap_per_origin_inflight)

# Saturation per origin (vs the per-host cap)
rdap_per_origin_inflight / 16   # adjust 16 if per_host_concurrency_limit is non-default

# Origins approaching their per-host cap
rdap_per_origin_inflight / 16 > 0.9
```

---

## Histograms

### `rdap_latency_seconds{type}`

| Field | Value |
|---|---|
| Type | histogram |
| Labels | `type` (5 values) |
| Source | `rdap-metrics::hooks::record_request` |
| Buckets | `[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]` seconds |
| Meaning | End-to-end request latency at the `RdapClient` boundary (cache + upstream + parse). |

```promql
# p50 / p95 / p99 across all types
histogram_quantile(0.50, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))
histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))
histogram_quantile(0.99, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))

# p95 by type
histogram_quantile(
  0.95,
  sum by (le, type) (rate(rdap_latency_seconds_bucket[5m]))
)
```

---

### `rdap_retry_after_seconds`

| Field | Value |
|---|---|
| Type | histogram |
| Labels | _none_ |
| Source | `rdap-metrics::hooks::record_retry` (when the upstream returned a `Retry-After` header) |
| Buckets | seconds (default histogram buckets) |
| Meaning | Distribution of server-supplied `Retry-After` hints honoured by the engine. Reflects upstream behaviour, not engine waits. |

```promql
histogram_quantile(0.95, sum by (le) (rate(rdap_retry_after_seconds_bucket[5m])))
```

---

### `rdap_retry_delay_seconds`

| Field | Value |
|---|---|
| Type | histogram |
| Labels | _none_ |
| Source | `rdap-core::fetcher` (after computing `max(backoff_jitter, Retry-After)` capped at `RETRY_AFTER_MAX = 60 s`) |
| Buckets | seconds (default histogram buckets) |
| Meaning | What the engine **actually waited** between retries. Distinct from `rdap_retry_after_seconds`, which records only what the upstream asked for. |

```promql
histogram_quantile(0.95, sum by (le) (rate(rdap_retry_delay_seconds_bucket[5m])))
```

---

### `rdap_semaphore_wait_seconds{kind}`

| Field | Value |
|---|---|
| Type | histogram |
| Labels | `kind` ∈ {`global`, `per_host`} |
| Cardinality | 2 |
| Source | `rdap-core::fetcher` (around each `Semaphore::acquire_owned` call) |
| Meaning | Time waiting for a concurrency permit. **The most direct signal of saturation**: high `kind=global` p95 = the global cap is the bottleneck; high `kind=per_host` p95 = per-host cap is the bottleneck for one or more hosts. |

```promql
# Global semaphore wait p95
histogram_quantile(
  0.95,
  sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))
)

# Per-host semaphore wait p95
histogram_quantile(
  0.95,
  sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="per_host"}[5m]))
)
```

---

### `rdap_per_host_queue_depth`

| Field | Value |
|---|---|
| Type | histogram |
| Labels | _none_ (intentional — origin label would explode cardinality across the bucket set) |
| Source | `rdap-core::fetcher` (observed pre-acquire as `total_permits − available_permits`) |
| Meaning | Distribution of per-host semaphore depth at acquire time. A heatmap rendered from this histogram reveals which depth bands are most populated — useful for sizing `per_host_concurrency_limit`. |

```promql
# p95 queue depth
histogram_quantile(0.95, sum by (le) (rate(rdap_per_host_queue_depth_bucket[5m])))
```

Use as a heatmap (Grafana panel id 17 in `grafana-dashboard.json`):

```promql
sum by (le) (rate(rdap_per_host_queue_depth_bucket[5m]))
```

---

## Common compound queries

### Availability (success rate)

```promql
sum(rate(rdap_requests_total{status="success"}[5m]))
/
clamp_min(sum(rate(rdap_requests_total[5m])), 1)
```

### Error rate (1 − availability)

```promql
sum(rate(rdap_errors_total[5m]))
/
clamp_min(sum(rate(rdap_requests_total[5m])), 1)
```

### Cache hit ratio

```promql
sum(rate(rdap_cache_hits_total[5m]))
/
clamp_min(
  sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])),
  1
)
```

### p95 latency

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(rdap_latency_seconds_bucket[5m]))
)
```

### Breaker open rate (per origin)

```promql
rate(rdap_circuit_breaker_open_seconds_total[5m])
```

### Semaphore saturation

```promql
# How long are we waiting on the global cap?
histogram_quantile(
  0.95,
  sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m]))
)

# How many slots are in use?
rdap_inflight_requests / 256   # 256 = concurrency_limit default
```

### Retry storm detection

```promql
# Should be ≤ max_attempts × request rate. Climbing suddenly = storm.
sum(rate(rdap_retry_total[5m]))
/
clamp_min(sum(rate(rdap_requests_total[5m])), 1)
```

### Circuit breaker flap rate

```promql
  sum(increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[5m]))
+ sum(increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[5m]))
```

---

## Operator wiring quickstart

```rust
use rdapify::metrics::{install_recorder, RecorderConfig, MetricsHandle};

#[tokio::main]
async fn main() {
    // Install once at process start.
    let handle: MetricsHandle = install_recorder(&RecorderConfig::default())
        .expect("rdap-metrics recorder installation failed");

    // Mount /metrics on whatever HTTP framework you use:
    // axum:        .route("/metrics", get(move || async { handle.render() }))
    // actix:       .service(web::resource("/metrics").to(|| async { handle.render() }))
    // raw hyper:   ...

    // Run the engine — the metrics fire automatically from the hot paths.
    // ...
}
```

For per-origin gauges and `rdap_semaphore_utilization` (which need an
external poller, since they're snapshots rather than event-driven),
spawn a tokio interval task that walks `Fetcher::breakers().snapshot()`
and `Fetcher::concurrency_limit().available_permits()` once a second
and calls the corresponding hooks.

---

## Versioning of this surface

The metric **names** in this document are stable for the 0.6.x series
(see `RDAPify-Internal/DECISIONS.md` D-008). The metric **set** may
grow in subsequent minor releases; existing names will not be renamed
without a major-version bump.

Bucket boundaries on histograms are **not** part of the stable
contract — operators with strict bucket requirements should configure
buckets explicitly via `RecorderConfig::histogram_buckets`.

Last reviewed: 2026-04-29.
