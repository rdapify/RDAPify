# RDAPify — Alert Classification Guide

> Decision tree for classifying every fire and every incident into
> the four boxes that drive precision and recall:
>
> 1. **True positive (TP)** — alert fired AND there was a real issue
> 2. **False positive (FP)** — alert fired AND there was no real issue
> 3. **Missed incident** — real issue occurred AND no alert fired
> 4. **Correct silence** — no real issue, no alert (the default; not
>    measured)
>
> Every fire and every incident must land in exactly one of (1)–(3).
> The numbers feed [`TUNING_REPORT.md`](TUNING_REPORT.md) §B; the
> definitions encoded here are the source of truth for what "real"
> means in this codebase.
>
> **All examples in this document are illustrative.** They describe
> the shape of a TP / FP / missed incident, not actual production
> events.

---

## 1. Definitions

### 1.1 What is a "fire"?

A **fire** is one transition of a Prometheus alert into the
`firing` state. Counted from the `ALERTS{alertstate="firing"}` time
series:

```promql
sum by (alertname) (
  changes(ALERTS{alertstate="firing"}[14d])
)
```

Two state-bounces in five minutes count as two fires. A single
sustained 4-hour firing counts as one fire.

### 1.2 What is a "real issue"?

For RDAPify, a real issue is any event that satisfies **at least
one** of:

- A user-visible failure occurred — a caller observed a query that
  failed, returned `circuit_open`, or took longer than the SLO
  budget.
- An operator took mitigation action — restarted a pod, raised
  `concurrency_limit`, contacted an upstream registry, escalated.
- A postmortem was filed — the team retrospectively decided the
  event was worth analysis.

If **none** of those applies, the event was not a real issue.

### 1.3 The four classifications

| Box | Alert? | Real issue? | Notes |
|---|---|---|---|
| **TP** | yes | yes | the alert did its job |
| **FP** | yes | no | the alert fired without need |
| **Missed** | no | yes | the alert set has a recall gap |
| **Correct silence** | no | no | the default; not tracked |

---

## 2. The decision tree

When a fire happens — or when an incident is identified — walk this
tree. The output goes into [`ops/incidents.md`](../../ops/incidents.md)
and the matching runbook's `## Feedback log` section.

```
                    fire detected?
                    │
                    ├── yes ──┐
                    │         │
                    │         ▼
                    │    real issue (per §1.2)?
                    │         │
                    │         ├── yes → ✅ TRUE POSITIVE (TP)
                    │         │         record in incidents.md
                    │         │         and runbook Feedback log
                    │         │
                    │         └── no  → ⚠️  FALSE POSITIVE (FP)
                    │                   record in incidents.md
                    │                   (drives §B fp count → §7.2 trigger)
                    │
                    └── no ───┐
                              │
                              ▼
                         was there an incident?
                              │
                              ├── yes → 🚨 MISSED INCIDENT
                              │         record in incidents.md
                              │         "Triggered by: (no alert fired)"
                              │         (drives §B recall < 1.0 → §7.2 trigger)
                              │
                              └── no  → CORRECT SILENCE — not tracked
```

---

## 3. Examples (illustrative)

### 3.1 Example TP — RdapifyHighErrorRate

> *Illustrative. Numbers and origins are not from production data.*

- Alert fires at 14:32 UTC. Error rate 7 % for 5 min.
- Operator runs [`runbooks/high-error-rate.md`](runbooks/high-error-rate.md)
  §3 verify queries: `circuit_open` is the dominant class.
- Operator confirms via the upstream registry's status page that
  rdap.example-tld.test is returning 503 to all probes.
- Operator communicates to stakeholders, lets the breaker continue.
- Alert auto-resolves at 14:51 UTC after upstream recovers.

**Classification**: TP — alert fired, real upstream outage, operator
took communication action, postmortem filed (`INC-001`).

`ops/incidents.md` entry:

```
## 2026-04-30 14:32 UTC — RdapifyHighErrorRate

- Tier:           critical
- Triggered by:   error rate 7 % for 5 m
- Duration:       19m 0s (14:32 → 14:51)
- Real?:          yes
- Root cause:     upstream rdap.example-tld.test 503 burst
- Runbook used:   yes
- Runbook outcome:
    - clarity:    4
    - missing:    none — class taxonomy pointed straight at circuit_open
    - action:     stakeholder comms; no engine-side action
- Linked:         INC-001
```

