#!/usr/bin/env bash
#
# RDAPify — alert classification candidate generator (v0.6.10).
#
# Reads:
#   - The output directory of `tools/extract_tuning_data.sh` (especially
#     B__alerts_fires_per_alert.json, B__alerts_currently_firing.json,
#     and the relevant §C__*.json metric baselines).
#   - ops/incidents.md (operator-curated chronological log).
#
# Emits:
#   - classification_candidates.json — JSON object with envelope:
#       {
#         "generated_at": "<ISO 8601 UTC timestamp>",
#         "window":       "<YYYY-MM-DD → YYYY-MM-DD>",
#         "alerts":       [ ...candidate objects... ]
#       }
#
#   This format is **NOT backward-compatible with v0.6.9**, which emitted
#   a top-level array. v0.6.9 consumers must migrate to read the
#   envelope. See docs/observability/DATA_MODEL.md and the v0.6.10
#   CHANGELOG entry for the migration note.
#
# IMPORTANT — SUGGESTION ONLY
#   Every alert object carries `note: "SUGGESTION ONLY — REQUIRES HUMAN
#   VALIDATION"`. This script does not classify alerts as final truth.
#   It correlates fire counts with operator-curated entries and emits
#   candidates for human review.
#
#   The script does not write to TUNING_REPORT.md, prometheus-alerts.yaml,
#   docs/SLO.md, the dashboard, or any engine code. It is read-only on
#   ops/incidents.md.
#
# USAGE
#   # Default: derive concrete dates from WINDOW relative to "now".
#   DATA_DIR=tuning-data-2026-05-01 \
#   INCIDENTS=ops/incidents.md \
#   WINDOW=14d \
#     tools/classify_alerts.sh > classification_candidates.json
#
#   # Retrospective: pin both ends of the window explicitly.
#   DATA_DIR=tuning-data-2026-05-01 \
#   INCIDENTS=ops/incidents.md \
#   WINDOW_START=2026-04-17 WINDOW_END=2026-05-01 \
#     tools/classify_alerts.sh > classification_candidates.json
#
# ENVIRONMENT
#   DATA_DIR        (required)  Directory written by extract_tuning_data.sh.
#                               Must contain B__alerts_fires_per_alert.json.
#   INCIDENTS       (default: ops/incidents.md)
#                               Path to the operator-curated incident log.
#   WINDOW          (default: 14d)
#                               Prometheus duration string. Used to derive
#                               the concrete date range when WINDOW_START /
#                               WINDOW_END are not set. Must match the
#                               WINDOW that was passed to
#                               extract_tuning_data.sh.
#   WINDOW_START    (optional)  ISO date (YYYY-MM-DD). Overrides the
#                               derived start. Use for retrospective audits.
#   WINDOW_END      (optional)  ISO date (YYYY-MM-DD). Overrides the
#                               derived end (default: today UTC).
#
# OUTPUT
#   stdout — single JSON object (envelope shape; see DATA_MODEL.md).
#
# DEPENDENCIES
#   bash 4+, grep (-oE), sed, awk, tr, cut, sort, date. No jq required.
#
# Exits non-zero on missing inputs or malformed data files.

set -euo pipefail

# ── Argument validation ──────────────────────────────────────────────────────

if [[ -z "${DATA_DIR:-}" ]]; then
    echo "error: DATA_DIR env var is required (e.g. DATA_DIR=tuning-data-2026-05-01)" >&2
    exit 64
fi
if [[ ! -d "$DATA_DIR" ]]; then
    echo "error: DATA_DIR='$DATA_DIR' is not a directory" >&2
    exit 64
fi

INCIDENTS="${INCIDENTS:-ops/incidents.md}"
if [[ ! -f "$INCIDENTS" ]]; then
    echo "error: INCIDENTS file not found: $INCIDENTS" >&2
    exit 64
fi

WINDOW="${WINDOW:-14d}"
if [[ ! "$WINDOW" =~ ^[0-9]+[dhm]$ ]]; then
    echo "error: WINDOW must be like '14d' / '7d' / '24h' (got: $WINDOW)" >&2
    exit 64
fi

