# RDAPify — Data Model

> Formal schema for `classification_candidates.json` produced by
> [`tools/classify_alerts.sh`](../../tools/classify_alerts.sh) and consumed by
> [`tools/build_tuning_report.sh`](../../tools/build_tuning_report.sh).
>
> **v0.6.10 ships a breaking format change.** The top-level shape moved
> from a JSON array to a JSON object envelope carrying `generated_at`,
> `window`, and `alerts`. v0.6.9 files are not consumable by v0.6.10
> tools and vice versa — see §7 (Migration).
>
> The schema is **stable across the v0.6.10+ minor series**. Adding a new
> top-level field is a minor-version compatible change; renaming or
> removing one is not.

---

## 1. Overview

A v0.6.10 `classification_candidates.json` document is a **JSON object
envelope** containing:

- `generated_at` — ISO 8601 UTC timestamp of when the candidate set
  was extracted. This is `date -u +"%Y-%m-%dT%H:%M:%SZ"`-shaped.
- `window` — the observation period as a concrete date range:
  `"YYYY-MM-DD → YYYY-MM-DD"`. Derived from the script input or
  set explicitly via `WINDOW_START` / `WINDOW_END`.
- `alerts` — array of per-alert candidate objects (the same per-alert
  shape that v0.6.9 emitted at the top level).

```jsonc
// classification_candidates.json — example shape (illustrative)
{
  "generated_at": "2026-05-01T03:14:00Z",
  "window": "2026-04-17 → 2026-05-01",
  "alerts": [
    {
      "alert": "RdapifyHighErrorRate",
      "fires": 4,
      "candidates": {
        "true_positive": 1,
        "false_positive": 0,
        "uncertain": 3
      },
      "evidence": [
        "incident:2026-04-30 14:32 UTC",
        "metric:error_rate_typical value=0.024"
      ],
      "confidence": "medium",
      "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
    }
    // … one object per alert appearing in the fire-count input
  ]
}
```

Every value above is **illustrative** — the actual numbers come
from your observation window and `ops/incidents.md` classifications.

---

## 2. Field reference

### Root: object envelope

| Field | Type | Required | Constraints |
|---|---|---|---|
| `generated_at` | string | yes | ISO 8601 UTC timestamp, `Z`-suffixed (e.g. `"2026-05-01T03:14:00Z"`). Set by the producing script via `date -u +"%Y-%m-%dT%H:%M:%SZ"`. |
| `window` | string | yes | Concrete date range: `"YYYY-MM-DD → YYYY-MM-DD"` with the literal arrow `→` (U+2192) between the two dates. The dates are inclusive. |
| `alerts` | array | yes | Array of per-alert candidate objects (§2.1). May be empty `[]` if the window had no fires. |

### 2.1 Alert candidate object (each `alerts[]` entry)

| Field | Type | Required | Constraints |
|---|---|---|---|
| `alert` | string | yes | Alert name as it appears in `prometheus-alerts.yaml` (e.g. `RdapifyHighErrorRate`). MUST exist in the loaded rules. |
| `fires` | integer ≥ 0 | yes | Total fires for this alert during the window. Equals `changes(ALERTS{alertstate="firing", alertname=$alert}[$window])`. |
| `candidates` | object | yes | See §2.2. |
| `evidence` | array of strings | yes | See §2.3. May be empty `[]` if no incidents.md rows linked an artefact AND no metric correlation was found, but the array key must exist. |
| `confidence` | enum | yes | One of `"low"`, `"medium"`, `"high"`. See §2.4. |
| `note` | string | yes | Constant: `"SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"` (uppercase). The presence of this exact string MUST be preserved by any tool that copies or augments the candidate object. Removing or altering it is a v0.6.10 spec violation. |

> **Removed in v0.6.10**: the per-object `window` field. The window
> is now in the envelope, not duplicated per alert. Tooling that
> consumed `alerts[].window` in v0.6.9 must read `(top-level).window`
> instead.

### 2.2 `candidates` (nested object)