### 3.2 Example FP — RdapifyCacheHitRatioLow

> *Illustrative.*

- Alert fires at 09:15 UTC. Hit ratio 47 % for 30 min.
- Operator runs the runbook §3: hit ratio dropped because a deploy
  at 09:00 cleared the cache, and request rate is low (4 r/s).
- Cache warms naturally; ratio passes 70 % at 09:42 UTC.
- Operator took no action.

**Classification**: FP — alert fired, but the trigger was a
known-benign cache cold-start, not a real issue. No mitigation, no
postmortem. The runbook itself documented this as a "Recent deploy
/ restart" cause.

`ops/incidents.md` entry:

```
## 2026-04-30 09:15 UTC — RdapifyCacheHitRatioLow

- Tier:           warning
- Triggered by:   hit ratio 47 % for 30 m
- Duration:       27m 0s (09:15 → 09:42)
- Real?:          no    ← false positive
- Root cause:     post-deploy cache cold-start (known benign per runbook §2 cause #4)
- Runbook used:   yes
- Runbook outcome:
    - clarity:    5
    - missing:    none
    - action:     none — waited for cache to warm
- Linked:         deploy-2026-04-30-08-58
```

If this same cause-of-fire happens **three times in the window**
(three post-deploy FPs), CALIBRATION §7.2 unlocks: the alert can
be relaxed (e.g., add a `for: 1h` to ride out cache cold-starts,
or add a request-rate floor of 5 r/s to suppress low-volume noise).

### 3.3 Example Missed incident — no alert fired

> *Illustrative.*

- 03:14 UTC: a customer reports that some queries to obscure
  ccTLDs are returning `circuit_open`.
- Operator investigates: a small upstream registry that was added
  to the bootstrap last week is intermittently failing — flapping
  trip pattern, but the breaker's flap rate is just below the
  `RdapifyBreakerFlapping` 15-trips-per-5-min threshold (~12
  trips/5min observed).
- No rdapify alert fired.
- Operator coordinates with the registry; user-visible impact is
  bounded.

**Classification**: Missed incident. The alert set has a recall
gap for this specific flap pattern.

`ops/incidents.md` entry:

```
## 2026-04-30 03:14 UTC — (no alert fired) — flap pattern below threshold

- Tier:           n/a (no alert)
- Triggered by:   (no alert fired)
- Duration:       42m 0s (customer report → recovery)
- Real?:          yes    ← MISSED INCIDENT
- Root cause:     small upstream flapping at ~12 trips/5min (just below RdapifyBreakerFlapping threshold of 15)
- Runbook used:   no — no alert pointed at one
- Runbook outcome: n/a
- Linked:         CUST-77 (customer report), POSTMORTEM-2026-04-30-flap

→ Implication: §B row for RdapifyBreakerFlapping has recall < 1.0;
  §7.2 unlocks the "tighten threshold" path. Candidate change for
  v0.6.7: lower threshold from 15 → 10 trips/5min.
```

---

## 4. Edge cases

### 4.1 The alert flapped — fire and resolve in 90 seconds, then again

Each transition into firing counts as one fire. Two flips in two
minutes = two fires. Both must be classified independently. If
they're caused by the same underlying event but the alert
auto-resolved in between, it's typically:

- One TP if the underlying event was real (and the auto-resolve was
  a measurement gap, not a real recovery).
- Two FPs if the alert is "blippy" against a metric that crosses
  threshold often.

`for:` window tuning (CALIBRATION §7) is the response. Don't try to
classify them as "1.5 fires".

### 4.2 The alert co-fired with another

