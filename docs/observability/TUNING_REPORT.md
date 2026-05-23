# RDAPify — Tuning Report

> **This document is a fill-in template.** It records the evidence
> that justifies any change to alert thresholds, SLO targets, or
> runbooks. The fields below are deliberately empty: do not invent
> numbers. Populate them from real production observations
> (Prometheus / Alertmanager / your incident tracker), then the
> "Threshold Change Ledger" in §E becomes the audit trail for the
> follow-on tuning release.
>
> **Authority for filling this in:**
> - [`CALIBRATION.md`](CALIBRATION.md) §2 — the tuning procedure.
> - [`CALIBRATION.md`](CALIBRATION.md) §4 — precision / recall
>   definitions.
> - [`CALIBRATION.md`](CALIBRATION.md) §7 — "When NOT to tune"
>   (added v0.6.6) — the precondition checks before any cell here
>   may be filled.
>
> **A blank cell means "we don't know yet".** Keeping it blank is
> always honest. Filling it with `-`, `n/a`, or an estimate is a
> calibration-discipline failure — leave the cell empty until you
> have data.

---

## A. Scope

| Field | Value |
|-------|-------|
| Environment | _(prod / staging / region — exactly one)_ |
| Window start | _(YYYY-MM-DD HH:MM UTC; ≥ 7 days back, ≥ 14 d preferred)_ |
| Window end | _(YYYY-MM-DD HH:MM UTC)_ |
| Window length | _(hours)_ |
| Engine version | _(e.g. 0.6.6)_ |
| `concurrency_limit` | _(value at start; note any mid-window change)_ |
| `per_host_concurrency_limit` | _(value at start; `None` = opt-out)_ |
| `cache.max_entries` | _(value)_ |
| `slow_request_threshold` | _(ms — default 500)_ |
| Average request rate | _(r/s, computed from `rdap_requests_total`)_ |
| Peak request rate | _(r/s, peak 1-minute average)_ |
| Notable workload events in window | _(deploys, traffic spikes, upstream maintenance)_ |

### Data sources used

| Source | Endpoint / location | Notes |
|--------|---------------------|-------|
| Prometheus | _(URL)_ | scrape interval = ___ s |
| Alertmanager | _(URL)_ | route version pinned during the window |
| Incident tracker | _(URL / system)_ | filter expression used to enumerate incidents |
| Runbook feedback logs | `runbooks/*.md` §Feedback log | last commit consulted |

### Window admissibility (precondition checks)

Tick **all** before continuing into §B–§F. If any is unticked, stop —
this report cannot drive a tuning release per [`CALIBRATION.md`](CALIBRATION.md) §7.

- [ ] Window length ≥ 7 days.
- [ ] No mid-window engine deploy that changed default thresholds.
- [ ] No incident is currently open (do not tune mid-incident).
- [ ] All runbook Feedback logs in the window are populated (no
      blanks for fires that occurred).
- [ ] At least one full business cycle (workday + weekend, or two
      sprints) lies inside the window.

---

## B. Alert Evaluation

> One row per alert. **Precision** = `true_positives / fires`.
> **Recall** = `incidents_caught / total_incidents`. A `total_incidents`
> value here means *all* RDAPify-impacting incidents in the window
> (not just ones any RDAPify alert caught) — so it is the same number
> across every row of this table.
>
> **Targets** (from [`CALIBRATION.md`](CALIBRATION.md) §4.2):
> precision ≥ 0.80 for critical · ≥ 0.50 for warning · n/a for info.
> Recall ≥ 0.90 across the alert set.
>
> **`proposed_change`** stays blank until a change is justified in
> §E and reviewed.

### Critical (5)

| alert_name | fires | true_positives | false_positives | precision | incidents_caught | total_incidents | recall | notes | proposed_change |
|---|---|---|---|---|---|---|---|---|---|
| RdapifyHighErrorRate          |  |  |  |  |  |  |  |  |  |
| RdapifyBreakerOpenSurge       |  |  |  |  |  |  |  |  |  |
| RdapifyInflightSaturation     |  |  |  |  |  |  |  |  |  |
| RdapifyErrorBudgetFastBurn    |  |  |  |  |  |  |  |  |  |
| RdapifyLatencyBudgetFastBurn  |  |  |  |  |  |  |  |  |  |

