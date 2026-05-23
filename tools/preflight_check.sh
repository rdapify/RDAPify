#!/usr/bin/env bash
#
# RDAPify — pre-flight readiness check for a real observation window.
#
# Verifies that the operator-facing tooling is wired correctly BEFORE
# the observation window is declared. This script does NOT start a
# window, does NOT write any data, and does NOT modify any engine,
# alert, dashboard, or SLO file.
#
# USAGE
#   PROM_URL=https://prometheus.example bash tools/preflight_check.sh
#
# ENVIRONMENT
#   PROM_URL   (required)  Prometheus base URL.
#   AUTH_USER  (optional)  Basic auth user (passed to extract_tuning_data.sh).
#   AUTH_PASS  (optional)  Basic auth password.
#   AUTH_TOKEN (optional)  Bearer token (overrides basic auth).
#   CURL_OPTS  (optional)  Extra curl flags (e.g. "--cacert /etc/ssl/cert.pem").
#   SKIP_DRY_RUN (optional, default: 0)
#                          When 1, skips check (E) — useful when the
#                          query catalog hasn't been populated yet.
#
# CHECKS
#   A) tools/promtool exists and runs.
#   B) promtool check rules passes on docs/observability/prometheus-alerts.yaml.
#   C) PROM_URL responds at /api/v1/status/buildinfo.
#   D) Prometheus query API answers query=up (status=success).
#   E) tools/extract_tuning_data.sh exposes a --dry-run flag, and a
#      dry-run against PROM_URL succeeds (every query parses).
#
# OUTPUT
#   Per-check PASS / FAIL line on stdout. On any FAIL the script exits
#   non-zero with a numeric code matching the failed check (A=10, B=11,
#   C=12, D=13, E=14). Missing PROM_URL exits 64 (EX_USAGE).
#
# READS / DOES NOT MODIFY
#   Reads:    tools/promtool, tools/extract_tuning_data.sh,
#             docs/observability/prometheus-alerts.yaml, ${PROM_URL}.
#   Writes:   nothing under the workspace; nothing under ops/;
#             nothing under tuning-data-*.

set -euo pipefail

# Resolve the repo root from this script's location so it works regardless
# of the caller's cwd.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

PROMTOOL="${REPO_ROOT}/tools/promtool"
ALERTS_YAML="${REPO_ROOT}/docs/observability/prometheus-alerts.yaml"
EXTRACT_SCRIPT="${REPO_ROOT}/tools/extract_tuning_data.sh"

# ── Argument validation ──────────────────────────────────────────────────────

if [[ -z "${PROM_URL:-}" ]]; then
    echo "error: PROM_URL env var is required" >&2
    echo "       example: PROM_URL=http://127.0.0.1:9090 bash tools/preflight_check.sh" >&2
    exit 64
fi

# Strip a trailing slash so URL composition is always exact.
PROM_URL="${PROM_URL%/}"

# ── Curl arg builder (shared with extract_tuning_data.sh conventions) ────────

curl_args=(--silent --show-error --fail --max-time 10)
if [[ -n "${AUTH_TOKEN:-}" ]]; then
    curl_args+=(-H "Authorization: Bearer ${AUTH_TOKEN}")
elif [[ -n "${AUTH_USER:-}" ]]; then
    curl_args+=(-u "${AUTH_USER}:${AUTH_PASS:-}")
fi
if [[ -n "${CURL_OPTS:-}" ]]; then
    # shellcheck disable=SC2206  # intentional word-split for operator flags
    extra=( ${CURL_OPTS} )
    curl_args+=("${extra[@]}")
fi

# ── Reporting helpers ────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    echo "  [PASS] $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo "  [FAIL] $1" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

section() {
    echo
    echo "$1"
}

echo "RDAPify pre-flight check"
echo "  prom_url = ${PROM_URL}"
echo "  repo     = ${REPO_ROOT}"

# ── Check A — promtool present and runnable ──────────────────────────────────

section "A) promtool binary"
if [[ ! -x "${PROMTOOL}" ]]; then
    fail "tools/promtool missing or not executable — run tools/get_promtool.sh"
    exit 10
fi
if ! "${PROMTOOL}" --version >/dev/null 2>&1; then
    fail "tools/promtool failed to run --version"
    exit 10
fi
pass "promtool runs ($("${PROMTOOL}" --version 2>&1 | head -1))"

# ── Check B — alert rules pass promtool ──────────────────────────────────────

