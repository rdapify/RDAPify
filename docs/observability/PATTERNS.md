# RDAPify — Failure Pattern Index

> Cross-runbook index of common failure shapes. **Built only from
> the runbooks that already exist** — every claim below traces to a
> §2 ("Likely causes"), §3 ("Verify"), or §4 ("Actions") block in
> [`runbooks/`](runbooks/). No production-data extraction has been
> done; that is the job of [`TUNING_REPORT.md`](TUNING_REPORT.md)
> §D once real incident logs accumulate.
>
> **Why this exists.** When an alert fires, the runbook tells you
> what to do for *that* alert. But many incidents fire two or three
> alerts together, and the response is more efficient if you
> recognise the shape — not the alert. Use this index to get from
> "what's the broad category of incident I'm in" to "which
> runbook(s) take me to the cause".

---

## How to use this document

1. The Engine-health panel (or your pager) tells you *something* is
   wrong.
2. Glance at the dashboard's high-signal panels (per
   [`PANEL_INVENTORY.md`](PANEL_INVENTORY.md)).
3. Match what you see to one of the **five shapes** below.
4. Open the listed primary runbook(s) — that's where the diagnostic
   queries live.

---

## Shape 1 — Upstream degradation

The most common acute incident shape: one or more upstream RDAP
registries are unreachable, slow, or failing.

### Description

Errors and / or latency rise together; the dominant `class` is
`circuit_open`, `network`, or `timeout`; one or more breakers go
Open. Cache hits keep flowing for cached entries, but cache-miss
queries either fail fast (breaker Open) or time out (network).

### Signals

- `rdap_errors_total{class="circuit_open"|"network"|"timeout"}` —
  rising rate.
- `rdap_circuit_breaker_state == 1` (Open) — count > 0.
- `rdap_circuit_breaker_open_seconds_total` — `rate()` > 0 for one
  or more origins.
- `rdap_latency_seconds` p95 — climbs because timeouts use the full
  upstream timeout window.
- Cache hit ratio — usually unchanged (cache is engine-side).

### Alerts that fire

- `RdapifyHighErrorRate` (critical)
- `RdapifyBreakerOpenSurge` (critical) — when sustained on one origin
- `RdapifyErrorBudgetFastBurn` (critical) / `RdapifyErrorBudgetSlowBurn` (warning)
- `RdapifySingleBreakerOpen` (info) — when only one origin
- `RdapifyP95LatencyAboveSlo` (warning) — when timeouts dominate

### Primary runbooks

- [`runbooks/high-error-rate.md`](runbooks/high-error-rate.md) — the
  default entry-point (it has the cause-by-class taxonomy).
- [`runbooks/breaker-open-surge.md`](runbooks/breaker-open-surge.md)
  — when one origin's breaker is dominantly Open.
- [`runbooks/breaker-open-info.md`](runbooks/breaker-open-info.md) —
  context for short outages that don't sustain.
- [`runbooks/error-budget-fast-burn.md`](runbooks/error-budget-fast-burn.md)
  — same incident from the budget-burn perspective.

### Typical actions (from runbooks §4)

