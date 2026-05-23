#!/usr/bin/env bash
#
# RDAPify — synthetic-load generator for PIPELINE REHEARSAL ONLY.
#
# >>> REHEARSAL — NOT FOR TUNING_REPORT <<<
#
# Purpose: drive synthetic RDAP queries through a local rdapify CLI (or
# rdap-service if running) so the local Prometheus has *something* to
# scrape during a rehearsal. Output is for end-to-end pipeline
# validation; it is NOT admissible for any TUNING_REPORT cell.
#
# USAGE
#   tools/rehearsal_load.sh                    # 2-minute default
#   DURATION=300 CONCURRENCY=20 tools/rehearsal_load.sh   # 5-min, c=20
#   SERVICE_URL=http://127.0.0.1:8080 tools/rehearsal_load.sh   # use HTTP service
#
# ENVIRONMENT
#   DURATION    (default: 120)  Seconds of load to generate. Range: 60–600.
#   CONCURRENCY (default: 10)   Parallel workers. Range: 5–25.
#   JITTER_MIN  (default: 50)   Min sleep between requests, ms.
#   JITTER_MAX  (default: 200)  Max sleep between requests, ms.
#   SERVICE_URL (optional)      If set, sends HTTP requests to a running
#                               rdap-service. Otherwise invokes the local
#                               rdapify CLI directly (no metric scrape
#                               target — pure plumbing exercise).
#
# OUTPUT
#   Stderr: progress dots + final summary.
#   Stdout: nothing.
#   No files written.
#
# EXIT
#   0 on completion (always — synthetic errors are expected and counted).
#
# >>> REHEARSAL — NOT FOR TUNING_REPORT <<<

set -uo pipefail

DURATION="${DURATION:-120}"
CONCURRENCY="${CONCURRENCY:-10}"
JITTER_MIN="${JITTER_MIN:-50}"
JITTER_MAX="${JITTER_MAX:-200}"
SERVICE_URL="${SERVICE_URL:-}"

# Bound checks (refuse silly values).
if (( DURATION < 30 || DURATION > 900 )); then
    echo "error: DURATION must be 30..900 seconds (got: $DURATION)" >&2; exit 64
fi
if (( CONCURRENCY < 1 || CONCURRENCY > 50 )); then
    echo "error: CONCURRENCY must be 1..50 (got: $CONCURRENCY)" >&2; exit 64
fi

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RDAPIFY_BIN="${REPO_ROOT}/target/release/rdapify"
[[ -x "${RDAPIFY_BIN}" ]] || RDAPIFY_BIN="${REPO_ROOT}/target/debug/rdapify"
if [[ -z "${SERVICE_URL}" && ! -x "${RDAPIFY_BIN}" ]]; then
    echo "error: no rdapify binary at target/{release,debug}/rdapify and SERVICE_URL is unset" >&2
    exit 65
fi

# Synthetic query catalog — explicitly the 5 the rehearsal spec lists.
QUERIES=(
    "domain example.com"
    "domain google.com"
    "ip 1.1.1.1"
    "ip 8.8.8.8"
    "asn AS15169"
)

end_at=$(( $(date +%s) + DURATION ))
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

worker() {
    local id=$1 hits=0 errs=0
    while (( $(date +%s) < end_at )); do
        local q="${QUERIES[$((RANDOM % ${#QUERIES[@]}))]}"
        local kind=${q%% *} target=${q#* }
        if [[ -n "${SERVICE_URL}" ]]; then
            # HTTP service rehearsal path — rdap-service exposes POST /rdap
            # with body {"query": "...", "kind": "..."}.
            local body
            body=$(printf '{"query":"%s","kind":"%s"}' "${target}" "${kind}")
            if curl -sS --max-time 10 -o /dev/null \
                -H 'Content-Type: application/json' \
                -X POST --data "${body}" \
                "${SERVICE_URL}/rdap" 2>/dev/null; then
                hits=$((hits+1))
            else
                errs=$((errs+1))
            fi
        else
            # CLI rehearsal path — uses real RDAP upstreams; failures are
            # normal and counted, not retried.
            if "${RDAPIFY_BIN}" "${kind}" "${target}" --json --quiet \
                    >/dev/null 2>&1; then
                hits=$((hits+1))
            else
                errs=$((errs+1))
            fi
        fi
        # Jitter sleep in ms.
        local jms=$(( JITTER_MIN + RANDOM % (JITTER_MAX - JITTER_MIN + 1) ))
        # awk for sub-second sleep; portable and dep-free.
        sleep "$(awk -v ms=$jms 'BEGIN{printf "%.3f", ms/1000}')"
    done
    echo "$hits $errs" > "$tmp/w$id.out"
}

echo ">>> REHEARSAL — NOT FOR TUNING_REPORT <<<" >&2
echo "rehearsal load: ${CONCURRENCY} workers × ${DURATION}s = ~$((CONCURRENCY * DURATION / 250))k requests" >&2
echo "  jitter: ${JITTER_MIN}..${JITTER_MAX} ms" >&2
echo "  sink:   ${SERVICE_URL:-CLI ($RDAPIFY_BIN)}" >&2
echo "  start:  $(date -u +%FT%TZ)" >&2

pids=()
for i in $(seq 1 "${CONCURRENCY}"); do
    worker "$i" &
    pids+=($!)
done

# Lightweight progress: a dot per second.
while (( $(date +%s) < end_at )); do
    printf '.' >&2
    sleep 1
done
echo >&2

# Wait for workers, tolerating their normal exits.
for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
done

total_hits=0 total_errs=0
for f in "$tmp"/w*.out; do
    read h e < "$f"
    total_hits=$((total_hits + h))
    total_errs=$((total_errs + e))
done

echo "rehearsal complete:" >&2
echo "  successful : ${total_hits}" >&2
echo "  failed     : ${total_errs}" >&2
echo "  end        : $(date -u +%FT%TZ)" >&2
echo ">>> REHEARSAL — NOT FOR TUNING_REPORT <<<" >&2