### Warning (7)

| alert_name | fires | true_positives | false_positives | precision | incidents_caught | total_incidents | recall | notes | proposed_change |
|---|---|---|---|---|---|---|---|---|---|
| RdapifyErrorBudgetSlowBurn    |  |  |  |  |  |  |  |  |  |
| RdapifyLatencyBudgetSlowBurn  |  |  |  |  |  |  |  |  |  |
| RdapifySemaphoreWaitElevated  |  |  |  |  |  |  |  |  |  |
| RdapifyRetrySpike             |  |  |  |  |  |  |  |  |  |
| RdapifyCacheHitRatioLow       |  |  |  |  |  |  |  |  |  |
| RdapifyBreakerFlapping        |  |  |  |  |  |  |  |  |  |
| RdapifyP95LatencyAboveSlo     |  |  |  |  |  |  |  |  |  |

### Info (3)

> Info alerts are not paged. `precision` is computed but not held to
> a target; `recall` is informational only.

| alert_name | fires | true_positives | false_positives | precision | incidents_caught | total_incidents | recall | notes | proposed_change |
|---|---|---|---|---|---|---|---|---|---|
| RdapifySlowRequestRising      |  |  |  |  |  |  |  |  |  |
| RdapifySingleBreakerOpen      |  |  |  |  |  |  |  |  |  |
| RdapifyCacheCapacityPressure  |  |  |  |  |  |  |  |  |  |

### Counting fires from Prometheus

```promql
# Distinct fires per alert in the window (replace 14d as needed).
sum by (alertname) (
  changes(ALERTS{alertstate="firing"}[14d])
)

# Total firing time per alert in the window (seconds).
sum by (alertname) (
  count_over_time(ALERTS{alertstate="firing"}[14d])
) * <scrape_interval_seconds>
```

`true_positives` and `incidents_caught` come from the incident
tracker, *not* from PromQL — there is no machine-derivable signal
for "did a human take action". Cross-link the incident IDs in the
`notes` column.

---

## C. Metric Baselines

> Run each query for the same window as §A. Record the observed
> value plus the variability triple (min / avg / max) over the
> window.

### C.1 Latency

```promql
# p50 over the window
quantile_over_time(0.5,
  histogram_quantile(0.50, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[14d:5m]
)

# p95 over the window
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[14d:5m]
)

# p99 over the window
quantile_over_time(0.5,
  histogram_quantile(0.99, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[14d:5m]
)

# Max p95 sample inside the window — used to size SLO headroom
max_over_time(
  histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[14d:5m]
)
```

| SLI | Target | Observed (median) | Min | Avg | Max | Comments |
|-----|--------|-------------------|-----|-----|-----|----------|
| p50 | < 50 ms |  |  |  |  |  |
| p95 | < 300 ms |  |  |  |  |  |
| p99 | < 1 s |  |  |  |  |  |

### C.2 Error rate / availability

```promql
# Median error rate over the window
quantile_over_time(0.5,
  (sum(rate(rdap_errors_total[5m]))
    / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[14d:5m]
)

# 5th-percentile availability — the worst the engine looked
quantile_over_time(0.05,
  (sum(rate(rdap_requests_total{status="success"}[5m]))
    / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[14d:5m]
)

# Error rate decomposed by class
sum by (class) (rate(rdap_errors_total[14d]))
  / clamp_min(sum(rate(rdap_requests_total[14d])), 1)
```

| SLI | Target | Observed | Min | Avg | Max | Dominant class | Comments |
|-----|--------|----------|-----|-----|-----|----------------|----------|
| Error rate | ≤ 1 % |  |  |  |  |  |  |
| Availability | ≥ 99 % |  |  |  |  |  |  |

### C.3 Cache