section "B) promtool check rules on prometheus-alerts.yaml"
if [[ ! -f "${ALERTS_YAML}" ]]; then
    fail "alerts file not found at ${ALERTS_YAML}"
    exit 11
fi
# `check rules` returns 0 even with placeholders like ${TEAM} as long as YAML
# + PromQL are valid. We capture stderr so failures surface to the operator.
if ! "${PROMTOOL}" check rules "${ALERTS_YAML}"; then
    fail "promtool check rules failed (see output above)"
    exit 11
fi
pass "alert rules valid"

# ── Check C — PROM_URL reachable ─────────────────────────────────────────────

section "C) Prometheus reachable"
buildinfo_url="${PROM_URL}/api/v1/status/buildinfo"
if buildinfo=$(curl "${curl_args[@]}" "${buildinfo_url}" 2>&1); then
    # Parse status field without jq.
    status=$(echo "${buildinfo}" | grep -o '"status":"[a-z]*"' | head -1 | cut -d'"' -f4)
    version=$(echo "${buildinfo}" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [[ "${status}" == "success" ]]; then
        pass "buildinfo OK${version:+ (prometheus ${version})}"
    else
        fail "buildinfo returned status=${status:-unknown}"
        exit 12
    fi
else
    fail "curl ${buildinfo_url} failed: ${buildinfo}"
    exit 12
fi

# ── Check D — query API works ────────────────────────────────────────────────

section "D) Prometheus query API"
query_url="${PROM_URL}/api/v1/query"
if query_resp=$(curl "${curl_args[@]}" --get \
        --data-urlencode "query=up" \
        "${query_url}" 2>&1); then
    status=$(echo "${query_resp}" | grep -o '"status":"[a-z]*"' | head -1 | cut -d'"' -f4)
    if [[ "${status}" == "success" ]]; then
        # Count result vector length (cheap heuristic; "[]" → empty).
        result_summary=$(echo "${query_resp}" | grep -o '"resultType":"[a-z]*"' | head -1 | cut -d'"' -f4)
        pass "query=up returned status=success (resultType=${result_summary:-?})"
    else
        fail "query=up returned status=${status:-unknown}"
        exit 13
    fi
else
    fail "curl ${query_url}?query=up failed: ${query_resp}"
    exit 13
fi

# ── Check E — extract_tuning_data.sh --dry-run ───────────────────────────────

section "E) extract_tuning_data.sh dry-run"
if [[ "${SKIP_DRY_RUN:-0}" -eq 1 ]]; then
    echo "  [SKIP] SKIP_DRY_RUN=1 — extract_tuning_data.sh validation skipped"
else
    if [[ ! -f "${EXTRACT_SCRIPT}" ]]; then
        fail "extract_tuning_data.sh missing at ${EXTRACT_SCRIPT}"
        exit 14
    fi
    if ! grep -q -- '--dry-run' "${EXTRACT_SCRIPT}"; then
        fail "extract_tuning_data.sh does not advertise --dry-run"
        exit 14
    fi
    # PROM (script's native env name) and PROM_URL alias both work; pass both
    # so the check is portable to either spelling.
    if PROM="${PROM_URL}" PROM_URL="${PROM_URL}" \
            bash "${EXTRACT_SCRIPT}" --dry-run >/tmp/preflight_dryrun.$$ 2>&1; then
        rm -f /tmp/preflight_dryrun.$$
        pass "all extraction queries parse against ${PROM_URL}"
    else
        rc=$?
        echo "  --- extract_tuning_data.sh --dry-run output ---" >&2
        cat /tmp/preflight_dryrun.$$ >&2 || true
        rm -f /tmp/preflight_dryrun.$$
        fail "extract_tuning_data.sh --dry-run exited ${rc}"
        exit 14
    fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo
echo "Pre-flight summary"
echo "  passed: ${PASS_COUNT}"
echo "  failed: ${FAIL_COUNT}"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
    echo
    echo "FAIL — fix the failed check(s) above before declaring an observation window." >&2
    exit 1
fi

cat <<'EOF'

PASS — operator-side tooling is ready.

This does NOT start an observation window. To declare a window:
  1. Copy ops/attestations/TEMPLATE.md to ops/attestations/<YYYY-MM-DD>.md
  2. Fill in WINDOW_START / WINDOW_END / operator name.
  3. See docs/observability/OBSERVATION_WINDOW.md for the daily routine
     and the end-of-window pipeline.
EOF
