# RDAPify — Classification Review

> How to validate the candidates that
> [`tools/classify_alerts.sh`](../../tools/classify_alerts.sh) emits, before
> any number lands in [`TUNING_REPORT.md`](TUNING_REPORT.md) §B.
>
> The script is **suggestion-only**. It correlates fire counts from
> Prometheus with operator-curated entries in
> [`ops/incidents.md`](../../ops/incidents.md) and emits a
> [`classification_candidates.json`](DATA_MODEL.md) (schema in
> DATA_MODEL.md). Every value in that file is a candidate — wrong by
> default until the operator validates it.
>
> **All examples in this document are illustrative.** They describe
> the shape of a review, not actual production events.

---

## 1. The mental model

| Source | Source of truth for | Authority |
|---|---|---|
| Prometheus `ALERTS{...}` time series | when alerts fired and for how long | machine-objective; trust the numbers |
| `ops/incidents.md` | which fires were real / false / partial / unknown; the `Linked artefacts` field | **operator-curated; trust over the script** |
| `classification_candidates.json` | a *first guess* combining the above two | **suggestion only; never trust over either source** |
| Your own incident memory | edge cases, missing rows, judgment calls | **trust above all** |

If the script and `ops/incidents.md` disagree, **`ops/incidents.md`
wins**. Update the script's output (or fix `incidents.md` if it has
a typo / missing row) and re-run.

If the script and your memory disagree, **your memory wins**.
Add the missing or corrected `ops/incidents.md` entry, then re-run
the script. Don't override the script directly without paper-trail.

---

## 2. The decision tree

For each candidate object in `classification_candidates.json`:

```
                read the candidate
                       │
                       ▼
        confidence == "high"?
                       │
                ┌─── yes ──┐
                │          │
                ▼          ▼
        TP+FP == fires    do candidate counts match
        and unc == 0?     ops/incidents.md grep for
                │         this alert?
                │         (count `Real?: yes` and `: no`)
                │              │
                │     ┌──── yes ──── promote → ✅ confirmed
                │     │
                │     └──── no ───── investigate; either
                │                    ops/incidents.md is missing
                │                    rows, or the script
                │                    miscounted (regex edge case).
                │                    Fix incidents.md, re-run script.
                │
        confidence == "medium"?
                │
                ▼
        for each `uncertain` count > 0:
            walk the alert's fires in
            Prometheus (timestamp by timestamp);
            find the matching incidents.md entry
            (or add a new one);
            re-run the script
            until uncertain == 0
                │
                ▼
        re-classify per "high" branch above

        confidence == "low"?
                │
                ▼
        the operator did not log enough rows in
        ops/incidents.md during the window. Stop.
        Either:
            - close the gap (add missing rows, re-run), OR
            - mark §B with `(low confidence — see §F note)`
              and proceed to v0.6.x as Path B (calibration
              confirmed, no changes) — same as v0.6.7.
```

The `confidence` field is the script's self-assessment based on
how many fires have a matching `ops/incidents.md` row. It is **not**
a quality rating of the data.

---

## 3. Validating each candidate object

### 3.1 Pull up the matching `ops/incidents.md` rows

For each candidate (call its `alert` field `$ALERT`):

```sh
ALERT=RdapifyHighErrorRate

# How many entries does ops/incidents.md have for this alert?
grep -cE "^##+ [0-9]{4}-[0-9]{2}-[0-9]{2}.*— ${ALERT}$" ops/incidents.md

# What's the Real? distribution?
awk -v a="$ALERT" '
  /^##+ [0-9]{4}-[0-9]{2}-[0-9]{2}/ {
    inblock = ($0 ~ "— " a "$")
  }
  inblock && /^- \*\*Real\?\*\*:/ { print }
' ops/incidents.md
```