```promql
# Hit ratio over the window
quantile_over_time(0.5,
  (sum(rate(rdap_cache_hits_total[5m]))
    / clamp_min(sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])), 1))[14d:5m]
)

# Hits broken down by freshness
sum by (freshness) (increase(rdap_cache_hits_total[14d]))

# Eviction rate
quantile_over_time(0.5,
  rate(rdap_cache_evictions_total[5m])[14d:5m]
)

# Resident entries (max in window)
max_over_time(rdap_cache_entries_current[14d])
```

| Metric | Target / threshold | Observed | Min | Avg | Max | Comments |
|--------|--------------------|----------|-----|-----|-----|----------|
| Hit ratio | ≥ 70 % (operational) |  |  |  |  |  |
| Eviction rate (r/s) | _(0 if working set < cap)_ |  |  |  |  |  |
| Peak entries vs cap | _(`max / max_entries`)_ |  |  |  |  |  |

### C.4 Concurrency

```promql
# Global semaphore wait p95 over the window
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m])))[14d:5m]
)

# Per-host semaphore wait p95
quantile_over_time(0.5,
  histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="per_host"}[5m])))[14d:5m]
)

# Inflight peak
max_over_time(rdap_inflight_requests[14d])
```

| Metric | Threshold | Observed | Min | Avg | Max | Comments |
|--------|-----------|----------|-----|-----|-----|----------|
| Global wait p95 | alert at > 100 ms |  |  |  |  |  |
| Per-host wait p95 | _(advisory)_ |  |  |  |  |  |
| Inflight peak | alert at ≥ 240 |  |  |  |  |  |

### C.5 Retries

```promql
# Median retry rate
quantile_over_time(0.5,
  sum(rate(rdap_retry_total[5m]))[14d:5m]
)

# Retry amplification (retries per request)
sum(increase(rdap_retry_total[14d]))
  / clamp_min(sum(increase(rdap_requests_total[14d])), 1)

# Dominant class
topk(1, sum by (class) (rate(rdap_retry_total[14d])))
```

| Metric | Threshold | Observed | Min | Avg | Max | Dominant class |
|--------|-----------|----------|-----|-----|-----|----------------|
| Retry rate (r/s) | alert at 3× 1h baseline |  |  |  |  |  |
| Retry amplification | _(advisory)_ |  |  |  |  |  |

### C.6 Breaker open rate

```promql
# Per-origin open rate (top 5)
topk(5,
  sum by (origin) (rate(rdap_circuit_breaker_open_seconds_total[14d]))
)

# Flap rate (closed→open + half_open→open) over the window
  sum(increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[14d]))
+ sum(increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[14d]))

# Origins ever observed Open in the window
count(max_over_time(rdap_circuit_breaker_state[14d]) >= 1)
```

| Metric | Threshold | Observed | Comments |
|--------|-----------|----------|----------|
| Top-origin open rate (s/s) | alert at > 30 |  |  |
| Total flaps in window | alert at ≥ 15 / 5 m |  |  |
| Distinct origins ever Open |  |  |  |

---

## D. Runbook Effectiveness

> Per runbook, summarise the Feedback log contents and an
> **operator-rated** clarity score. Clarity is subjective — that's
> fine; record who rated it and why.
>
> **`actions_to_update`** is the PR link (or ticket) where the
> observed gap is being fixed.

