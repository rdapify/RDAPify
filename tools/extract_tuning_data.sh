#!/usr/bin/env bash
#
# RDAPify — TUNING_REPORT data extractor.
#
# Pulls the canonical PromQL queries from QUERIES.md against a live
# Prometheus and writes the JSON responses to one file per query.
# Pure bash + curl; no other dependencies.
#
# USAGE
#   PROM=https://prometheus.example WINDOW=14d \
#     tools/extract_tuning_data.sh
#
#   PROM=http://127.0.0.1:9090 WINDOW=7d OUT_DIR=/tmp/extract \
#     tools/extract_tuning_data.sh
#
#   # Dry-run: validate connectivity + every query parses, write nothing.
#   PROM=http://127.0.0.1:9090 \
#     tools/extract_tuning_data.sh --dry-run
#
# ENVIRONMENT
#   PROM       (required)  Prometheus base URL, e.g. http://127.0.0.1:9090
#                          PROM_URL is also accepted as an alias.
#   WINDOW     (default: 14d)
#                          Window length for Prometheus PromQL [...] ranges.
#                          7d minimum, 14d preferred. See CALIBRATION.md §7.3.
#   SCRAPE     (default: 30)
#                          Scrape interval in seconds. Used to convert
#                          ALERTS sample counts → wall-clock seconds.
#   OUT_DIR    (default: ./tuning-data-<UTC-date>)
#                          Directory to write JSON outputs into. Ignored
#                          in --dry-run mode.
#   AUTH_USER  (optional)  Basic auth user.
#   AUTH_PASS  (optional)  Basic auth password.
#   AUTH_TOKEN (optional)  Bearer token (overrides basic auth).
#   CURL_OPTS  (optional)  Extra curl flags (e.g. "--cacert /etc/ssl/cert.pem").
#
# FLAGS
#   --dry-run               Run every query against Prometheus but DO NOT
#                           write any files. Verifies connectivity, auth,
#                           and that each PromQL parses to status=success.
#                           Exits non-zero on any query failure. Used by
#                           tools/preflight_check.sh before a real window.
#
# OUTPUT
#   <OUT_DIR>/<section>__<query-id>.json   one file per query
#   <OUT_DIR>/INDEX.txt                    summary list
#   <OUT_DIR>/MANIFEST.txt                 invocation parameters
#
# READS
#   Prometheus HTTP API /api/v1/query (read-only).
#
# DOES NOT
#   - Modify Prometheus, Alertmanager, or the engine.
#   - Classify TP/FP — that requires a human; see ALERT_CLASSIFICATION.md.
#   - Convert to CSV — JSON only. See EXPORT_GUIDE.md §5 for jq snippets.
#
# Exits non-zero if any required env var is missing or any query fails.

set -euo pipefail

# ── Flag parsing ─────────────────────────────────────────────────────────────

DRY_RUN=0
for arg in "$@"; do
    case "${arg}" in
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            sed -n '2,42p' "$0"
            exit 0
            ;;
        *)
            echo "error: unknown flag: ${arg} (try --help)" >&2
            exit 64
            ;;
    esac
done

# ── Argument validation ──────────────────────────────────────────────────────

# Accept PROM_URL as an alias (preflight_check.sh uses PROM_URL).
if [[ -z "${PROM:-}" && -n "${PROM_URL:-}" ]]; then
    PROM="${PROM_URL}"
fi

if [[ -z "${PROM:-}" ]]; then
    echo "error: PROM env var is required (e.g. PROM=http://127.0.0.1:9090)" >&2
    exit 64
fi

WINDOW="${WINDOW:-14d}"
SCRAPE="${SCRAPE:-30}"
OUT_DIR="${OUT_DIR:-./tuning-data-$(date -u +%Y-%m-%d)}"

# Validate WINDOW shape: <int>(d|h|m).
if [[ ! "$WINDOW" =~ ^[0-9]+[dhm]$ ]]; then
    echo "error: WINDOW must be like '14d' / '7d' / '24h' (got: $WINDOW)" >&2
    exit 64
