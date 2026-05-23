# RDAPify — Operations / Observation-Period Guide

> Field-ops scaffolding for the **pre-v0.6.7 observation period**.
> v0.6.6 shipped the harness ([TUNING_REPORT.md](../docs/observability/TUNING_REPORT.md),
> [PANEL_INVENTORY.md](../docs/observability/PANEL_INVENTORY.md),
> [PATTERNS.md](../docs/observability/PATTERNS.md), and the §7
> "When NOT to tune" guardrails in [CALIBRATION.md](../docs/observability/CALIBRATION.md)).
> This directory is where the **operator** records the data those
> templates need before v0.6.7 can begin.
>
> **This is operational, not an engine release.** No source-code
> changes happen during the observation window.

---

## 1. Pre-flight — confirm Prometheus and Alertmanager are wired

Before counting day 1 of the window:

- [ ] Engine compiled with `--features metrics` and `install_recorder()`
      called at process start. Confirm via
      `curl <engine>/metrics | head` returning Prometheus text.
- [ ] Prometheus is scraping `/metrics` at **15 s** or **30 s** interval.
      Confirm in Prometheus UI → Status → Targets that the rdapify
      target is `UP` and the `Last Scrape` value is recent.
- [ ] Alertmanager is loaded with
      [`../docs/observability/prometheus-alerts.yaml`](../docs/observability/prometheus-alerts.yaml)
      (15 alerts; `${TEAM}` placeholder replaced).
- [ ] Alertmanager retention ≥ **14 days**. Verify via Alertmanager
      flag `--data.retention=336h` or the Cortex/Mimir equivalent.
- [ ] Grafana has [`../docs/observability/grafana-dashboard.json`](../docs/observability/grafana-dashboard.json)
      imported.

If any of those is unticked, **the window has not started yet**.

## 2. During the window — what to record

### 2.1 Every alert fire → entry in [`incidents.md`](incidents.md)

Append an entry per the schema in `incidents.md`. Mandatory fields:

- timestamp (UTC)
- alert name
- tier (critical / warning / info)
- duration
- real / false positive / partial
- root cause (or `unknown`)
- runbook used? — and if yes: clarity 1–5, missing steps, action taken
- linked PR / ticket / postmortem (or `none`)

### 2.2 Every alert fire → entry in the runbook's Feedback log

Each runbook in [`../docs/observability/runbooks/`](../docs/observability/runbooks/)
has a `## Feedback log` section ending it. Append a row there too —
the runbook log is the per-runbook calibration trail; `incidents.md`
is the **cross-runbook** chronological log. Both are required.

If the runbook didn't help, mark `clarity ≤ 2` and **edit one of
§2 / §3 / §4 / §5** in that runbook within the same week (per the
"After every incident this runbook was used in" subsection).

### 2.3 Every incident with no alert → entry in [`incidents.md`](incidents.md)

The most valuable rows. Schema is the same; set
`Triggered by: (no alert fired)`. These rows feed
[`../docs/observability/TUNING_REPORT.md`](../docs/observability/TUNING_REPORT.md)
§B's `incidents_caught < total_incidents` recall metric and are
the trigger for raising sensitivity in v0.6.7.

## 3. Freeze rules — what NOT to do during the window

Encoded in [`../docs/observability/CALIBRATION.md`](../docs/observability/CALIBRATION.md)
§7. Restated here for visibility:

| Action | During the window |
|---|---|
| Change a Prometheus alert threshold | **Forbidden** |
| Change a `for:` window | **Forbidden** |
| Change an alert severity | **Forbidden** |
| Change an SLO target | **Forbidden** |
| Remove a Grafana panel | **Forbidden** |
| Edit engine source under `crates/` | **Forbidden** |
| Edit a runbook's diagnostic / action sections after using it | **Required** if the runbook was inadequate (clarity ≤ 2) |
| Append rows to `incidents.md` and runbook Feedback logs | **Required** on every fire |
| Use Alertmanager silences for routine maintenance windows | **Allowed**, but document the silence reason in `incidents.md` |

The point of the freeze is to make the data **comparable** across
the window. If thresholds move mid-window, the precision and recall
calculations in TUNING_REPORT §B become meaningless.

## 4. Window length

| Bound | Days | Note |
|---|---|---|
| Minimum | **7** | Single business cycle (workday + weekend). Anything shorter is a snapshot, not a baseline. |
| Preferred | **14** | Two business cycles — observable weekly seasonality. |
| Maximum useful | ~30 | Beyond 30 days the workload typically shifts enough that earlier data becomes stale. Re-baseline rather than extend. |

`window_start` and `window_end` go into TUNING_REPORT §A. If the
window is interrupted by a deploy that changes default thresholds
(per CALIBRATION §7.1), the window resets — past data is not mixed
with post-deploy data.

## 5. Readiness gate — when v0.6.7 may begin

v0.6.7 (data-driven tuning) may begin **only when at least one of**:

- ≥ **3 false positives for the same alert** within the window
  (CALIBRATION §7.2 — "lowering sensitivity" gate), **OR**
- ≥ **1 missed incident** within the window (an incident that fired
  no alert but had user-visible impact — the recall trigger), **OR**
- The 14-day window completed and TUNING_REPORT §A admissibility
  checks pass even without tuning-worthy findings (the operator can
  still produce a "no changes proposed" tuning report — the report
  itself is the deliverable; threshold edits are optional).

If none of those is true after 14 days and the operator just wants
to start v0.6.7 anyway, **do not**. Extend the window or accept that
the alert set is correctly calibrated for the current workload.

## 6. End-of-window deliverables

When the window closes:

1. [`incidents.md`](incidents.md) — populated for every fire and
   every off-alert incident.
2. Each runbook's `## Feedback log` — populated for every fire that
   used it.
3. [`../docs/observability/TUNING_REPORT.md`](../docs/observability/TUNING_REPORT.md)
   — sections A through F filled in (or section A's admissibility
   ticked plus a final "no tuning required" sign-off in §F).
4. A short summary message in your team channel: window dates, total
   alerts fired, precision per tier, missed incidents (if any),
   proposed v0.6.7 changes (if any).

## 7. Reference index

- [`incidents.md`](incidents.md) — the chronological incident log (this directory).
- [`../docs/observability/INCIDENT.md`](../docs/observability/INCIDENT.md) — incident response process.
- [`../docs/observability/runbooks/`](../docs/observability/runbooks/) — one runbook per alert; each ends with a Feedback log section.
- [`../docs/observability/TUNING_REPORT.md`](../docs/observability/TUNING_REPORT.md) — the fill-in template that this window's data feeds.
- [`../docs/observability/CALIBRATION.md`](../docs/observability/CALIBRATION.md) — tuning discipline; §7 ("When NOT to tune") encodes the freeze rules above.
- [`../docs/observability/PRODUCTION_CHECKLIST.md`](../docs/observability/PRODUCTION_CHECKLIST.md) — broader pre-/post-deploy phased checklist; this guide covers Phase 4 (steady-state monthly review) specifically.

---

_Last updated: 2026-04-30. The observation window starts when §1 is fully ticked._