FIRES_FILE="$DATA_DIR/B__alerts_fires_per_alert.json"
if [[ ! -f "$FIRES_FILE" ]]; then
    echo "error: missing fire-count file: $FIRES_FILE" >&2
    echo "       run tools/extract_tuning_data.sh first" >&2
    exit 65
fi

# ── Compute concrete date window (audit-grade traceability) ──────────────────
#
# v0.6.10 emits an explicit "<YYYY-MM-DD → YYYY-MM-DD>" string instead of
# the v0.6.9 raw duration. This makes the audit trail unambiguous: the
# report can be re-derived from the same date range later.

END_TS=$(date -u +%s)
case "$WINDOW" in
    *d) seconds=$(( ${WINDOW%d} * 86400 )) ;;
    *h) seconds=$(( ${WINDOW%h} * 3600 ))  ;;
    *m) seconds=$(( ${WINDOW%m} * 60 ))    ;;
esac
START_TS=$(( END_TS - seconds ))

# Optional explicit overrides for retrospective audits.
if [[ -n "${WINDOW_START:-}" ]]; then
    if ! START_TS=$(date -u -d "$WINDOW_START 00:00:00 UTC" +%s 2>/dev/null); then
        echo "error: WINDOW_START='$WINDOW_START' is not a parseable date" >&2
        exit 64
    fi
fi
if [[ -n "${WINDOW_END:-}" ]]; then
    if ! END_TS=$(date -u -d "$WINDOW_END 00:00:00 UTC" +%s 2>/dev/null); then
        echo "error: WINDOW_END='$WINDOW_END' is not a parseable date" >&2
        exit 64
    fi
fi

if (( START_TS >= END_TS )); then
    echo "error: window start ($(date -u -d "@$START_TS" +%F)) is not before end ($(date -u -d "@$END_TS" +%F))" >&2
    exit 64
fi

START_DATE=$(date -u -d "@$START_TS" +%Y-%m-%d)
END_DATE=$(date -u -d "@$END_TS" +%Y-%m-%d)
WINDOW_DISPLAY="$START_DATE → $END_DATE"
GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Helper: parse Prometheus instant-vector JSON (no jq) ─────────────────────
#
# Accepts a JSON file from /api/v1/query whose result is a `vector`.
# Each entry has shape {"metric":{"key":"val",...},"value":[ts,"N"]}.
# We need (label_value, numeric_value) pairs.
parse_alertname_count_pairs() {
    local file="$1" label="$2"

    # `grep -E` exits 1 when the input has zero matches (e.g. an empty
    # `result: []` vector returned by Prometheus during a quiet window).
    # With `set -euo pipefail`, that non-zero would otherwise abort the
    # caller before the envelope emit. The `{ ... || true; }` brace group
    # forces this pipe segment to exit 0 on no-match while still letting
    # real grep errors (e.g. invalid pattern) propagate naturally — there
    # is no malformed-pattern condition because the pattern is a literal.
    tr -d '\n' < "$file" \
      | sed 's/{"metric":/\n{"metric":/g' \
      | { grep -E '^\{"metric":' || true; } \
      | while IFS= read -r block; do
            local lbl
            lbl=$(echo "$block" \
                  | grep -oE "\"$label\":\"[^\"]*\"" \
                  | head -1 \
                  | sed 's/.*":"//;s/"$//')
            local val
            val=$(echo "$block" \
                  | grep -oE '"value":\[[0-9.]+,"[^"]*"\]' \
                  | head -1 \
                  | sed 's/.*,"//;s/"\]$//')
            if [[ -n "$lbl" && -n "$val" ]]; then
                printf '%s\t%s\n' "$lbl" "$val"
            fi
        done
}

# ── Parse ops/incidents.md ───────────────────────────────────────────────────
#
# v0.6.10 captures the **timestamp** from the entry heading so that
# evidence can use chronological anchors (`incident:<timestamp>`) rather
# than artefact IDs.
#
# Each entry starts:  ### YYYY-MM-DD HH:MM UTC — <alert_name>
# Followed by:        - **Real?**:   yes | no | partial
#                     - **Linked artefacts**: <id> | none
#
# TSV columns: alert \t timestamp \t classification \t linked
INCIDENTS_TSV=$(mktemp)
trap 'rm -f "$INCIDENTS_TSV"' EXIT

