# Observation Window — Operator Runbook

> **Real data only.** This runbook describes how to run an observation
> window against a live RDAPify deployment serving real production
> traffic. Synthetic load, replayed traffic, or staged-only deployments
> do **not** produce a valid window. If the deployment is not currently
> serving real users, the window has not started — close this document
> and come back when it is.

A valid observation window produces evidence that either:

1. **Confirms** the current alert thresholds, SLOs, and concurrency
   limits are correctly calibrated (no tuning needed; the deliverable
   is a "no changes proposed" `TUNING_REPORT.md`), **or**
2. **Justifies** a tuning PR for `v0.7.0` with quantified inputs and
   honest precision/recall numbers per alert.

There is no third option. A window that fails to produce one of those
two outcomes is a window that did not happen.

---

## 1. Purpose

Three things, in this order:

1. **Measure alert quality on real load.** Per-alert true-positive,
   false-positive, and missed-incident counts populate
   [`TUNING_REPORT.md`](TUNING_REPORT.md) §B.
2. **Measure runbook quality on real incidents.** Operators score each
   runbook they actually used during an incident; the rolling Feedback
   log in each runbook becomes the calibration trail.
3. **Validate the metric/SLO baseline.** The PromQL catalog in
   [`QUERIES.md`](QUERIES.md), executed via
   [`../../tools/extract_tuning_data.sh`](../../tools/extract_tuning_data.sh)
   at end-of-window, produces the §C latency / errors / cache /
   concurrency / retries / breaker baselines.

The window is **not** for finding bugs in the engine, refining alert
thresholds mid-flight, or experimenting with SLO targets. Those are
forbidden during the window — see §5.

---

## 2. Pre-flight checklist

Run [`../../tools/preflight_check.sh`](../../tools/preflight_check.sh)
first; it codifies most of this list. The checks below are the human
verification that the deployment behind the URL is actually wired.

- [ ] **Engine compiled with `--features metrics`** and
      `rdap_metrics::install_recorder()` called at process start.
      Confirm: `curl <engine>/metrics | head -3` returns Prometheus
      text format.
- [ ] **Prometheus is scraping the engine.** Confirm in Prometheus UI
      → Status → Targets that the rdapify target is `UP` and
      `Last Scrape` is recent (≤ 2 × scrape interval).
- [ ] **Scrape interval ≤ 30 s.** The rate windows in alerts and
      `extract_tuning_data.sh` assume 30 s or finer.
- [ ] **Alertmanager loaded with
      [`prometheus-alerts.yaml`](prometheus-alerts.yaml)** and the
      `${TEAM}` placeholder replaced with the operator team's
      identifier.
- [ ] **Alertmanager retention ≥ 14 d.** The window is at minimum 7 d
      and preferably 14 d (§4); without retention, alert classification
      at end-of-window is impossible.
- [ ] **Grafana imported
      [`grafana-dashboard.json`](grafana-dashboard.json)** and the
      Engine-health stat panel reads OK.
- [ ] **`tools/preflight_check.sh` passes.** Run with the live
      `PROM_URL`; PASS on every check.
- [ ] **`ops/incidents.md`** exists and the EXAMPLE block has been read
      (delete it on the first real entry).
- [ ] **Operator attestation prepared.** Copy
      [`../../ops/attestations/TEMPLATE.md`](../../ops/attestations/TEMPLATE.md)
      to `../../ops/attestations/<YYYY-MM-DD>.md` and fill in
      `WINDOW_START` (UTC). `WINDOW_END` stays blank until §6.

If any box is unticked, **the window has not started**.

---

## 3. Start procedure

The window is declared by **filing the attestation file**, not by
sending a message or running a command. The attestation is the
source of truth.

```text
1. Confirm every box in §2 above.
2. cp ops/attestations/TEMPLATE.md ops/attestations/<YYYY-MM-DD>.md
3. Edit that file:
     - WINDOW_START      = the UTC date you ticked the last box (today)
     - environment       = name + region of the live deployment
     - operator          = your name / handle
4. Commit the attestation file (or save to ops repo if separated).
   Until the attestation file exists, no window is in progress.
5. Announce in your team channel: window dates, attestation path,
   reminder that thresholds and SLOs are frozen for the duration.
```