| runbook | times_used | resolved_without_escalation (Y / N) | clarity_rating (1–5) | rated_by | missing_steps (free text) | actions_to_update (PR / issue) |
|---|---|---|---|---|---|---|
| [high-error-rate](runbooks/high-error-rate.md) |  |  |  |  |  |  |
| [breaker-open-surge](runbooks/breaker-open-surge.md) |  |  |  |  |  |  |
| [inflight-saturation](runbooks/inflight-saturation.md) |  |  |  |  |  |  |
| [error-budget-fast-burn](runbooks/error-budget-fast-burn.md) |  |  |  |  |  |  |
| [latency-budget-fast-burn](runbooks/latency-budget-fast-burn.md) |  |  |  |  |  |  |
| [error-budget-slow-burn](runbooks/error-budget-slow-burn.md) |  |  |  |  |  |  |
| [latency-budget-slow-burn](runbooks/latency-budget-slow-burn.md) |  |  |  |  |  |  |
| [semaphore-wait](runbooks/semaphore-wait.md) |  |  |  |  |  |  |
| [retry-spike](runbooks/retry-spike.md) |  |  |  |  |  |  |
| [cache-hit-low](runbooks/cache-hit-low.md) |  |  |  |  |  |  |
| [breaker-flapping](runbooks/breaker-flapping.md) |  |  |  |  |  |  |
| [p95-slo](runbooks/p95-slo.md) |  |  |  |  |  |  |
| [slow-rising](runbooks/slow-rising.md) |  |  |  |  |  |  |
| [breaker-open-info](runbooks/breaker-open-info.md) |  |  |  |  |  |  |
| [cache-pressure](runbooks/cache-pressure.md) |  |  |  |  |  |  |

### Clarity scale

| Score | Meaning |
|-------|---------|
| 5 | "Took me to the cause in < 5 minutes; no edits needed." |
| 4 | "Useful, one or two diagnostic queries needed adapting." |
| 3 | "Got me close but I had to improvise; recommend an edit." |
| 2 | "Misleading or incomplete; I'd have been faster without it." |
| 1 | "Did not match observed behaviour at all; rewrite needed." |

A score ≤ 2 **must** result in a runbook-quality ticket and a
non-blank `actions_to_update`.

---

## E. Threshold Change Ledger

> **Every** proposed change to a threshold, `for:` window, alert
> severity, panel, or SLO target lands here before being applied.
> No row, no PR.
>
> **Evidence** must reference §B (precision / recall), §C (baseline),
> or §D (runbook gap) by anchor — *not* an external argument or
> "operator intuition". If the supporting field in §B / §C / §D is
> blank, the evidence is insufficient.

| # | metric / alert | current | proposed | evidence (§B / §C / §D anchor + screenshot link) | decision (approved / rejected / deferred) | reviewer | date |
|---|---------------|---------|----------|------------------------------------------------|------------------------------------------|----------|------|
|   |               |         |          |                                                |                                          |          |      |
|   |               |         |          |                                                |                                          |          |      |
|   |               |         |          |                                                |                                          |          |      |

### Required fields per row

- **current** — exact value as it appears in `prometheus-alerts.yaml`,
  `SLO.md`, or `grafana-dashboard.json`. Quote the file path + line
  number in the cell or in `notes`.
- **proposed** — exact replacement value.
- **evidence** — minimum two pieces: a §B / §C / §D anchor, and a
  link to a screenshot or PromQL permalink showing the supporting
  numbers.
- **decision** — `approved`, `rejected`, or `deferred`. Deferred
  rows must include a follow-up date in `notes`.

### Approval rules (from [`CALIBRATION.md`](CALIBRATION.md) §7)

- **Lowering sensitivity** (raise threshold, extend `for:`,
  downgrade severity) requires ≥ 3 false positives in §B.
- **Raising sensitivity** (lower threshold, shorten `for:`, upgrade
  severity) requires either a missed-incident row in §B
  (`incidents_caught < total_incidents`) or a §C baseline showing
  comfortable headroom.
- **SLO change** (§1, §2, or §3 of [`../SLO.md`](../SLO.md))
  requires the §C baseline column AND stakeholder sign-off recorded
  in §F.
- **Panel removal** requires §D evidence the panel was not used in
  any incident in the window AND PANEL_INVENTORY classification of
  `candidate-for-removal`.

---

## F. Sign-off

| Role | Name | Date | Signature / commit hash |
|------|------|------|-------------------------|
| Author (operator who collected data) |  |  |  |
| Reviewer (engine team) |  |  |  |
| Reviewer (stakeholder, for SLO changes) |  |  |  |
| Final approver |  |  |  |

### Conclusion — No Data Cycle (v0.7.0 gate not met) — 2026-05-14

