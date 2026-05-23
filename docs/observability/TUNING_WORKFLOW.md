# RDAPify — Tuning Workflow

> Step-by-step end-to-end checklist for one tuning cycle. Walks the
> operator from *"the observation window has ended"* to *"the v0.6.x
> release is ready to merge"*.
>
> Each step links to the supporting document; if you only have time
> for one of these, [`CALIBRATION.md`](CALIBRATION.md) §7 is the
> hard-rules reference.

---

## Prerequisites

Before step 1, confirm:

- [ ] Observation window has actually run for ≥ 7 days (per
      [`CALIBRATION.md`](CALIBRATION.md) §7.3).
- [ ] No rdapify-impacting incident is currently open
      ([`CALIBRATION.md`](CALIBRATION.md) §7.4).
- [ ] [`ops/incidents.md`](../../ops/incidents.md) has been kept
      current throughout the window — every fire and every
      off-alert incident has an entry.
- [ ] Runbook Feedback log sections in
      [`runbooks/`](runbooks/) have entries for every fire that
      used a runbook.
- [ ] No engine deploy mid-window changed default thresholds
      (TUNING_REPORT §A admissibility check #2).

If any unchecked, **stop**. Either extend the window or invalidate
it and start over.

---

## Step 1 — Collect metrics

Decide the window dates (UTC). For each PromQL query in
[`QUERIES.md`](QUERIES.md), substitute `${WINDOW}` and `${SCRAPE}`
with your values.

### Option A — automated (recommended)

```sh
PROM=https://prometheus.example.com WINDOW=14d SCRAPE=30 \
  tools/extract_tuning_data.sh
```

Output is per-query JSON in `./tuning-data-<UTC-date>/` with an
`INDEX.txt` mapping each file to the matching TUNING_REPORT
section.

### Option B — manual

Open Prometheus UI; for each query in [`QUERIES.md`](QUERIES.md),
paste, evaluate, copy the value into the matching TUNING_REPORT
cell. See [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md) §1.

### Pre-flight checks (run these first)

Before writing any number into TUNING_REPORT, verify the window is
admissible:

```promql
# 1. Engine UP for the entire window.
min_over_time(up{job="rdapify"}[14d])    # expect 1

# 2. Engine emitted metrics.
absent(rdap_requests_total)              # expect empty

# 3. Cardinality is sane.
count({__name__=~"rdap_.*"})             # expect 50–500

# 4. No alert is currently firing.
ALERTS{alertstate="firing"}              # expect empty
```

If any check fails: do not proceed. Document why the window is not
admissible, then either extend or restart.

---

## Step 2 — Export data

The extract script in step 1 is the export. If you used the manual
path, your numbers are already in TUNING_REPORT cells and step 2
is mostly bookkeeping.

---

## Step 2.5 — Assisted classification (optional, added v0.6.9)

If you used the automated path in Step 1 *and* `ops/incidents.md`
was populated during the observation window, you can use
[`tools/classify_alerts.sh`](../../tools/classify_alerts.sh) to
generate candidate TP/FP/uncertain counts before walking
[`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) §2 by hand.

```sh
DATA_DIR=tuning-data-2026-05-01 \
INCIDENTS=ops/incidents.md \
WINDOW=14d \
  tools/classify_alerts.sh > classification_candidates.json

CANDIDATES=classification_candidates.json \
  tools/build_tuning_report.sh > B_draft.md
```

**The output is advisory only.** As of v0.6.10 the
`classification_candidates.json` format is an envelope with
`generated_at` / `window` (concrete-date range) / `alerts[]`. Every
alert object inside the envelope carries the marker:

> `"note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"`

And every numeric cell in `B_draft.md` is prefixed `suggested_tp:`,
`suggested_fp:`, or `suggested_uncertain:`. Neither file is
`TUNING_REPORT.md`. Neither file is authoritative.

Before promoting any value into TUNING_REPORT.md §B:

1. Read [`CLASSIFICATION_REVIEW.md`](CLASSIFICATION_REVIEW.md) §2
   (decision tree).
2. For each candidate:
   - `confidence: "high"` → cross-check the count against
     `grep -c` of `ops/incidents.md` for that alert; promote on
     match.
   - `confidence: "medium"` → walk each unmatched fire per
     CLASSIFICATION_REVIEW.md §3.3; close the gap; re-run.
   - `confidence: "low"` → close incidents.md gaps before
     proceeding (or accept that this alert can't be classified
     this window — `_low confidence — see §F note_`).
3. Compute `incidents_caught` and `total_incidents` yourself —
   the script does **not** produce these
   ([`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) §5).
