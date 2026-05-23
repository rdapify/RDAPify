# RDAPify — Operational Calibration

> Tuning guide for the production deployment. Once you've imported the
> dashboard and loaded the alerts, the next 4 weeks are about making
> them *right* for **your** workload — not the synthetic load-test
> defaults that produced them.

This document answers three questions:

1. **How do I tune alert thresholds without making them blind?**
2. **How do I measure whether the alerts are still useful?**
3. **What do the metric trends mean over time?**

It deliberately does not redefine alerts or SLOs — see
[`prometheus-alerts.yaml`](prometheus-alerts.yaml),
[`../SLO.md`](../SLO.md), and the runbooks for those. CALIBRATION is
*how to keep them honest in production*.

---

## 1. The calibration loop

Every threshold in `prometheus-alerts.yaml` was set from one of three
sources:

- **Stage E load-test** (`../../loadtest/reports/STAGE_E_SLO_REPORT.md`)
  — synthetic single-origin saturation; produces the throughput and
  p95 numbers.
- **SLO targets** (`../SLO.md`) — 1 % error budget, 300 ms p95, etc.
- **Operator judgment** (e.g. `for: 5m`, the 14.4× burn-rate
  multiplier) — chosen for low noise, not measured.

The calibration loop replaces the third source with **measurements
from your production data**.

### 1.1 The four-week schedule

| Week | What you do | Output |
|------|-------------|--------|
| 1 | Deploy with defaults. Suppress paging, route to Slack only. Watch the dashboard. | Baseline distributions for every metric (see §3). |
| 2 | Re-enable paging at the warning tier. Track every alert. | Alert/incident ratio per alert (see §4). |
| 3 | Re-enable paging at the critical tier. Tune thresholds that are too tight or too loose. | Threshold change PR. |
| 4 | Run a full week with production paging on. Measure noise. | Calibration report; sign-off for steady-state operation. |

After week 4 you re-calibrate **at most quarterly**, or whenever the
workload meaningfully changes (new caller, new query type, traffic
> 2× growth).

### 1.2 The cardinal rule

> **Move thresholds, not metrics.**
>
> If an alert is too noisy, the answer is almost always to raise the
> threshold or extend the `for:` window — not to add a new metric or
> a new label. Cardinality is a budget; once spent it's hard to
> reclaim. Trust the existing surface.

This is also why v0.6.5 is docs-only: the metric set landed in
v0.6.2 and v0.6.3 was the operator-facing layer; everything since is
calibration.

---

## 2. Tuning a threshold — the procedure

When you decide an alert needs adjustment:

### 2.1 Capture the baseline first

Before changing anything, record the current value across **at least
two business cycles** (typically 14 days). One PromQL pattern fits
most thresholds:

```promql
# For a "rate" alert: percentile of the rate over a long window.
quantile_over_time(0.99, sum(rate(<metric>[5m]))[14d:5m])
quantile_over_time(0.95, sum(rate(<metric>[5m]))[14d:5m])
quantile_over_time(0.50, sum(rate(<metric>[5m]))[14d:5m])

# For a "histogram quantile" alert: the percentile of the percentile.
quantile_over_time(0.99,
  histogram_quantile(0.95, sum by (le) (rate(<bucket>[5m])))[14d:5m]
)
```

If your p99-of-p95 latency over 14 days is 220 ms but the alert
fires at 300 ms, your headroom is comfortable. If p99-of-p95 is
already 280 ms, the alert is one bad day from chronic firing — you
have a real signal that you need to either fix latency or accept a
weaker SLO.

### 2.2 Decide what kind of change

| If you observe… | Change | Why |
|---|---|---|
| Alert never fires | Lower the threshold or skip — the metric isn't actionable here | An always-quiet alert is dead weight |
| Alert fires but no one acts | Raise the threshold *or* lower the severity | False positive by definition |
| Alert fires and is always real | Keep — this is the goal | |
| Alert fires intermittently with no `for:` damping | Increase `for:` window first, threshold second | Noise-suppression is cheaper than threshold debate |
| Alert fires once per week with no clear trigger | Likely a deploy or a cron — annotate, don't tune | Anchor the trigger before chasing it |