fi

# Validate SCRAPE: positive integer.
if [[ ! "$SCRAPE" =~ ^[0-9]+$ ]] || [[ "$SCRAPE" -lt 1 ]]; then
    echo "error: SCRAPE must be a positive integer seconds (got: $SCRAPE)" >&2
    exit 64
fi

# In dry-run we never touch the filesystem.
if [[ "${DRY_RUN}" -eq 0 ]]; then
    mkdir -p "$OUT_DIR"
fi

# ── Build curl auth args ─────────────────────────────────────────────────────

curl_args=(--silent --show-error --fail --get)
if [[ -n "${AUTH_TOKEN:-}" ]]; then
    curl_args+=(-H "Authorization: Bearer ${AUTH_TOKEN}")
elif [[ -n "${AUTH_USER:-}" ]]; then
    curl_args+=(-u "${AUTH_USER}:${AUTH_PASS:-}")
fi
# Allow operator-supplied extra flags (e.g. --cacert).
if [[ -n "${CURL_OPTS:-}" ]]; then
    # shellcheck disable=SC2206  # intentional word-split for operator flags
    extra=( ${CURL_OPTS} )
    curl_args+=("${extra[@]}")
fi

# ── Manifest (records the invocation parameters) ─────────────────────────────

if [[ "${DRY_RUN}" -eq 0 ]]; then
    cat > "${OUT_DIR}/MANIFEST.txt" <<EOF
RDAPify TUNING_REPORT data extraction
=====================================
extracted_at_utc : $(date -u +"%Y-%m-%dT%H:%M:%SZ")
prom_url         : ${PROM}
window           : ${WINDOW}
scrape_interval  : ${SCRAPE}s
out_dir          : ${OUT_DIR}
script_version   : 0.6.11

Authentication used:
$(if [[ -n "${AUTH_TOKEN:-}" ]]; then echo "  bearer-token (length=${#AUTH_TOKEN})"; \
  elif [[ -n "${AUTH_USER:-}" ]]; then echo "  basic auth (user=${AUTH_USER})"; \
  else echo "  none (anonymous)"; fi)

This file records HOW the extraction was done.
The actual values are in the .json siblings.
Cite this directory in TUNING_REPORT.md §F "Attached artefacts".
EOF
fi

# ── Single-query helper ──────────────────────────────────────────────────────

# query_one <section> <id> <promql>
#
# Substitutes \${WINDOW} / \${SCRAPE} in promql before sending.
# Real run:  writes JSON response to <section>__<id>.json.
# Dry run:   writes to a temp file (deleted after the status check) and
#            announces "would run" — no persistent artefacts.
# Returns nonzero on error in both modes.
query_one() {
    local section="$1" id="$2" promql="$3"
    local outfile

    # Substitute variables.
    promql="${promql//\$\{WINDOW\}/${WINDOW}}"
    promql="${promql//\$\{SCRAPE\}/${SCRAPE}}"

    if [[ "${DRY_RUN}" -eq 1 ]]; then
        outfile=$(mktemp)
    else
        outfile="${OUT_DIR}/${section}__${id}.json"
    fi

    if curl "${curl_args[@]}" \
        --data-urlencode "query=${promql}" \
        "${PROM}/api/v1/query" \
        -o "${outfile}"; then
        local status
        # Parse status from JSON without jq — grep+cut is fragile but works
        # for the well-formed Prometheus response shape.
        status=$(grep -o '"status":"[a-z]*"' "${outfile}" | head -1 | cut -d'"' -f4)
        if [[ "${DRY_RUN}" -eq 1 ]]; then
            rm -f "${outfile}"
        fi
        if [[ "${status}" != "success" ]]; then
            echo "  ✗ ${section}/${id}: prometheus returned status=${status:-unknown}" >&2
            return 1
        fi
        if [[ "${DRY_RUN}" -eq 1 ]]; then
            echo "  ✓ [dry-run] ${section}/${id} would run"
        else
            echo "  ✓ ${section}/${id}"
        fi
    else
        if [[ "${DRY_RUN}" -eq 1 ]]; then
            rm -f "${outfile}" 2>/dev/null || true
        fi
        echo "  ✗ ${section}/${id}: curl failed (see above)" >&2
        return 1
    fi
}