4. Copy *confirmed* values (without the `suggested_tp:` /
   `suggested_fp:` / `suggested_uncertain:` prefixes) into
   TUNING_REPORT.md §B.

**Do not skip Step 3.** The script reduces lookup friction; it
does not replace the operator's judgment.

The candidate JSON should be saved alongside §F "Attached artefacts"
so future reviewers can audit the chain
(input → classify_alerts → review → §B values).

Schema reference: [`DATA_MODEL.md`](DATA_MODEL.md).

Required artefacts to attach to TUNING_REPORT §F:

- [ ] Permalinks (or screenshots) for each Grafana panel referenced.
- [ ] Prometheus `query_range` URLs for any latency / availability
      time series cited.
- [ ] Incident IDs from your ticket tracker for every TP / Missed
      row.
- [ ] The `tuning-data-<date>/MANIFEST.txt` if you used the script.

Save artefacts in a private location your team controls. Do not
commit production-data dumps to the repo.

For range-query CSV-export tips: [`EXPORT_GUIDE.md`](EXPORT_GUIDE.md)
§§2–3.

---

## Step 3 — Classify alerts

For every fire in the window:

1. Open [`ops/incidents.md`](../../ops/incidents.md).
2. For each chronological entry, follow the decision tree in
   [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) §2.
3. Land each fire in exactly one of: TP, FP, Missed.
4. Cross-check with the runbook Feedback log entries — every
   TP/FP fire that used a runbook should appear in both places.

For every incident in the window that **didn't** fire an alert:

1. Add an entry to `ops/incidents.md` with
   `Triggered by: (no alert fired)`.
2. Note which alert *should* have caught it. That alert's row in
   §B will get `incidents_caught < total_incidents`.

When done, count per alert:

- `fires` (TP + FP rows for this alert)
- `true_positives` (TP rows for this alert)
- `false_positives` (FP rows for this alert)
- `precision` = TP / fires
- `incidents_caught` (distinct incidents where this alert was first
  to fire)
- `total_incidents` (sum across all alerts + missed rows; same
  denominator on every row)
- `recall` = incidents_caught / total_incidents

Worked example: [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md)
§5.1.

---

## Step 4 — Fill TUNING_REPORT

Open [`TUNING_REPORT.md`](TUNING_REPORT.md). Fill in:

- [ ] **§A Scope** — environment, window dates, request-rate
      scalars, all five admissibility checkboxes ticked.
- [ ] **§B Alert evaluation** — every cell in every row populated
      from step 3. `proposed_change` stays blank until §E is
      reasoned.
- [ ] **§C.1–§C.6 Metric baselines** — paste numbers from step 1
      into Observed / Min / Avg / Max columns. Comments column
      flags anything unexpected.
- [ ] **§D Runbook effectiveness** — one row per runbook from the
      runbook Feedback log entries. `clarity_rating` is operator
      judgment per the scale in TUNING_REPORT §D.
- [ ] **§E Threshold change ledger** — only fill rows here once you
      have evidence in §B/§C/§D for them. Walk the
      [`CALIBRATION.md`](CALIBRATION.md) §7 gate per proposed
      change. If no proposed changes meet the gates, this section
      stays empty — and that's the v0.6.x sign-off path.
- [ ] **§F Sign-off** — author + reviewer rows; if no §E entries,
      use the "Calibration confirmed" subsection (added in v0.6.7
      sign-off).

Honest blanks beat estimated cells. CALIBRATION.md §7.1 is explicit:
*"A blank cell is honest; an estimated cell is calibration debt."*

---

## Step 5 — Validate completeness

Before opening the v0.6.x PR, confirm:

### 5.1 Admissibility (§A)

- [ ] Window length ≥ 7 days (≥ 14 d preferred).
- [ ] All 5 §A admissibility checkboxes ticked.
- [ ] No mid-window deploy changed defaults.
- [ ] Pre-flight queries (Step 1) all returned expected values.

### 5.2 Evidence (§B/§C/§D)