- Confirm upstream status via the registry's status page.
- Communicate to stakeholders ("queries to .xyz are failing,
  upstream out").
- Let the breaker continue protecting the engine — *do not bypass*.
- If multiple origins are failing simultaneously, escalate to
  network on-call (this is no longer Shape 1).
- File a ticket with the upstream registry operator if their
  outage exceeds 30 minutes.

---

## Shape 2 — Retry amplification

Retries spike — sometimes on their own, often as a leading
indicator of Shape 1.

### Description

`rdap_retry_total` rises faster than its trailing-hour baseline. A
specific `class` dominates and tells you whether the upstream is
returning 5xx, throttling us, or timing out. Engine output is still
mostly correct (retries are bounded by `max_attempts`), but each
request costs more upstream calls.

### Signals

- `rdap_retry_total{class}` — rate ≥ 3× the 1-hour baseline.
- Retry amplification (`retry_total / requests_total`) climbs above
  steady-state.
- `rdap_retry_delay_seconds` p95 — climbs if upstream is hinting
  long `Retry-After` values.
- `rdap_retry_after_seconds` — distribution shifts upward.
- Inflight requests — climbs because each request takes longer.

### Alerts that fire

- `RdapifyRetrySpike` (warning) — primary.
- `RdapifyHighErrorRate` (critical) — if retries exhaust attempts.

### Primary runbooks

- [`runbooks/retry-spike.md`](runbooks/retry-spike.md) — has the
  `class`-by-class diagnostic decomposition.
- [`runbooks/high-error-rate.md`](runbooks/high-error-rate.md) — if
  retries promote into errors.

### Typical actions (from runbooks §4)

- **`http_5xx` dominant** — usually self-resolving upstream blip;
  watch for promotion.
- **`rate_limited` dominant** — drop `concurrency_limit`; ask top
  callers to batch.
- **`network` / `timeout` dominant** — investigate egress (DNS,
  NAT, peering).
- **`http_4xx` dominant** — engine is retrying something it
  shouldn't; file a tuning ticket.

---

## Shape 3 — Concurrency saturation

The engine is queueing on its own caps before any HTTP work can
begin. User-visible p95 latency is inflated by the wait.

### Description

`rdap_inflight_requests` is pinned near `concurrency_limit`. The
global semaphore wait p95 climbs above 100 ms. May be **latency-
bound** (upstream is slow → permits held longer) or **capacity-
bound** (cap is too low for traffic). Per-host queue depth heatmap
shows the breakdown by origin.

### Signals

- `rdap_inflight_requests` — ≥ 95 % of the configured cap.
- `rdap_semaphore_wait_seconds{kind="global"}` p95 > 100 ms.
- `rdap_per_host_queue_depth` — bucket distribution shifts upward.
- `rdap_latency_seconds` p95 — climbs because latency = wait + work.

### Alerts that fire

- `RdapifyInflightSaturation` (critical).
- `RdapifySemaphoreWaitElevated` (warning) — the precursor.
- `RdapifyP95LatencyAboveSlo` (warning) — typically co-fires.
- `RdapifyLatencyBudgetFastBurn` / `RdapifyLatencyBudgetSlowBurn`.

### Primary runbooks

- [`runbooks/inflight-saturation.md`](runbooks/inflight-saturation.md)
  — has the latency-bound vs capacity-bound diagnostic split.
- [`runbooks/semaphore-wait.md`](runbooks/semaphore-wait.md) — the
  warning-tier precursor.
- [`runbooks/p95-slo.md`](runbooks/p95-slo.md) — same incident from
  the latency-SLO angle.

### Typical actions (from runbooks §4)

- **Latency-bound** — Shape 1 in disguise; raising the cap usually
  worsens upstream load. Address the upstream.
- **Capacity-bound** — raise `concurrency_limit` (default 256,
  ceiling 4096), in 2× steps.
- **Permit-leak suspected** — restart the affected pods; page
  engine team; do *not* treat restart as a fix.

---

## Shape 4 — Cache inefficiency

The cache is no longer earning its memory: hit ratio drops, working
set may exceed cap.

### Description

`rdap_cache_hits_total / (hits + misses)` falls below the
operational target. Sometimes accompanied by sustained eviction
rate (working set ≥ cap). Latency rises across the board because
more queries reach upstream.

### Signals

- Cache hit ratio < 50 % (alert) / < 70 % (operational target).
- `rdap_cache_evictions_total` — sustained non-zero rate.
- `rdap_cache_entries_current` — at or near `cache.max_entries`.
- `rdap_cache_hits_total{freshness="fresh"}` — fraction of hits
  shifts toward `stale` or away from `fresh`.

### Alerts that fire

- `RdapifyCacheHitRatioLow` (warning) — primary.
- `RdapifyCacheCapacityPressure` (info) — the precursor.

### Primary runbooks

- [`runbooks/cache-hit-low.md`](runbooks/cache-hit-low.md) — has
  the cause-by-pattern diagnostic.
- [`runbooks/cache-pressure.md`](runbooks/cache-pressure.md) — the
  info-tier precursor when entries-near-cap with active eviction.

### Typical actions (from runbooks §4)

- **Working-set pressure** (entries at cap, evictions non-zero) —
  raise `cache.max_entries`. Doubling is safe; entries are small.
- **TTL too short** — raise `cache.fresh_ttl`.
- **Workload shift** (new caller, scanner pattern) — coordinate
  with the producing service to filter dead inputs.
- **Recent restart** — wait. Cache warms in 10–30 minutes at
  moderate traffic.

---

## Shape 5 — Breaker instability

The engine's breakers are doing their job — but they're flapping
or sustained-Open in a way that signals an upstream pattern problem
rather than a clean outage.

### Description

Either: one breaker spends > 50 % of time Open (Shape 1 sustained,
critical), or breakers cycle Open / HalfOpen / Open quickly without
reaching Closed (flapping — warning). The latter is the worst
pattern from a user perspective: requests sometimes go through,
often fail with `circuit_open`, and there's no clean recovery
signal.

### Signals

- `rdap_circuit_breaker_open_seconds_total` rate > 30 s/s on one
  origin — sustained Open.
- `increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[5m]) + increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[5m]) >= 15` — flapping.
- `rdap_circuit_breaker_state == 1` count — distinct origins Open.
- Compare `from="half_open",to="open"` against `from="half_open",to="closed"`
  — the latter dominates in healthy recovery.

### Alerts that fire

- `RdapifyBreakerOpenSurge` (critical) — sustained Open.
- `RdapifyBreakerFlapping` (warning) — repeated cycle.
- `RdapifySingleBreakerOpen` (info) — for context.

### Primary runbooks

- [`runbooks/breaker-flapping.md`](runbooks/breaker-flapping.md) —
  has the `closed→open` vs `half_open→open` decomposition.
- [`runbooks/breaker-open-surge.md`](runbooks/breaker-open-surge.md)
  — when sustained Open dominates.
- [`runbooks/breaker-open-info.md`](runbooks/breaker-open-info.md)
  — context for normal background noise.

### Typical actions (from runbooks §4)

- **`half_open→open` dominant** — extend the breaker cooldown.
  Default 30 s; for this pattern 60–120 s usually breaks the cycle.
- **`closed→open` dominant** — raise `failure_threshold` (engine
  config).
- **Single origin** — coordinate with that registry's operator.
- **Multiple origins flapping simultaneously** — likely a network
  egress issue on our side; escalate to network on-call.

---

## Shape interactions

Real incidents rarely stay in one shape. Common chains:

| First seen | Often becomes | Reason |
|------------|---------------|--------|
| Shape 2 (Retry amplification) | Shape 1 (Upstream degradation) | Retries exhaust their budget; what was a blip becomes an outage. |
| Shape 1 (Upstream degradation) | Shape 5 (Breaker instability) | After cooldown, HalfOpen probes hit a still-broken upstream. |
| Shape 3 (Concurrency saturation) | Shape 1 (Upstream degradation) — *false* | Latency-bound saturation looks like an outage on the inflight panel. The §3 diagnostic separates the two. |
| Shape 4 (Cache inefficiency) | Shape 3 (Concurrency saturation) | Lower hit ratio → more upstream calls → cap saturates. |

---

## Scope

This index covers the patterns that the v0.6.x runbook set already
documents. As real incidents accumulate, populate
[`TUNING_REPORT.md`](TUNING_REPORT.md) §D ("Runbook Effectiveness")
with field observations. New patterns that recur ≥ 3 times in a
single tuning window become candidate additions to this document
in the next docs-only release.

A pattern is **not** added speculatively. The five shapes above
are the only ones with multi-runbook evidence today.

---

_Last updated: 2026-04-30 (v0.6.6)._
_Authority: derived from [`runbooks/`](runbooks/) §2 / §3 / §4 of each runbook, [`prometheus-alerts.yaml`](prometheus-alerts.yaml), and [`INCIDENT.md`](INCIDENT.md)._