### 2.3 Make the change reviewable

Every threshold change is a PR. The PR description must include:

- **Before/after** PromQL of the threshold and the value distribution.
- The **incident or false-positive ID** that motivated the change.
- The **noise-target impact** (see §4) — does this make the alert
  cleaner or noisier per ratio?
- A note in the matching runbook's `Feedback` section.

### 2.4 Don't tune mid-incident

Mid-incident threshold changes are how observability dies. If an
alert is paging during an active incident, **silence it** (Alertmanager
silence with a 4 h cap) and tune after the postmortem. Tuning
under stress optimises for "stop the noise", not for "this threshold
is right".

---

## 3. Interpreting metric trends

Below are the trend patterns you'll see in the first 90 days of
production, what they mean, and what (if anything) to do.

### 3.1 Latency

`rdap_latency_seconds` p50 / p95 / p99 trends:

- **p50 stays low (< 50 ms), p95 grows** — cache hit ratio is fine
  but tail upstream latency is degrading. Confirm with
  `rdap_cache_hits_total / (hits + misses)`. If hit ratio is stable,
  upstream is the cause.
- **p50 climbs in step with p95** — *something* is making
  every-request slower. Almost always: the global semaphore wait. Check
  `rdap_semaphore_wait_seconds{kind="global"}` p95.