- [ ] Every cell in §B is non-empty.
- [ ] Every metric family in §C has Observed / Min / Max populated.
- [ ] Every runbook in §D has a clarity rating and missing-steps
      note (or "n/a — not used in window").

### 5.3 Per proposed change in §E (if any)

For each row in §E, confirm:

- [ ] Evidence column references a §B/§C/§D anchor (not "operator
      intuition", not "industry best practice").
- [ ] The change's *direction* matches the
      [`CALIBRATION.md`](CALIBRATION.md) §7 rules:
  - Lowering sensitivity → ≥ 3 FPs in §B.
  - Raising sensitivity → ≥ 1 missed-incident row in §B.
  - SLO change → §C baseline + stakeholder signature in §F.
  - Panel removal → §D shows the panel was unconsulted.
- [ ] Threshold is not in the §6 "do not tune" list.
- [ ] The proposed value is reversible — i.e. if it's wrong, the
      next tuning window can revert it.

### 5.4 Sign-off (§F)

- [ ] Author row signed (operator who collected data).
- [ ] Engine-team reviewer row signed.
- [ ] If §E touches an SLO target, stakeholder row signed.
- [ ] Final approver row signed.
- [ ] Attached artefacts checklist all ticked.

If any 5.x checkbox is unticked, **the PR is not ready**.

---

## Step 6 — Open the v0.6.x PR

The PR may be either:

| Path | When | What ships |
|---|---|---|
| **A — Tuning** | §E has approved rows | Edits to `prometheus-alerts.yaml` / runbook §3-§4 / `SLO.md` per §E ledger. CHANGELOG entry cites every §E row. |
| **B — Calibration confirmed** | §E is empty (no changes meet the gates) | Edits to `TUNING_REPORT.md` §F only. CHANGELOG entry of the v0.6.7 shape: "no thresholds changed; freeze hashes recorded". |

Both paths are valid. Path B is what shipped in v0.6.7.

PR description must:

1. Link the populated TUNING_REPORT.md.
2. Show the freeze MD5s for `prometheus-alerts.yaml`,
   `grafana-dashboard.json`, `SLO.md` — either matching v0.6.x-1
   baselines (path B) or with explicit per-line diffs (path A).
3. Link every approved §E row to the matching change.

---

## Step 7 — Post-application

After merge:

- [ ] Update each affected runbook's `## Feedback log` →
      "Last calibration review" line with the report date and
      outcome (kept / tuned / downgraded / deleted).
- [ ] Tick the matching item in
      [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md) Phase 4
      (steady state).
- [ ] Archive the populated TUNING_REPORT in
      `docs/observability/tuning-reports/<YYYY-MM-DD>.md` (the
      template's §F "Post-application steps" call this out).
- [ ] If §E touched any threshold, post a brief team-channel
      summary: report date, what changed, why, link to §B/§C
      evidence.

---

## Skip table — when this workflow doesn't apply

| Situation | What instead |
|---|---|
| Window is < 7 days | Extend the window; do not run this. |
| An incident is currently open | Wait for resolution + postmortem. |
| Engine source code change is being proposed | Different workflow — engine PRs go through code review, not this report. Tuning reports never modify `.rs` files. |
| Adding a new metric | Different workflow — see METRICS.md and the Stage D add-metric process. Cardinality budget review required. |
| Burn-rate alert tuning specifically | Same workflow, but CALIBRATION §6 lists the burn-rate multipliers as "do not tune" — they're anchored to Google SRE MWMBR. |

---

## Quick command reference

```sh
# Step 1 — pull the data
PROM=https://prometheus.example WINDOW=14d SCRAPE=30 \
  tools/extract_tuning_data.sh

# Step 5.1 — verify freeze before opening PR
md5sum docs/observability/prometheus-alerts.yaml \
       docs/observability/grafana-dashboard.json \
       docs/SLO.md

# Step 5.2 — confirm cardinality stayed bounded
# (run in Prometheus)
# count({__name__=~"rdap_.*"})

# Step 6 — release-validator (workspace test)
cargo test --workspace --release
cargo clippy --workspace --release -- -D warnings
```

---

_Last updated: 2026-04-30 (v0.6.8). Workflow shape is stable across
the v0.6.x series; QUERIES / EXPORT_GUIDE / ALERT_CLASSIFICATION
get updates if metric set or alert rules change._