# ── Query catalog ────────────────────────────────────────────────────────────
#
# Each block runs the canonical query from QUERIES.md. Sections match
# TUNING_REPORT.md.

if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "Dry-run: validating queries against ${PROM} (writing nothing)" >&2
else
    echo "Extracting RDAPify tuning data → ${OUT_DIR}" >&2
    echo "  prometheus = ${PROM}" >&2
fi
echo "  window     = ${WINDOW}" >&2
echo "  scrape     = ${SCRAPE}s" >&2
echo >&2

# §A scope helpers
query_one A scope_engine_up \
  'min_over_time(up{job="rdapify"}[${WINDOW}])'
query_one A scope_total_requests \
  'sum(increase(rdap_requests_total[${WINDOW}]))'
query_one A scope_avg_request_rate \
  'sum(rate(rdap_requests_total[${WINDOW}]))'
query_one A scope_peak_request_rate \
  'max_over_time(sum(rate(rdap_requests_total[1m]))[${WINDOW}:1m])'

# §B alert evaluation
query_one B alerts_fires_per_alert \
  'sum by (alertname) (changes(ALERTS{alertstate="firing"}[${WINDOW}]))'
query_one B alerts_firing_seconds_per_alert \
  'sum by (alertname) (count_over_time(ALERTS{alertstate="firing"}[${WINDOW}])) * ${SCRAPE}'
query_one B alerts_fires_per_severity \
  'sum by (severity) (changes(ALERTS{alertstate="firing"}[${WINDOW}]))'
query_one B alerts_currently_firing \
  'ALERTS{alertstate="firing"}'

# §C.1 latency
query_one C1 latency_p50_typical \
  'quantile_over_time(0.5, histogram_quantile(0.50, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m])'
query_one C1 latency_p95_typical \
  'quantile_over_time(0.5, histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m])'
query_one C1 latency_p99_typical \
  'quantile_over_time(0.5, histogram_quantile(0.99, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m])'
query_one C1 latency_p95_max_in_window \
  'max_over_time(histogram_quantile(0.95, sum by (le) (rate(rdap_latency_seconds_bucket[5m])))[${WINDOW}:5m])'
query_one C1 latency_p95_by_type \
  'histogram_quantile(0.95, sum by (le, type) (rate(rdap_latency_seconds_bucket[${WINDOW}])))'

# §C.2 errors / availability
query_one C2 error_rate_typical \
  'quantile_over_time(0.5, (sum(rate(rdap_errors_total[5m])) / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[${WINDOW}:5m])'
query_one C2 availability_floor_p5 \
  'quantile_over_time(0.05, (sum(rate(rdap_requests_total{status="success"}[5m])) / clamp_min(sum(rate(rdap_requests_total[5m])), 1))[${WINDOW}:5m])'
query_one C2 errors_by_class \
  'sum by (class) (rate(rdap_errors_total[${WINDOW}])) / clamp_min(sum(rate(rdap_requests_total[${WINDOW}])), 1)'
query_one C2 availability_window \
  'sum(rate(rdap_requests_total{status="success"}[${WINDOW}])) / clamp_min(sum(rate(rdap_requests_total[${WINDOW}])), 1)'

# §C.3 cache
query_one C3 cache_hit_ratio_typical \
  'quantile_over_time(0.5, (sum(rate(rdap_cache_hits_total[5m])) / clamp_min(sum(rate(rdap_cache_hits_total[5m])) + sum(rate(rdap_cache_misses_total[5m])), 1))[${WINDOW}:5m])'
query_one C3 cache_hits_by_freshness \
  'sum by (freshness) (increase(rdap_cache_hits_total[${WINDOW}]))'
query_one C3 cache_eviction_rate_typical \
  'quantile_over_time(0.5, rate(rdap_cache_evictions_total[5m])[${WINDOW}:5m])'