The first command's count must equal `candidates.true_positive +
candidates.false_positive + (operator-classified-uncertain)`. If
not — the script has missed rows or the incidents.md format is
non-canonical.

The second command's `Real?: yes/no/partial/unknown` distribution
must match the candidate's `true_positive` / `false_positive`
counts. If not — adjust the script or fix the incidents.md row,
re-run.

### 3.2 Cross-check the evidence array

The candidate's `evidence` array contains:

- `incident:<timestamp>` (v0.6.10 format) — for each `real_yes`
  row in `ops/incidents.md`, the heading-line timestamp
  (`YYYY-MM-DD HH:MM UTC`).
- `metric:<short-name> value=<scalar>` — a single supporting
  metric reading from `tools/extract_tuning_data.sh` output.

For each `incident:<timestamp>`:

- [ ] Open `ops/incidents.md`; locate the entry whose heading
      matches the timestamp exactly. The row should exist (the
      script extracted the timestamp from it).
- [ ] Open the row's `Linked artefacts` field; if it points at a
      tracker ID, confirm the incident exists in the tracker.
- [ ] Confirm the incident matches the alert (right cause class,
      right time window).
- [ ] If the incident is closed without a postmortem and was a TP,
      that's calibration debt — file a postmortem request.

Cross-referencing by timestamp (rather than artefact ID) makes co-
firing alerts easier to spot: two alerts sharing
`incident:2026-04-22 09:08 UTC` in their evidence arrays both
fired for the same minute. See §4.4 below.

For the `metric=...` hint:

- [ ] Compare the value against the §C baseline you'd expect for
      this alert. For `RdapifyHighErrorRate`, the metric hint is
      typically `error_rate_typical` — values above ~0.02 are
      consistent with a 5 % alert threshold being approached. Below
      that, the alert was either short-lived or the value isn't
      typical of the firing window.

The metric hint is *advisory*. It's the typical value during the
*window*, not the value at fire time. Don't promote it to evidence
for a specific TP/FP claim.

### 3.3 Re-classify uncertain fires

If a candidate has `uncertain > 0`, the script could not match those
fires to incidents.md rows. Walk each unmatched fire:

```promql
# Find all fire timestamps for this alert in the window.
ALERTS{alertstate="firing", alertname="RdapifyHighErrorRate"}
```

For each fire timestamp:

- [ ] Find the matching `ops/incidents.md` row (timestamp ± few minutes).
- [ ] If a row exists but was missed by the script (heading-format
      drift, encoding issue, missing `Real?:` line), fix the row
      and re-run.
- [ ] If no row exists — there should be one. Add it now using the
      schema from `ops/incidents.md`. Once added, re-run the
      script.
- [ ] If the fire happened during a *known-benign* event (e.g. a
      controlled deploy that flushed the cache) and you forgot to
      log it: this is the most common case. Add the row with
      `Real?: no` and `Linked artefacts: deploy-<date>`.

Do **not** classify `uncertain` directly to TP or FP without a
new `ops/incidents.md` row. The audit trail matters more than
filling the cell.

### 3.4 Promote to TUNING_REPORT.md §B

Only after the candidate passes §3.1–§3.3:

1. Open [`TUNING_REPORT.md`](TUNING_REPORT.md) §B.
2. Find the row for this alert.
3. Copy the **confirmed** values (without the `suggested:` prefix)
   into the cells.
4. Leave the `proposed_change` column **empty** unless §E
   reasoning is complete.
5. **Do not copy** `incidents_caught` or `total_incidents` from
   the candidate object — the script does not produce these. They
   require human judgment per
   [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) §4.5 and
   §5.

The draft markdown produced by
[`tools/build_tuning_report.sh`](../../tools/build_tuning_report.sh)
is a side-by-side reference for this step — you copy from the
draft only after every value is confirmed.

---

## 4. Common review findings (illustrative)

> *Examples below describe shape, not actual events.*

### 4.1 The script and `ops/incidents.md` agree completely

```json
{
  "generated_at": "2026-05-01T03:14:00Z",
  "window": "2026-04-17 → 2026-05-01",
  "alerts": [
    {
      "alert": "RdapifyCacheHitRatioLow",
      "fires": 3,
      "candidates": {"true_positive": 0, "false_positive": 3, "uncertain": 0},
      "evidence": ["metric:no metric correlation available"],
      "confidence": "high",
      "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
    }
  ]
}
```

Three `Real?: no` rows in `ops/incidents.md` — all post-deploy
cache cold-starts. Promote: `fires=3, TP=0, FP=3` into §B.

This is also the trigger for the v0.6.x release note: "≥ 3 false
positives unlocks CALIBRATION §7.2 — relax the
`RdapifyCacheHitRatioLow` threshold or extend its `for:` window".
But that decision belongs to §E reasoning, not this section.

### 4.2 High confidence but TP count looks wrong

```json
{
  "alert": "RdapifyHighErrorRate",
  "fires": 5,
  "candidates": {"true_positive": 2, "false_positive": 0, "uncertain": 3},
  "evidence": [
    "incident:2026-04-22 09:08 UTC",
    "incident:2026-04-29 14:32 UTC",
    "metric:error_rate_typical value=0.018"
  ],
  "confidence": "medium",
  "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
}
```

(The wrapping envelope is omitted in §4.2–§4.4 examples for brevity;
the full document always carries `generated_at` / `window` /
`alerts` per §4.1.)

The script counted 2 TPs from rows where `Real?: yes`. But you
remember 4 real incidents. Two of them never got logged to
`ops/incidents.md`. Action:

- Add the 2 missing rows with `Real?: yes` and the postmortem
  links.
- Re-run `classify_alerts.sh`.
- Expect the next pass: `TP=4, uncertain=1, confidence=medium`.
- Walk the remaining 1 uncertain fire (§3.3).

### 4.3 Low confidence — operator gap

```json
{
  "alert": "RdapifyBreakerFlapping",
  "fires": 2,
  "candidates": {"true_positive": 0, "false_positive": 0, "uncertain": 2},
  "evidence": ["metric:breaker_total_flaps value=14"],
  "confidence": "low",
  "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
}
```

The script could not match either fire to an incidents.md row.
Either:

- Both fires happened during the window and you didn't log them
  (calibration debt; add rows, re-run).
- The fires were genuinely unattributable in retrospect (rare; if
  so, add the rows with `Real?: unknown` and a free-form note).

If the fires turn out to be unattributable, the §B row stays:
`fires=2, TP=0, FP=0, uncertain=2, precision=undefined`. Mark
the report's §F note: *"low-confidence rows for ${ALERT} —
recommend extending the next observation window before tuning"*.

### 4.4 Single-incident, multiple-alert co-fire

Two adjacent objects in the `alerts` array, sharing the same
incident anchor:

```json
{
  "alert": "RdapifyErrorBudgetFastBurn",
  "fires": 1,
  "candidates": {"true_positive": 1, "false_positive": 0, "uncertain": 0},
  "evidence": ["incident:2026-04-22 09:08 UTC", "metric:error_rate_typical value=0.073"],
  "confidence": "high",
  "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
}
```

```json
{
  "alert": "RdapifyHighErrorRate",
  "fires": 1,
  "candidates": {"true_positive": 1, "false_positive": 0, "uncertain": 0},
  "evidence": ["incident:2026-04-22 09:08 UTC", "metric:error_rate_typical value=0.073"],
  "confidence": "high",
  "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
}
```

The shared `incident:2026-04-22 09:08 UTC` evidence makes the
co-fire visible at the JSON level (v0.6.9's `incident:<id>` only
exposed this if the operator linked the same artefact ID to both
rows — which they often forgot to do).

Both fired for the same upstream outage (per
[`PATTERNS.md`](PATTERNS.md) §1). Both are TP. But the
`incidents_caught` column in §B should bump by **only 1**, not 2 —
ALERT_CLASSIFICATION.md §4.5 rule. The script doesn't compute
`incidents_caught` (by design); the operator does.

---

## 5. Do / don't summary

### Do

- ✅ Treat every script output as a candidate, not a fact.
- ✅ Cross-check against `ops/incidents.md` line by line for any row
  with `confidence != "high"`.
- ✅ Add missing `ops/incidents.md` rows during review and re-run.
- ✅ Promote only confirmed values; without the `suggested:` prefix.
- ✅ Compute `incidents_caught` and `total_incidents` yourself per
  [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) §4.5.
- ✅ Save the candidate JSON alongside §F "Attached artefacts" so
  future reviewers can audit the chain.

### Don't

- ❌ Don't pipe `classify_alerts.sh` straight into TUNING_REPORT.
- ❌ Don't promote `uncertain` to TP/FP without an
  `ops/incidents.md` row.
- ❌ Don't override the script silently. If the script's count
  differs from incidents.md, fix the source (incidents.md OR the
  script's input data), then re-run.
- ❌ Don't classify a fire as TP just because the alert is critical.
  Severity is independent of realness.
- ❌ Don't use `confidence: high` as a green light to skip review.
  *High* means the script could match every fire — it does not
  mean the matches are correct.
- ❌ Don't edit `prometheus-alerts.yaml`, `grafana-dashboard.json`,
  `SLO.md`, or any runbook based on candidates without the §E
  ledger flow per [`CALIBRATION.md`](CALIBRATION.md) §7.

---

## 6. Where to file fixes

If during review you find:

| Finding | Fix in |
|---|---|
| Heading format in `ops/incidents.md` doesn't match script's regex | the row in `ops/incidents.md` (canonical schema is in the file's header) |
| Missing `Real?:` line in an entry | the row in `ops/incidents.md` |
| Script regex misses a valid format | open a docs PR — extend `tools/classify_alerts.sh` *only* if the format is operator-canonical |
| Incident lacks a `Linked artefacts` ID | your incident tracker; add the link, then update the row |
| Count discrepancy with no obvious cause | document under §F "Notes during review" — this is calibration data |

The script will not be the final arbiter of any §B value. **Every
number that lands in TUNING_REPORT.md is operator-confirmed.**

---

## 7. Reference index

- [`DATA_MODEL.md`](DATA_MODEL.md) — formal JSON schema for
  `classification_candidates.json`.
- [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) — TP / FP
  / Missed definitions and the worked-example precision/recall
  formulas.
- [`TUNING_WORKFLOW.md`](TUNING_WORKFLOW.md) — end-to-end
  workflow; assisted classification is Step 2.5 (added in v0.6.9).
- [`CALIBRATION.md`](CALIBRATION.md) §7 — the hard preconditions
  every tuning PR must pass.
- [`../../ops/README.md`](../../ops/README.md) — observation
  window discipline.

---

_Last updated: 2026-05-01 (v0.6.9). All §4 examples illustrative._