awk '
  BEGIN { ent = 0 }
  /^##+ EXAMPLE/ { ent = 0; next }
  /^##+ [0-9]{4}-[0-9]{2}-[0-9]{2}/ {
    # Capture the heading "YYYY-MM-DD HH:MM UTC" portion as the timestamp.
    ts = $0
    sub(/^##+ /, "", ts)
    sub(/ —.*$/, "", ts)
    # Capture the alert name (after the em-dash).
    line = $0
    sub(/^##+ [^—]*— */, "", line)
    alert = line
    real  = "real_unknown"
    linked = "none"
    timestamp = ts
    ent = 1
    next
  }
  ent && /^- \*\*Real\?\*\*:/ {
    val = $0
    sub(/.*\*\*Real\?\*\*:[[:space:]]*/, "", val)
    sub(/[[:space:]]+$/, "", val)
    if (val ~ /^yes($|[^a-zA-Z])/)         real = "real_yes"
    else if (val ~ /^no($|[^a-zA-Z])/)     real = "real_no"
    else if (val ~ /^partial($|[^a-zA-Z])/) real = "real_partial"
    else                                    real = "real_unknown"
  }
  ent && /^- \*\*Linked( artefacts)?\*\*:/ {
    val = $0
    sub(/.*\*\*:[[:space:]]*/, "", val)
    if (val == "" || val == "none") linked = "none"
    else linked = val
  }
  ent && /^---[[:space:]]*$/ {
    print alert "\t" timestamp "\t" real "\t" linked
    ent = 0
  }
  END {
    if (ent) print alert "\t" timestamp "\t" real "\t" linked
  }
' "$INCIDENTS" > "$INCIDENTS_TSV"

# ── Helpers — TSV columns are now: alert | timestamp | classification | linked
incidents_for_alert() {
    awk -v a="$1" -F'\t' '$1 == a' "$INCIDENTS_TSV"
}
count_real_yes() {
    incidents_for_alert "$1" | awk -F'\t' '$3 == "real_yes"' | wc -l
}
count_real_no() {
    incidents_for_alert "$1" | awk -F'\t' '$3 == "real_no"' | wc -l
}
count_real_unknown() {
    incidents_for_alert "$1" | awk -F'\t' '$3 == "real_unknown" || $3 == "real_partial"' | wc -l
}

# Emit timestamps of TP rows for use as evidence anchors.
timestamps_of_tp_for_alert() {
    incidents_for_alert "$1" | awk -F'\t' '$3 == "real_yes" {print $2}' | head -5
}

# ── Helper: gather metric correlation hint per alert ─────────────────────────
metric_hint_for() {
    local alertname="$1"
    local file=""
    case "$alertname" in
        RdapifyHighErrorRate|RdapifyErrorBudget*)
            file="$DATA_DIR/C2__error_rate_typical.json" ;;
        RdapifyP95LatencyAboveSlo|RdapifyLatencyBudget*)
            file="$DATA_DIR/C1__latency_p95_typical.json" ;;
        RdapifyInflightSaturation)
            file="$DATA_DIR/C4__inflight_peak.json" ;;
        RdapifySemaphoreWaitElevated)
            file="$DATA_DIR/C4__sem_wait_global_p95.json" ;;
        RdapifyRetrySpike)
            file="$DATA_DIR/C5__retry_rate_typical.json" ;;
        RdapifyCacheHitRatioLow)
            file="$DATA_DIR/C3__cache_hit_ratio_typical.json" ;;
        RdapifyCacheCapacityPressure)
            file="$DATA_DIR/C3__cache_eviction_rate_typical.json" ;;
        RdapifyBreaker*|RdapifySingleBreakerOpen)
            file="$DATA_DIR/C6__breaker_total_flaps.json" ;;
        RdapifySlowRequestRising)
            file="$DATA_DIR/C1__latency_p95_typical.json" ;;
    esac

    if [[ -n "$file" && -f "$file" ]]; then
        local val
        val=$(tr -d '\n' < "$file" \
              | grep -oE '"value":\[[0-9.]+,"[^"]*"\]' \
              | head -1 \
              | sed 's/.*,"//;s/"\]$//')
        if [[ -n "$val" ]]; then
            printf 'metric:%s value=%s' "$(basename "$file" .json | sed 's/^C[0-9]__//')" "$val"
            return
        fi
    fi
    printf 'metric:no metric correlation available'
}