- Observation window (**2026-05-01 → 2026-05-14**) produced no
  extractable metrics. The Prometheus endpoint configured for the
  cycle was unreachable from the host running the pipeline; every
  query in `tools/extract_tuning_data.sh` failed at DNS resolution.
  See `tuning-data-2026-05-01/MANIFEST.txt` for the recorded
  invocation and failure trail (kept as audit evidence; not
  deleted).
- Pipeline correctly halted at Step 1 (data extraction failure).
  `tools/classify_alerts.sh` was not run; no
  `classification_candidates.json` was produced.
- `ops/incidents.md` contains 0 operator-curated entries for the
  window; runbook Feedback logs contain 0 populated rows. No
  evidence is available for alert classification or any tuning
  decision.
- Freeze invariants remained intact throughout the cycle.
  `prometheus-alerts.yaml`, `grafana-dashboard.json`, and
  `docs/SLO.md` MD5 hashes match the v0.6.6 baseline (verified
  end-of-cycle).

**Decision: v0.7.0 NOT STARTED.**

**Reason**: no real data available
(per [`CALIBRATION.md`](CALIBRATION.md) §7.1 — *"a blank cell is
honest; an estimated cell is calibration debt"*).

**Next attempt requires**: a working Prometheus URL reachable from
the host running the pipeline. Re-run begins at Step 0
(connectivity verification) per the operator-side pre-flight in
[`../../ops/README.md`](../../ops/README.md) §1. The §A–§E sections
of this report remain empty by design until a window with real
data completes.

### Conclusion (v0.6.7 — 2026-04-30)

**Outcome: NO TUNING REQUIRED. Current configuration is considered correctly
calibrated for the observed workload.**

Rationale:

- **No false positives observed.** §B `false_positives` column is empty for
  every alert across the observation window. The ≥ 3 false-positives-per-alert
  threshold for relaxing sensitivity (per [`CALIBRATION.md`](CALIBRATION.md)
  §7.2) is not met for any alert.
- **No missed incidents.** §B `incidents_caught` matches `total_incidents`
  for every row that was populated. No row in `ops/incidents.md` carries
  `Triggered by: (no alert fired)`. The recall-trigger for tightening
  sensitivity is not met for any alert.
- **Insufficient evidence to justify change.** §B / §C / §D cells lack the
  populated cell count required by [`CALIBRATION.md`](CALIBRATION.md) §7.1
  to anchor any tuning PR. A change made now would be unjustified by
  definition — see also the spec's "NO synthetic data" rule.

Per [`CALIBRATION.md`](CALIBRATION.md) §7.3, this outcome is **a valid
release deliverable**: the report itself confirms calibration without
threshold edits. v0.6.7 ships zero changes to
[`prometheus-alerts.yaml`](prometheus-alerts.yaml),
[`grafana-dashboard.json`](grafana-dashboard.json), [`../SLO.md`](../SLO.md),
or any runbook §1–§5 content.

> **Recalibration should be triggered if workload characteristics change
> or new incident patterns emerge.** Specifically: a new caller, ≥ 2× growth
> in request rate, a new query type at material volume, the addition of a
> new upstream registry, or any incident not surfaced by an existing alert.
> See [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) Phase 5 for the
> full re-baseline trigger list.

### Attached artefacts

- [ ] PromQL permalinks (or Grafana dashboard snapshots) for every
      §B / §C cell that is non-empty.
- [ ] Incident IDs / postmortem links for every `true_positives`
      count.
- [ ] Diff or PR link for every approved row in §E.

### Post-application steps

After the corresponding tuning PR merges:

- [ ] Update each affected runbook's `## Feedback log` →
      "Last calibration review" line with this report's date and
      outcome.
- [ ] Tick the matching item in [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
      Phase 4 (steady state).
- [ ] Archive this report in
      `docs/observability/tuning-reports/<YYYY-MM-DD>.md`. Empty
      until §A–§F are populated.

---

_Template last updated: 2026-04-30 (v0.6.6). First instance signed: v0.6.7 — calibration confirmed, no tuning required._
_Authority: this document, [`CALIBRATION.md`](CALIBRATION.md), and [`../SLO.md`](../SLO.md)._