| Field | Type | Required | Constraints |
|---|---|---|---|
| `true_positive` | integer ≥ 0 | yes | Suggested TP count derived from `ops/incidents.md` rows where `Real?: yes` AND the entry's alert name matches. |
| `false_positive` | integer ≥ 0 | yes | Suggested FP count derived from rows where `Real?: no`. |
| `uncertain` | integer ≥ 0 | yes | `fires - (true_positive + false_positive)` plus rows with `Real?: partial` or `Real?: unknown`. Represents fires that the script could not confidently classify. |

**Invariant**: `true_positive + false_positive + uncertain == fires`
when `confidence == "high"`. When `confidence` is `"medium"` or
`"low"`, the sum may be less than `fires` (because some fires have
no incidents.md row at all and were folded into `uncertain`).

### 2.3 `evidence` array

Each string entry SHOULD match one of two patterns:

- **`incident:<timestamp>`** (v0.6.10 format) — references the
  heading timestamp of an `ops/incidents.md` entry, e.g.
  `"incident:2026-04-30 14:32 UTC"`. The `<timestamp>` portion is
  the literal heading-line timestamp (`YYYY-MM-DD HH:MM UTC`).
  Up to 5 incident references per candidate by convention.
- **`metric:<short-name> value=<scalar>`** — a single supporting
  metric reading from `tools/extract_tuning_data.sh` output. The
  `<short-name>` is the file basename without the `C[0-9]__` prefix
  (e.g. `error_rate_typical`); `<scalar>` is a string representation
  of a number, parseable by Python's `float()`.

If neither pattern applies, the script emits a single explanatory
string (e.g. `"metric:no metric correlation available"`).
Such entries are advisory only — they MUST NOT be used as TP/FP
evidence in §B.

> **Format change in v0.6.10**: evidence references in v0.6.9 used
> `incident:<id>` (the operator-curated `Linked artefacts` ID).
> v0.6.10 uses `incident:<timestamp>` (the heading anchor) for
> chronological traceability and easier cross-reference with logs
> and metrics graphs.

### 2.4 `confidence` enum

| Value | Meaning | When emitted |
|---|---|---|
| `"high"` | Every fire matches an `ops/incidents.md` row with an explicit `Real?: yes` or `Real?: no` classification. No `Real?: partial` or unknown rows for this alert in the window. | `(true_positive + false_positive) == fires AND uncertain == 0` |
| `"medium"` | At least one fire has an explicit classification, but some fires remain unmatched or carry partial/unknown classifications. | `(true_positive + false_positive) > 0` AND not `"high"` |
| `"low"` | No fires have a matching incidents.md row with explicit `Real?:` value. The candidate counts are placeholders only. | `(true_positive + false_positive) == 0` AND `fires > 0` (or `fires == 0`) |

**Confidence is the script's self-assessment of its own input
quality, not a quality rating of the alert or the operator.** A
`"low"` confidence row is calibration debt to close before tuning
can proceed.

---

## 3. Constraints (hard rules)

The following constraints MUST hold for a valid v0.6.10
`classification_candidates.json`:

1. **Top-level type**: JSON object (`{ ... }`) with the three
   required envelope keys. **Not** an array (that's v0.6.9).
2. **`generated_at`** matches the regex
   `^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$`
   (basic ISO 8601 UTC).
3. **`window`** matches the regex
   `^[0-9]{4}-[0-9]{2}-[0-9]{2} → [0-9]{4}-[0-9]{2}-[0-9]{2}$`
   (with literal `→` U+2192).
4. **Alert object completeness**: every required field in §2.1 must
   be present. Tools may accept additional fields
   (`additionalProperties: true` for forward-compat) but MUST NOT
   rely on them.
5. **Numeric non-negativity**: `fires`, `true_positive`,
   `false_positive`, `uncertain` are all `≥ 0`.
6. **Sum invariant** (when `confidence == "high"`):
   `true_positive + false_positive + uncertain == fires`.
7. **Note preservation**: the `note` field must equal exactly
   `"SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"` (uppercase
   `REQUIRES`).
8. **Confidence values**: exactly one of `"low"`, `"medium"`,
   `"high"`.
9. **Alert name**: matches the regex `^[A-Za-z][A-Za-z0-9_]+$`.
   Must be a real alert in `prometheus-alerts.yaml`.

A file that violates any constraint is malformed.
`build_tuning_report.sh` v0.6.10 explicitly refuses to consume v0.6.9
files (top-level array) — see §7.

---

## 4. JSON Schema (informal)

For tooling that supports JSON Schema 2020-12, the schema below
captures the v0.6.10 constraints:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "classification_candidates",
  "type": "object",
  "required": ["generated_at", "window", "alerts"],
  "additionalProperties": true,
  "properties": {
    "generated_at": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$"
    },
    "window": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2} → [0-9]{4}-[0-9]{2}-[0-9]{2}$"
    },
    "alerts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["alert", "fires", "candidates", "evidence", "confidence", "note"],
        "additionalProperties": true,
        "properties": {
          "alert": {
            "type": "string",
            "pattern": "^[A-Za-z][A-Za-z0-9_]+$"
          },
          "fires": {
            "type": "integer",
            "minimum": 0
          },
          "candidates": {
            "type": "object",
            "required": ["true_positive", "false_positive", "uncertain"],
            "additionalProperties": false,
            "properties": {
              "true_positive":  { "type": "integer", "minimum": 0 },
              "false_positive": { "type": "integer", "minimum": 0 },
              "uncertain":      { "type": "integer", "minimum": 0 }
            }
          },
          "evidence": {
            "type": "array",
            "items": { "type": "string" }
          },
          "confidence": {
            "enum": ["low", "medium", "high"]
          },
          "note": {
            "const": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
          }
        }
      }
    }
  }
}
```

This schema is informational. The producer
([`tools/classify_alerts.sh`](../../tools/classify_alerts.sh))
emits compliant output by construction; the consumer
([`tools/build_tuning_report.sh`](../../tools/build_tuning_report.sh))
treats violations as missing data rather than aborting (except for
the v0.6.9-array-format case, which it explicitly rejects).

---

## 5. What the model deliberately does NOT include

- **`incidents_caught` and `total_incidents`** — recall calculation
  inputs. These require human judgment (alert co-firing, cross-
  alert incident attribution) and cannot be computed from fire
  counts alone. See [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md)
  §4.5 and §5.
- **`proposed_change`** — any threshold-change proposal belongs in
  TUNING_REPORT §E with §B/§C/§D evidence anchors. Not a
  candidate-level field.
- **Free-form operator notes** — go in `ops/incidents.md`, not in
  the candidate JSON.
- **Severity** — bounded by the alert's static `severity` label;
  not part of the candidate.
- **Per-fire timestamps** — the schema records aggregated counts.
  Per-fire detail lives in Prometheus's `ALERTS` series. The
  envelope's `window` field is the only time anchor at the document
  level; per-incident anchors live in the `evidence` array via
  `incident:<timestamp>`.

---

## 6. Versioning

| Schema rev | Released with | Change |
|---|---|---|
| 1 | v0.6.9 | Initial schema. Top-level array of alert objects. `note: "SUGGESTION ONLY — requires human validation"` (lowercase). Evidence: `incident:<id>`. |
| **2** | **v0.6.10** (**this document**) | **Breaking change.** Envelope shape: top-level object with `generated_at` + `window` (concrete dates) + `alerts` array. Note string uppercased: `"SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"`. Evidence: `incident:<timestamp>`. Per-object `window` field removed. |

Future revisions add fields. Any breaking change (rename, remove,
type change) requires a major-version bump on the schema document
and a coordinated update of producer + consumer scripts. The
v0.6.10 break is documented as a one-time hardening.

The `note` field's exact value is part of the schema contract — it
is the suggestion-only marker. Tooling that strips or alters this
field violates the schema.

---

## 7. Migration (v0.6.9 → v0.6.10)

### What changed

| Aspect | v0.6.9 | v0.6.10 |
|---|---|---|
| Top-level shape | array `[ {...}, {...} ]` | object envelope `{ "generated_at": ..., "window": ..., "alerts": [ ... ] }` |
| Per-object `window` | `"14d"` (Prometheus duration) | (removed; envelope-level instead) |
| Envelope `window` | (n/a) | `"YYYY-MM-DD → YYYY-MM-DD"` (concrete dates) |
| Evidence references | `incident:<id>` (linked artefact) | `incident:<timestamp>` (heading anchor) |
| `note` casing | `"SUGGESTION ONLY — requires human validation"` | `"SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"` |

### Why this is breaking, not additive

The envelope-vs-array change cannot be backward-compatibly merged.
Any consumer that does `json.load(f)` and iterates would receive
either an array (v0.6.9) or a dict (v0.6.10) — code paths diverge.

The `incident:<id>` → `incident:<timestamp>` change is also
non-mergeable: existing consumers may have used the ID as a foreign
key into their incident tracker. The timestamp is a different
identity.

### Migration path

There is no transformation tool. **Re-run
`tools/classify_alerts.sh`** to regenerate
`classification_candidates.json` in the v0.6.10 envelope shape from
the same `extract_tuning_data.sh` output and the same
`ops/incidents.md`. The candidate counts will be identical (same
inputs, same algorithm); only the *shape* of the output changes.

Old v0.6.9 `classification_candidates.json` files should be
**archived** with their generation date, not migrated. They remain
valid evidence for the v0.6.x release they were produced for.

`build_tuning_report.sh` v0.6.10 explicitly detects and rejects
v0.6.9-shape inputs with a diagnostic instructing the operator to
re-run `classify_alerts.sh`.

---

## 8. Sample valid v0.6.10 documents

### 8.1 Empty window (no fires)

```json
{
  "generated_at": "2026-05-01T03:14:00Z",
  "window": "2026-04-17 → 2026-05-01",
  "alerts": []
}
```

Valid. Means no alerts fired during the window. Equivalent §B
draft is empty.

### 8.2 Single high-confidence row

```json
{
  "generated_at": "2026-05-01T03:14:00Z",
  "window": "2026-04-17 → 2026-05-01",
  "alerts": [
    {
      "alert": "RdapifyCacheHitRatioLow",
      "fires": 3,
      "candidates": {
        "true_positive": 0,
        "false_positive": 3,
        "uncertain": 0
      },
      "evidence": [
        "metric:no metric correlation available"
      ],
      "confidence": "high",
      "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
    }
  ]
}
```

Valid. All 3 fires were classified `Real?: no` in `ops/incidents.md`.
This unlocks the CALIBRATION §7.2 *"≥ 3 false positives"* trigger
once the operator confirms in §B.

### 8.3 Mixed-confidence multi-alert document

```json
{
  "generated_at": "2026-05-01T03:14:00Z",
  "window": "2026-04-17 → 2026-05-01",
  "alerts": [
    {
      "alert": "RdapifyHighErrorRate",
      "fires": 4,
      "candidates": { "true_positive": 1, "false_positive": 0, "uncertain": 3 },
      "evidence": [
        "incident:2026-04-30 14:32 UTC",
        "metric:error_rate_typical value=0.024"
      ],
      "confidence": "medium",
      "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
    },
    {
      "alert": "RdapifyBreakerFlapping",
      "fires": 2,
      "candidates": { "true_positive": 0, "false_positive": 0, "uncertain": 2 },
      "evidence": [],
      "confidence": "low",
      "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
    }
  ]
}
```

Valid. The operator has work to do on both rows before §B promotion
— the medium one needs uncertain-fire investigation; the low one
needs incidents.md rows added.

---

## 9. Reference index

- [`tools/classify_alerts.sh`](../../tools/classify_alerts.sh) —
  emits files conforming to this schema (v0.6.10 envelope).
- [`tools/build_tuning_report.sh`](../../tools/build_tuning_report.sh)
  — consumes files conforming to this schema; rejects v0.6.9 array
  format with a diagnostic.
- [`CLASSIFICATION_REVIEW.md`](CLASSIFICATION_REVIEW.md) — how to
  validate candidates before promotion.
- [`ALERT_CLASSIFICATION.md`](ALERT_CLASSIFICATION.md) §5 —
  where the operator computes recall (the candidate JSON does not).

---

_Last updated: 2026-05-01 (v0.6.10). Schema rev 2._