# ── Helper: confidence level ────────────────────────────────────────────────
confidence_level() {
    local fires="$1" yes="$2" no="$3" unk="$4"
    local classified=$((yes + no))
    if [[ "$fires" -eq 0 ]]; then
        echo "low"
    elif [[ "$classified" -eq "$fires" && "$unk" -eq 0 ]]; then
        echo "high"
    elif [[ "$classified" -gt 0 ]]; then
        echo "medium"
    else
        echo "low"
    fi
}

# ── Build the alerts array body ──────────────────────────────────────────────
# Stage to a temp file so we can wrap the envelope after the loop. (The
# subshell from the pipeline can't easily set variables visible to the
# parent.)
ALERTS_BODY=$(mktemp)
trap 'rm -f "$INCIDENTS_TSV" "$ALERTS_BODY"' EXIT

first=1

parse_alertname_count_pairs "$FIRES_FILE" "alertname" \
| sort -u \
| while IFS=$'\t' read -r alertname fires; do
    [[ -z "$alertname" || -z "$fires" ]] && continue

    real_yes=$(count_real_yes "$alertname")
    real_no=$(count_real_no  "$alertname")
    real_unk=$(count_real_unknown "$alertname")

    classified=$((real_yes + real_no))
    if [[ "$fires" -gt "$classified" ]]; then
        uncertain=$(( fires - classified ))
    else
        uncertain="$real_unk"
    fi

    confidence=$(confidence_level "$fires" "$real_yes" "$real_no" "$real_unk")
    metric_hint=$(metric_hint_for "$alertname")

    # v0.6.10: evidence carries `incident:<timestamp>` for every TP entry
    # in incidents.md, plus the metric hint as the trailing element.
    tp_timestamps=$(timestamps_of_tp_for_alert "$alertname" | sed 's/"/\\"/g')

    evidence_json='['
    ev_first=1
    while IFS= read -r ts; do
        [[ -z "$ts" ]] && continue
        if [[ $ev_first -eq 1 ]]; then ev_first=0; else evidence_json+=','; fi
        evidence_json+="\"incident:${ts}\""
    done <<< "$tp_timestamps"
    if [[ $ev_first -eq 1 ]]; then
        evidence_json+="\"$(echo "$metric_hint" | sed 's/"/\\"/g')\""
    else
        evidence_json+=",\"$(echo "$metric_hint" | sed 's/"/\\"/g')\""
    fi
    evidence_json+=']'

    {
        if [[ $first -eq 1 ]]; then first=0; else printf ','; fi
        cat <<EOF

    {
      "alert": "$alertname",
      "fires": $fires,
      "candidates": {
        "true_positive": $real_yes,
        "false_positive": $real_no,
        "uncertain": $uncertain
      },
      "evidence": $evidence_json,
      "confidence": "$confidence",
      "note": "SUGGESTION ONLY — REQUIRES HUMAN VALIDATION"
    }
EOF
    } >> "$ALERTS_BODY"
done

# ── Emit the envelope to stdout ──────────────────────────────────────────────

cat <<EOF
{
  "generated_at": "$GENERATED_AT",
  "window": "$WINDOW_DISPLAY",
  "alerts": [$(cat "$ALERTS_BODY")
  ]
}
EOF

cat >&2 <<EOF

──────────────────────────────────────────────────────────────────────
classify_alerts.sh — SUGGESTION ONLY  (v0.6.10 audit-grade format)
The output is a candidate set for human review.

Envelope: { "generated_at", "window": "$WINDOW_DISPLAY", "alerts": [...] }

Do NOT write these values directly into TUNING_REPORT.md §B.

Next step:
  1) Review each alert object per docs/observability/CLASSIFICATION_REVIEW.md
  2) Confirm or reject each TP/FP/uncertain count
  3) Run tools/build_tuning_report.sh to produce a §B draft for review
──────────────────────────────────────────────────────────────────────
EOF