**WINDOW_START is UTC and is the moment the last pre-flight box was
ticked, not the moment the engine was deployed.** Backdating is
forbidden — if the engine has been running for two days but Prometheus
was only just wired up, day 1 of the window is today.

---

## 4. Daily routine

The window runs for **7 days minimum, 14 days preferred** (see
[`../../ops/README.md`](../../ops/README.md) §4).

Two artefacts are appended to during the window. **Both are required
for every alert fire.**

### 4.1 `ops/incidents.md`

Append-only chronological log. Schema is at the top of the file.
Append a block for:

- Every Prometheus alert fire (any tier — even info).
- Every production incident that did **not** fire an alert (mark
  `Triggered by: (no alert fired)`). These are the most valuable
  rows because they drive the recall metric in TUNING_REPORT §B.

**Do not edit older entries.** Do not retro-classify a `partial` to
`yes` later — file an addendum block beneath the original. Older
blocks are evidence; rewriting them destroys the audit trail.

### 4.2 Runbook Feedback log

Each file under [`runbooks/`](runbooks/) ends with a `## Feedback log`
section. For every alert that fired and whose runbook was consulted,
append a row in that file's Feedback log with:

- Date (UTC).
- Clarity score 1–5 (see [`CALIBRATION.md`](CALIBRATION.md) §2.1).
- Which §2 / §3 / §4 / §5 step was missing or ambiguous (or "none").
- Action taken.

If clarity ≤ 2, you **must** edit the runbook the same week — not
mid-window or post-window. The point of the live edit is that the
next operator paged at 3 AM has the improved runbook. Threshold and
alert-rule files stay frozen; runbook *prose* is intentionally not
frozen.

### 4.3 Cadence

- **End of every day** (UTC) — review Alertmanager for fires you may
  have missed; ensure each has an `incidents.md` block.
- **Mid-window** (day 7 if running a 14-day window) — sanity-check the
  log: any single alert with ≥ 3 false positives is already grounds
  for the window's tuning case. No mid-window action; just note it.
- **End of window** (day N) — proceed to §6.

---

## 5. DO NOT — freeze rules during the window

These are non-negotiable. A window that broke any of these rules is
invalid evidence and must be restarted.

| Action | During the window |
|---|---|
| Change a Prometheus alert threshold | **Forbidden** |
| Change an alert `for:` window | **Forbidden** |
| Change an alert severity label | **Forbidden** |
| Change an SLO target in [`../SLO.md`](../SLO.md) | **Forbidden** |
| Change `concurrency_limit`, `per_host_concurrency_limit`, or any other engine config that affects load | **Forbidden** |
| Edit any `.rs` file under `crates/*` | **Forbidden** (engine is frozen for the window) |
| Remove a Grafana panel from `grafana-dashboard.json` | **Forbidden** |
| Silence an alert in Alertmanager outside a planned maintenance window | **Forbidden** |
| Silence an alert during a planned maintenance window | **Allowed** — but record the silence (start, end, reason) in `ops/incidents.md` |
| Append entries to `ops/incidents.md` and runbook Feedback logs | **Required** on every fire |
| Edit a runbook's diagnostic / action prose after using it | **Required** if clarity ≤ 2 (per §4.2) |
| Promote, demote, or rename a runbook file | **Forbidden** (file paths feed alert URLs) |
| Bump the engine version | **Forbidden** unless a security fix forces it; if forced, the window resets |
| Restart the engine for routine reasons | **Allowed**, but file a brief `incidents.md` block tagged `Triggered by: planned restart` |

The point of the freeze is to keep the data *comparable* across the
window. If thresholds or load shape move mid-window, the precision and
recall calculations in TUNING_REPORT §B become statistically
meaningless and the window must be discarded.

---

## 6. End-of-window procedure

When `WINDOW_END` arrives (day 7–14 depending on the planned length):

