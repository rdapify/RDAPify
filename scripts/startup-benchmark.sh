#!/usr/bin/env bash
# scripts/startup-benchmark.sh — Startup latency measurement for rdapify CLI
#
# Measures the wall-clock time of `rdapify --help` over N iterations and
# checks whether the median startup time is within the target.
#
# Target: startup time < 100 ms
#
# Usage:
#   ./scripts/startup-benchmark.sh
#   ./scripts/startup-benchmark.sh --iterations 20
#   ./scripts/startup-benchmark.sh --report     # Print only, do not fail CI
#
# Requirements:
#   - The release binary must be built first: cargo build --release -p rdap-cli
#   - bash ≥ 4.0
#   - date(1) with nanosecond support (GNU coreutils; on macOS install via brew)

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────

ITERATIONS=10
TARGET_MS=100
REPORT_ONLY=0

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --iterations) ITERATIONS="$2"; shift 2 ;;
    --target-ms)  TARGET_MS="$2";  shift 2 ;;
    --report)     REPORT_ONLY=1;   shift   ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

# ── Setup ─────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$SCRIPT_DIR/../target/release/rdapify"

if [[ ! -f "$BINARY" ]]; then
  echo "Binary not found: $BINARY"
  echo "Build it first: cargo build --release -p rdap-cli"
  exit 1
fi

# Verify nanosecond date support
if ! date +%s%N | grep -qE '^[0-9]+$'; then
  echo "Warning: date +%s%N not supported on this platform. Install GNU coreutils."
  echo "On macOS: brew install coreutils && alias date=gdate"
  exit 0
fi

# ── Measurement loop ──────────────────────────────────────────────────────────

echo ""
printf "${BOLD}RDAPify Startup Time Benchmark${RESET}\n"
echo "=================================================="
echo "Binary:     $BINARY"
echo "Iterations: $ITERATIONS"
echo "Target:     < ${TARGET_MS} ms"
echo ""

TIMES=()

for i in $(seq 1 "$ITERATIONS"); do
  T_START=$(date +%s%N)
  "$BINARY" --help > /dev/null 2>&1
  T_END=$(date +%s%N)
  ELAPSED_NS=$(( T_END - T_START ))
  ELAPSED_MS=$(( ELAPSED_NS / 1000000 ))
  TIMES+=("$ELAPSED_MS")
  printf "  Run %2d: %4d ms\n" "$i" "$ELAPSED_MS"
done

# ── Statistics ────────────────────────────────────────────────────────────────

echo ""

# Sort times and compute median, min, max
sorted=($(echo "${TIMES[@]}" | tr ' ' '\n' | sort -n))
COUNT=${#sorted[@]}
MIN=${sorted[0]}
MAX=${sorted[$(( COUNT - 1 ))]}

MEDIAN_IDX=$(( COUNT / 2 ))
MEDIAN=${sorted[$MEDIAN_IDX]}

SUM=0
for t in "${TIMES[@]}"; do
  SUM=$(( SUM + t ))
done
AVG=$(( SUM / COUNT ))

echo "--------------------------------------------------"
printf "  Min:    %4d ms\n" "$MIN"
printf "  Max:    %4d ms\n" "$MAX"
printf "  Avg:    %4d ms\n" "$AVG"
printf "  Median: %4d ms  (target: < %d ms)\n" "$MEDIAN" "$TARGET_MS"
echo "--------------------------------------------------"

# ── Pass / fail ───────────────────────────────────────────────────────────────

if (( MEDIAN <= TARGET_MS )); then
  printf "\n${GREEN}PASS: Median startup time %d ms is within target (%d ms).${RESET}\n\n" \
    "$MEDIAN" "$TARGET_MS"
  exit 0
else
  if (( REPORT_ONLY == 1 )); then
    printf "\n${YELLOW}WARNING: Median startup time %d ms exceeds target (%d ms).${RESET}\n\n" \
      "$MEDIAN" "$TARGET_MS"
    exit 0
  else
    printf "\n${RED}FAIL: Median startup time %d ms exceeds target (%d ms).${RESET}\n\n" \
      "$MEDIAN" "$TARGET_MS"
    echo "Possible causes:"
    echo "  - Too much work in static initializers or lazy_static blocks"
    echo "  - Too many dynamic library loads (check ldd output)"
    echo "  - Build was not release: cargo build --release"
    exit 1
  fi
fi
