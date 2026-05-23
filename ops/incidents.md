# RDAPify — Incident Log

> Append-only operational log for the observation period feeding into
> v0.6.7 (data-driven tuning). One block per alert fire — even if it
> turns out to be a false positive.
>
> **What goes here**: every Prometheus alert that fires (any tier) and
> any production incident affecting RDAPify users — including
> incidents that *did not* fire any alert (those are the most
> valuable rows).
>
> **What does NOT go here**: routine deploys, maintenance windows,
> capacity changes, calibration discussions. Use the standard
> change-management log for those.

---

## Discipline

- **Append, do not edit.** Older entries are reference material; the
  rolling 14-day window is the input to
  [`../docs/observability/TUNING_REPORT.md`](../docs/observability/TUNING_REPORT.md).
- **Fill every field.** Blank cells become blank rows in TUNING_REPORT
  §B / §D and gate v0.6.7 from starting.
- **Honest classifications only.** A "false positive" is something
  the operator confirmed self-resolved without action. Don't mark a
  fire "false positive" just because it stopped firing — verify with
  the metric trend.

## Schema (per entry)

```
## YYYY-MM-DD HH:MM UTC — <alert_name>

- **Tier**:           critical | warning | info
- **Triggered by**:   <alert annotation summary or alertmanager URL>
- **Duration**:       Xm Ys (start → resolved)
- **Real?**:          yes (true positive) | no (false positive) | partial
- **Root cause**:     <one sentence; "unknown" is acceptable if not yet investigated>
- **Runbook used**:   yes | no | runbook missing | not applicable
- **Runbook outcome** (if used):
    - clarity (1–5):  <see scale in CALIBRATION.md §2.1>
    - missing steps:  <free text, or "none">
    - action taken:   <what mitigation, escalation, or no-op>
- **Linked artefacts**: <PR / ticket / postmortem URL — none if not yet>
```

A `Real? = no` row with three or more occurrences for the **same
alert** within a 14-day window is the trigger for tuning that alert
in v0.6.7 (per [`../docs/observability/CALIBRATION.md`](../docs/observability/CALIBRATION.md)
§7.2).

A `Runbook used = no` or `Real? = yes` row for an alert that **did
not fire** (file the row anyway, with `Triggered by = (no alert
fired)`) is a missed-incident row — also a v0.6.7 trigger.

---

## Entries

> Replace this placeholder block with real entries. Append newest
> at the bottom.

### EXAMPLE (delete on first real entry) — 2026-04-30 12:00 UTC — RdapifyHighErrorRate

- **Tier**: critical
- **Triggered by**: error rate 7 % for 5 m
- **Duration**: 12m 0s (12:00 → 12:12)
- **Real?**: yes
- **Root cause**: upstream registry .xyz returned 503 burst
- **Runbook used**: yes
- **Runbook outcome**:
    - clarity (1–5): 4
    - missing steps: nothing — `topk(3, sum by class)` pointed
      directly at `circuit_open` for one origin
    - action taken: confirmed with registry status page; no
      engine-side action; communicated to stakeholders
- **Linked artefacts**: postmortem #INC-001