When `RdapifyHighErrorRate` and `RdapifyErrorBudgetFastBurn` fire
together for the same incident: **both count as separate fires**,
both should be classified. Most often both are TP (the budget-burn
is the SLO framing of the same condition). The runbooks make this
relationship explicit ("Treat them as a single alert for response
purposes" — see [`runbooks/error-budget-fast-burn.md`](runbooks/error-budget-fast-burn.md) §2).

This co-firing is by design — see [`PATTERNS.md`](PATTERNS.md) §1.

### 4.3 The alert fired but I'm not sure if it was real

Default to **FP**. The threshold for "real" is "user-visible failure
OR operator action OR postmortem". If you the operator did nothing
and no one complained, it wasn't real. Logging it as TP because "it
*could* have been real" is calibration debt — it inflates precision
artificially.

### 4.4 An incident occurred mid-deploy

If an incident overlaps with a deploy that changed engine defaults,
**invalidate the window** for the affected alerts (see
TUNING_REPORT.md §A admissibility check #2). The deploy may have
caused the issue; pre/post numbers aren't comparable. Restart the
window after the deploy stabilises.

### 4.5 Multiple alerts fire for the same minute — which one "caught" the incident?

The first fire (by timestamp) gets the TP credit for `incidents_caught`.
Subsequent fires that match the same incident are still recorded as
TPs (they're real fires for real reasons), but in §B the
`incidents_caught` column is bumped only once per incident.

---

## 5. Computing precision and recall

For each alert, in the report window:

```
precision = TP / fires
recall    = incidents_caught_by_this_alert / total_incidents
```

Where:

- **`TP`** = sum of TP rows for this alert in `ops/incidents.md`.
- **`fires`** = `TP + FP` rows for this alert (= the `changes()`
  PromQL count for this alertname).
- **`incidents_caught_by_this_alert`** = number of distinct
  incidents this alert was the *first* to fire on.
- **`total_incidents`** = total incidents in the window across all
  alerts AND all missed-incident rows. Same denominator for every
  row in §B.

### 5.1 Worked example

> *Illustrative. Real numbers come from your window; this is shape
> only.*

In a 14-day window:

- 100 total fires across the 15 alerts.
- 12 distinct incidents.
- 1 missed incident (no alert fired but it was real).

For `RdapifyHighErrorRate`:

- 5 fires.
- 4 of those 5 are classified TP (real), 1 is FP.
- 4 distinct incidents had `RdapifyHighErrorRate` as the first
  fire.
- Total incidents in window: 12.

```
precision = 4 / 5 = 0.80   ← exactly at critical threshold
recall    = 4 / 12 = 0.33  ← far below 0.90 — but only because this
                             one alert can't catch all 12 incidents
                             (the other 11 were caught by other alerts
                             OR were the 1 missed)
```

**Important**: per-alert recall is measured against **total**
incidents, not against incidents this alert *should* have caught.
A given alert's recall is naturally low if many incidents are of
other shapes — that's expected. The aggregate recall (caught_by_any
/ total) is the useful number; for v0.6.7's "tighten threshold"
trigger, the relevant question is: was there an incident that
**should** have been caught by this specific alert and wasn't?
That's a missed-incident row tagged with the alert it should have
caught.

### 5.2 Targets — restated

| Tier | Precision target | Recall target |
|---|---|---|
| Critical | **≥ 0.80** | n/a per-alert; ≥ 0.90 aggregate |
| Warning | **≥ 0.50** | n/a per-alert; ≥ 0.90 aggregate |
| Info | n/a (digest only) | n/a |

A critical alert under 0.50 precision is *strictly worse than no
alert* — it trains on-call to ignore. Tune or downgrade. See
CALIBRATION.md §4.2.

---

## 6. What this document does not cover

- **The PromQL** to extract counts: in [`QUERIES.md`](QUERIES.md).
- **How to export** the data: in [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md).
- **The end-to-end workflow**: in [`TUNING_WORKFLOW.md`](TUNING_WORKFLOW.md).
- **What threshold change to make based on classification**:
  see [`CALIBRATION.md`](CALIBRATION.md) §2.2 and §7.

---

## 7. Quick reference card

| Situation | Box | Action |
|---|---|---|
| Alert fired + customer report / postmortem / mitigation | TP | row in incidents.md + runbook Feedback log |
| Alert fired + no action, no impact | FP | row in incidents.md + runbook Feedback log; ≥ 3 unlocks §7.2 |
| Customer report / postmortem + no alert | Missed | row in incidents.md with `(no alert fired)` |
| No alert, no impact | Correct silence | not tracked |
| Two alerts for same incident | both TP | first-by-timestamp gets `incidents_caught += 1` |
| Alert flapped (multiple fires, one cause) | depends | classify each fire; if blippy, tune `for:` not threshold |
| Mid-deploy incident | window invalid | restart the window |

---

_Last updated: 2026-04-30 (v0.6.8). All examples in §3 are
illustrative — they describe shape, not actual events._