```text
1. Stop appending to ops/incidents.md and runbook Feedback logs.
   Backfill any fires from the last 24 h.

2. Edit ops/attestations/<YYYY-MM-DD>.md:
     - WINDOW_END = today's UTC date
     - tick every "verified" box in the checklist
     - sign at the bottom

3. Run the extraction:
     PROM=<live-prom> WINDOW=14d \
         tools/extract_tuning_data.sh
   → produces tuning-data-<UTC-date>/ with one JSON per query
     plus MANIFEST.txt and INDEX.txt.

4. Run the candidate classifier:
     tools/classify_alerts.sh \
         --extract tuning-data-<UTC-date> \
         --incidents ops/incidents.md \
         > classification_candidates.json
   → emits SUGGESTIONS only; none of these values lands in
     TUNING_REPORT.md without human review.

5. Walk classification_candidates.json against
   docs/observability/CLASSIFICATION_REVIEW.md. For each candidate:
   confirm or override the suggested TP/FP/uncertain count.

6. Build the §B markdown draft:
     tools/build_tuning_report.sh \
         classification_candidates.json \
         > /tmp/B_draft.md
   → review; copy CONFIRMED rows into TUNING_REPORT.md §B by hand.
   The "suggested:" prefix should NOT remain in the final file.

7. Walk TUNING_REPORT.md §A (admissibility), §C (PromQL baselines —
   from tuning-data-<UTC-date>/), §D (runbook effectiveness — from
   the runbook Feedback logs you appended during the window).

8. §E threshold-change ledger: if any tuning is proposed for v0.7.0,
   list each proposed change here with the §B / §C evidence row that
   justifies it. If no tuning is proposed, write "none — calibration
   confirmed" and proceed to sign-off.

9. §F sign-off: paste the attestation path and the operator name.
   Reference tuning-data-<UTC-date>/ in "Attached artefacts".
```

---

## 7. Exit conditions

A window ends in exactly one of two states. Both are valid; neither is
a failure.

### 7.1 Calibration confirmed

- §B precision per tier ≥ the targets in [`CALIBRATION.md`](CALIBRATION.md).
- No alert had ≥ 3 false positives.
- No incidents were missed.
- §C baselines align with [`../SLO.md`](../SLO.md) (no SLI exceeded
  its target during the window).

→ Outcome: a `TUNING_REPORT.md` with §E populated as "no changes
proposed", §F signed. No code change. The thresholds, SLOs, and
concurrency limits stay as they are.

### 7.2 Tuning warranted (proceed to v0.7.0)

At least one of:

- ≥ 3 false positives for the same alert, **or**
- ≥ 1 missed incident with user-visible impact, **or**
- §C baseline shows an SLI persistently outside its SLO target by a
  margin that is not explained by the load envelope.

→ Outcome: a `TUNING_REPORT.md` with §E listing each proposed change
mapped to §B / §C evidence, §F signed. v0.7.0 PR opens against the
proposed changes; no threshold lands without a §E row pointing to the
data that justified it.

### 7.3 Neither — extend or accept

If neither §7.1 nor §7.2 applies cleanly (e.g., 7-day window finished
with too few fires to compute precision), the answer is **extend the
window** to 14 days, not declare success or failure prematurely. If
the 14-day window also lacks data, the calibration is "confirmed by
absence of evidence to the contrary" — file the report as §7.1.

---

## See also

- [`../../ops/README.md`](../../ops/README.md) — discipline and freeze
  rules from the operator's side (this document is the engine-side
  view).
- [`../../ops/attestations/TEMPLATE.md`](../../ops/attestations/TEMPLATE.md)
  — the template you copy at §3 step 2.
- [`../../tools/preflight_check.sh`](../../tools/preflight_check.sh)
  — pre-flight automation for §2.
- [`TUNING_WORKFLOW.md`](TUNING_WORKFLOW.md) — end-to-end checklist
  from "window ended" to "PR ready" (this document is the operator
  view; TUNING_WORKFLOW is the engineer view).
- [`CALIBRATION.md`](CALIBRATION.md) §7 — "When NOT to tune", the
  underlying discipline that anchors §5 of this runbook.
- [`TUNING_REPORT.md`](TUNING_REPORT.md) — the deliverable.