- **p99 spikes daily at the same time** — almost always a scheduled
  job (yours or upstream's). Annotate, don't tune.
- **p95 above SLO during business hours, fine overnight** — capacity
  is sized for off-peak; raise `concurrency_limit` or accept the
  budget burn during peak.

### 3.2 Cache

`rdap_cache_hits_total / (rdap_cache_hits_total + rdap_cache_misses_total)`:

- **Hit ratio drifts down over weeks** — working set is growing.
  Project when it crosses the cap, raise `cache.max_entries`
  pre-emptively.
- **Hit ratio drops sharply on a deploy** — cache was emptied. Wait
  10–30 m for warmup; the trend should recover.
- **Hit ratio stays flat at ~50 %** — workload is genuinely diverse.
  Hit ratio targets in `RdapifyCacheHitRatioLow` may need lowering
  for your workload.
- **`freshness="negative"` rate climbing** — callers are querying
  non-existent names. Coordinate with the producing service to
  filter dead inputs before they reach RDAPify.

### 3.3 Concurrency

`rdap_inflight_requests` / `rdap_semaphore_wait_seconds`:

- **Inflight steady, wait near zero** — capacity is right-sized.
- **Inflight steady, wait rising** — query mix has shifted toward
  longer-tail upstreams. Re-check `rdap_per_host_queue_depth` p95.
- **Inflight saturates daily during peak** — capacity is sized for
  off-peak. Either raise `concurrency_limit`, or accept that p95
  during peak will track the queue.
- **Inflight floor > 0 in idle traffic** — likely a permit leak;
  page the engine team. Should not happen with the v0.6.x code base
  but is worth watching.

### 3.4 Circuit breakers

`rdap_circuit_breaker_*`:

- **Same origin trips weekly at the same time** — upstream
  maintenance window. Either lower the failure threshold for that
  origin, or document the weekly false-positive in the runbook.
- **Different origins trip in rotation** — likely a network egress
  issue (DNS, NAT) on your side, not upstream.
- **`half_open→closed` rate matches `closed→open`** — breaker is
  working as designed; trips and recovers cleanly.
- **`half_open→open` consistently > `half_open→closed`** —
  cooldown is too short; upstream isn't recovering in time. Extend.

### 3.5 Retries

`rdap_retry_total{class}`:

- **Retry amplification (retries / requests) climbs over weeks** —
  upstream is gradually getting flakier. Coordinate with the
  registry operator before this becomes an SLO event.
- **Sudden `class="rate_limited"` spike** — a caller has changed
  behaviour. Trace upstream: which client increased their rate?
- **`class="http_4xx"` is non-zero at all** — investigate.
  4xx retries are only for specific transient codes; sustained 4xx
  retries usually mean we're retrying something we shouldn't.

---

## 4. Alert noise tracking

The alert set is only as good as its signal-to-noise ratio. This is
the single most important calibration metric — measure it monthly.

### 4.1 Definitions

- **Fire** — an alert moved from inactive to firing.
- **Real** — the fire corresponded to a real production issue
  (user-visible impact, customer report, postmortem-worthy).
- **Useful** — the operator who responded took an action that
  reduced impact (mitigation, communication, escalation).
- **Noisy** — fires that did not lead to action and self-resolved
  without operator involvement.

### 4.2 The two ratios that matter

#### Precision (alert/incident ratio)

```
precision = real_fires / total_fires
```

- **Per alert** — measured over a 30-day rolling window.
- **Per severity tier** — aggregate.

| Tier | Target precision | If below target |
|------|------------------|-----------------|
| Critical | **≥ 0.80** | Stop paging; downgrade to warning until fixed |
| Warning | **≥ 0.50** | Tune within two weeks |
| Info | n/a (digest only) | Drop if completely unread |

A critical alert under 0.50 precision is *strictly worse than no
alert* — it trains on-call to ignore it. Either tune it, downgrade
it, or delete it.

#### Recall (incidents-with-alert ratio)

```
recall = incidents_with_alert / total_incidents
```

Of the incidents the team handled, how many were alerted on first
(vs. discovered by a customer report or another team)?

| Target | Action if below |
|--------|-----------------|
| **≥ 0.90** | Each missing-alert incident = a runbook entry under "What didn't fire" + a tuning ticket |

Recall is harder to measure because it depends on knowing about
incidents that *didn't* alert. Sources: customer reports, postmortems
filed without an alert ID, on-call diary entries. Track in the same
sheet as precision.

### 4.3 Per-alert tracking sheet

Keep one row per alert. Columns:

| alert | fires_30d | real_30d | precision | last_fire | last_real | last_runbook_update |
|-------|-----------|----------|-----------|-----------|-----------|---------------------|
| RdapifyHighErrorRate | 4 | 4 | 1.00 | 2026-04-22 | 2026-04-22 | 2026-04-29 |
| RdapifyCacheHitRatioLow | 17 | 2 | 0.12 | 2026-04-29 | 2026-04-15 | (none) |

When `precision < target`, the runbook's Feedback section gets a
new entry; see §5 in the runbook template.

### 4.4 Counting fires from Prometheus

You can compute fires directly from the `ALERTS` metric Prometheus
exports:

```promql
# Count of distinct fires per alert in the last 30 days.
sum by (alertname) (
  changes(ALERTS{alertstate="firing"}[30d])
)

# Total firing time per alert in the last 30 days (seconds).
sum by (alertname) (
  ALERTS{alertstate="firing"} == 1
) * 60   # adjust for scrape interval
```

`real` and `useful` come from your incident-tracking system (Linear,
Jira, PagerDuty, etc.) — there is no PromQL for "did a human do
something useful". Wire the two together in your noise spreadsheet.

### 4.5 The monthly review

Block 30 minutes once a month:

- Per-tier precision over the last 30 days.
- Worst-precision alert: action plan (tune, downgrade, delete).
- Best-precision alert: confirm threshold isn't dangerously tight.
- Any alert with zero fires in 90 days: keep, downgrade to info,
  or delete.
- Any incident in the last 30 days that didn't alert: file a
  monitoring-gap ticket.

---

## 5. Workload-specific calibration

Some defaults are explicitly conservative because the load test
runs against a single origin. If your production differs:

### 5.1 Many origins, low per-origin volume

Default per-host concurrency is 16. If you serve 200+ origins with
≤ 1 r/s each, the per-host limit is irrelevant — you're bottlenecked
on the global cap, not per-host. You can lower per-host without
risk; you may also want to raise `cache.max_entries` to fit a
larger working set.

### 5.2 Few origins, high volume

You're probably bumping per-host limits before global. Raise
`per_host_concurrency_limit` (default 16, ceiling = global limit).
Watch `rdap_per_host_queue_depth` p95 — when it stops climbing
linearly with traffic, you've sized it.

### 5.3 Cache-bypass workload

If callers ship `Cache-Control: no-cache` or query unique inputs
each time, hit ratio will be near zero. Lower the
`RdapifyCacheHitRatioLow` threshold (or disable the alert) and
size capacity for the no-cache path.

### 5.4 Burst workload (cron / batch)

Default `for:` windows assume sustained load. Burst workloads
can fire alerts repeatedly during predictable windows. Either:

- Annotate the windows in Grafana and ignore.
- Add an Alertmanager mute_time_intervals config for the cron
  windows.
- Don't change the alert thresholds — burst noise is a routing
  problem, not a thresholding problem.

---

## 6. What you should *not* tune

Some thresholds anchor to the SLO contract or to engine internals.
Touching them changes the meaning of the alert:

| Don't tune | Why |
|------------|-----|
| `RdapifyHighErrorRate` 5 % threshold | This is "5× the SLO ceiling". Keep it tied to the SLO. |
| Burn-rate multipliers (14.4× / 6×) | Anchored to Google SRE MWMBR design; tuning these breaks the budget framing. |
| `RdapifyInflightSaturation` 240 / 256 cap | Tied to the engine's default `concurrency_limit`. Update both together if you change the cap. |
| Histogram bucket boundaries | Not part of stable contract, but changing them invalidates trend baselines. |
| Per-origin breaker thresholds (engine code) | Engine change, out of scope for v0.6.x. |

If a threshold in this table is causing pain, the answer is to fix
the cause, not to mute the alarm.

---

## 7. When NOT to tune

> Hard preconditions for any change to a threshold, `for:` window,
> alert severity, panel, or SLO target. **Every condition below is
> a strict gate** — if any one fails, do not proceed; close the PR
> and capture more data first. Added v0.6.6 because it is easier to
> wreck calibration discipline than to maintain it.

### 7.1 Required: completed TUNING_REPORT with real data

You must have a populated [`TUNING_REPORT.md`](TUNING_REPORT.md)
covering the time window the proposed change is meant to address.

- §A "Window admissibility" — every checkbox ticked.
- §B "Alert Evaluation" — the row(s) you are tuning have non-empty
  `fires` / `true_positives` / `false_positives` / `precision`
  / `incidents_caught` / `total_incidents` / `recall` cells.
- §C "Metric Baselines" — at least the metric family the proposed
  change touches has its `Observed` and variability cells filled.
- §E "Threshold Change Ledger" — your proposed change is logged
  with cited evidence anchored to §B / §C / §D.

If any of those cells are blank, you do not have data to justify
the change. Leave the PR unmerged until they are populated. **A
blank cell is honest; an estimated cell is calibration debt.**

### 7.2 Required: ≥ 3 false positives before lowering sensitivity

"Lowering sensitivity" means any of:

- Raising a threshold (e.g. error-rate alert from 5 % to 8 %).
- Extending a `for:` window (e.g. 5 m to 10 m).
- Downgrading severity (e.g. critical → warning).
- Removing an alert.

The change is only justified if §B shows the alert produced
**≥ 3 distinct false-positive fires** within the report window.
Two false positives in a 14-day window can be coincidence; three
or more is a pattern.

A single noisy week (e.g. a known traffic burst with a clean
post-mortem) does **not** clear this gate. Use Alertmanager
mute-time-intervals or a temporary silence for one-off events;
they're routing problems, not threshold problems.

### 7.3 Required: baseline window ≥ 7 days (≥ 14 d preferred)

A baseline shorter than one full business cycle (workday +
weekend) is not a baseline — it's a snapshot. The minimum window
length is **7 days**; **14 days** is preferred and lets you observe
weekly seasonality.

If your engine has been in production for less than 7 days, you
are still in [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md)
Phase 1 (soft launch) and tuning is out of scope. Wait.

### 7.4 Prohibited: tuning during an active incident

If any rdapify alert is currently firing, or any open incident in
your tracker has rdapify on its impact list:

- Do not merge a tuning PR.
- Do not silence an alert as a substitute for tuning (use Alertmanager
  silences, capped at 4 hours, and capture the reason).
- Do not "quickly raise the threshold to stop the noise". That
  optimises for stress, not for being right.

Tuning happens *after* the postmortem. The postmortem informs the
TUNING_REPORT row; the row informs the change.

### 7.5 Prohibited: "do not tune" thresholds (§6 list)

The list in §6 above ("What you should *not* tune") is not an
input — it is a hard prohibition. Any PR proposing to change one
of those thresholds must be rejected at review even if every other
gate in §7 is passed. The fix is to address the cause, not the
sensor.

### 7.6 Prohibited: panel removal without §D evidence

A panel is removed only if [`TUNING_REPORT.md`](TUNING_REPORT.md)
§D records that no incident in the report window pointed at it
AND the panel is classified `candidate-for-removal` in
[`PANEL_INVENTORY.md`](PANEL_INVENTORY.md). Removing diagnostic
surface area on a hunch is the cheapest way to make the next
incident harder to diagnose.

### 7.7 Prohibited: SLO change without stakeholder sign-off

[`../SLO.md`](../SLO.md) §1, §2, §3 targets are part of the public
contract. Any proposed change requires:

- §C baseline evidence in TUNING_REPORT.
- A `decision` row in §F signed by a stakeholder (not just the
  on-call operator).
- An entry in `RDAPify-Internal/DECISIONS.md` recording the date
  and rationale.

A target the engine cannot meet is a problem. **Lowering the target
to make the dashboard green is not a fix** — it's the failure mode
this section exists to prevent.

### Summary checklist

Before merging *any* tuning PR:

- [ ] TUNING_REPORT covers the relevant window with no blank
      decision-supporting cells.
- [ ] At least 7 days of baseline data (14 d preferred).
- [ ] No active rdapify-impacting incident.
- [ ] If lowering sensitivity: ≥ 3 false positives documented.
- [ ] Threshold is not in §6 ("do not tune") list.
- [ ] §F has a reviewer signature.
- [ ] PR description links the §E ledger row.

If you can't tick every box, the PR is not ready.

---

## 8. References

- [`prometheus-alerts.yaml`](prometheus-alerts.yaml) — the alerts
  themselves.
- [`runbooks/`](runbooks/) — alert response, including a Feedback
  section per runbook for tracking calibration changes.
- [`INCIDENT.md`](INCIDENT.md) — incident response process, where
  this calibration discipline plugs into the postmortem.
- [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) — pre-deploy
  and post-deploy items including the four-week calibration schedule.
- [`TUNING_REPORT.md`](TUNING_REPORT.md) — the canonical fill-in
  template that feeds §7. Added v0.6.6.
- [`PANEL_INVENTORY.md`](PANEL_INVENTORY.md) — every dashboard panel
  classified high-signal / diagnostic-only / candidate-for-removal.
  Added v0.6.6.
- [`PATTERNS.md`](PATTERNS.md) — five common failure shapes built
  from existing runbooks. Added v0.6.6.
- [`../SLO.md`](../SLO.md) §7 — real-world validation guidance,
  added in v0.6.5.

---

_Last updated: 2026-04-30 (v0.6.6 — added §7 "When NOT to tune")._