query_one C3 cache_entries_peak \
  'max_over_time(rdap_cache_entries_current[${WINDOW}])'

# §C.4 concurrency
query_one C4 sem_wait_global_p95 \
  'quantile_over_time(0.5, histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="global"}[5m])))[${WINDOW}:5m])'
query_one C4 sem_wait_per_host_p95 \
  'quantile_over_time(0.5, histogram_quantile(0.95, sum by (le) (rate(rdap_semaphore_wait_seconds_bucket{kind="per_host"}[5m])))[${WINDOW}:5m])'
query_one C4 inflight_peak \
  'max_over_time(rdap_inflight_requests[${WINDOW}])'
query_one C4 inflight_idle_floor_15m \
  'min_over_time(rdap_inflight_requests[15m])'

# §C.5 retries
query_one C5 retry_rate_typical \
  'quantile_over_time(0.5, sum(rate(rdap_retry_total[5m]))[${WINDOW}:5m])'
query_one C5 retry_amplification \
  'sum(increase(rdap_retry_total[${WINDOW}])) / clamp_min(sum(increase(rdap_requests_total[${WINDOW}])), 1)'
query_one C5 retry_top_class \
  'topk(1, sum by (class) (rate(rdap_retry_total[${WINDOW}])))'
query_one C5 retry_delay_p95 \
  'histogram_quantile(0.95, sum by (le) (rate(rdap_retry_delay_seconds_bucket[${WINDOW}])))'

# §C.6 breaker
query_one C6 breaker_top_origins_open_rate \
  'topk(5, sum by (origin) (rate(rdap_circuit_breaker_open_seconds_total[${WINDOW}])))'
query_one C6 breaker_total_flaps \
  'sum(increase(rdap_circuit_breaker_transitions_total{from="closed",to="open"}[${WINDOW}])) + sum(increase(rdap_circuit_breaker_transitions_total{from="half_open",to="open"}[${WINDOW}]))'
query_one C6 breaker_distinct_origins_open \
  'count(max_over_time(rdap_circuit_breaker_state[${WINDOW}]) >= 1)'
query_one C6 breaker_recovery_rate \
  'sum by (origin) (increase(rdap_circuit_breaker_transitions_total{from="half_open",to="closed"}[${WINDOW}]))'

# Cross-cutting
query_one X total_active_series \
  'count({__name__=~"rdap_.*"})'
query_one X engine_metric_present \
  'absent(rdap_requests_total)'

# ── Build INDEX.txt ──────────────────────────────────────────────────────────

if [[ "${DRY_RUN}" -eq 0 ]]; then
    (
        echo "# extract_tuning_data.sh — output index"
        echo "# Generated $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
        echo "#"
        echo "# Files in this directory:"
        echo
        ls -1 "${OUT_DIR}" | grep -E '\.json$' | sort
        echo
        echo "# Open MANIFEST.txt for invocation parameters."
        echo "# Map files → TUNING_REPORT.md sections via the prefix:"
        echo "#   A__*    → §A Scope"
        echo "#   B__*    → §B Alert evaluation"
        echo "#   C1__*   → §C.1 Latency"
        echo "#   C2__*   → §C.2 Errors / availability"
        echo "#   C3__*   → §C.3 Cache"
        echo "#   C4__*   → §C.4 Concurrency"
        echo "#   C5__*   → §C.5 Retries"
        echo "#   C6__*   → §C.6 Breaker"
        echo "#   X__*    → cross-cutting helpers"
    ) > "${OUT_DIR}/INDEX.txt"

    echo >&2
    echo "Done. Output in ${OUT_DIR}" >&2
    echo "  next: open INDEX.txt and walk each .json file → TUNING_REPORT.md cell" >&2
    echo "  see:  docs/observability/TUNING_WORKFLOW.md for the end-to-end checklist" >&2
else
    echo >&2
    echo "Dry-run complete. All queries parsed successfully against ${PROM}." >&2
    echo "  no files were written; no observation window was started." >&2
fi
