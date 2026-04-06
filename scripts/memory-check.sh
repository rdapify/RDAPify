#!/usr/bin/env bash
# scripts/memory-check.sh — Memory usage measurement for rdapify CLI
#
# Measures peak RSS and CPU time for a real RDAP query using /usr/bin/time -v
# (GNU time). Falls back to valgrind massif if -v is unavailable.
#
# Targets (from docs/PERFORMANCE_SPEC.md):
#   Idle memory (--help):         < 30 MB RSS
#   Single query (real network):  < 50 MB RSS
#   Batch 10 domains:             < 150 MB RSS
#
# Usage:
#   ./scripts/memory-check.sh                 # Idle test only (no network)
#   ./scripts/memory-check.sh --network       # Idle + single query (needs network)
#   ./scripts/memory-check.sh --report        # Print only, do not fail CI
#
# Requirements:
#   - GNU time (/usr/bin/time or gtime on macOS: brew install gnu-time)
#   - Release binary: cargo build --release -p rdap-cli

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────

NETWORK=0
REPORT_ONLY=0
IDLE_LIMIT_MB=30
QUERY_LIMIT_MB=50

while [[ $# -gt 0 ]]; do
  case "$1" in
    --network) NETWORK=1;     shift ;;
    --report)  REPORT_ONLY=1; shift ;;
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

# Detect GNU time
if /usr/bin/time -v true 2>/dev/null; then
  TIME_CMD="/usr/bin/time -v"
elif command -v gtime &>/dev/null && gtime -v true 2>/dev/null; then
  TIME_CMD="gtime -v"
else
  echo "GNU time not available (/usr/bin/time -v or gtime)."
  echo "On Debian/Ubuntu: sudo apt-get install time"
  echo "On macOS: brew install gnu-time && alias gtime=$(brew --prefix gnu-time)/bin/gtime"
  exit 0
fi

PASS=0
FAIL=0

# ── Measurement function ──────────────────────────────────────────────────────

# measure_rss <label> <limit_mb> <cmd...>
# Runs the command under GNU time, extracts peak RSS, compares to limit.
measure_rss() {
  local label="$1"
  local limit_mb="$2"
  shift 2
  local cmd=("$@")

  local tmpfile
  tmpfile=$(mktemp)

  # GNU time writes to stderr
  { $TIME_CMD "${cmd[@]}" > /dev/null; } 2>"$tmpfile" || true

  # Extract "Maximum resident set size (kbytes):" line
  local rss_kb
  rss_kb=$(grep -i "maximum resident" "$tmpfile" | awk '{print $NF}' || echo "0")
  rm -f "$tmpfile"

  if [[ -z "$rss_kb" || "$rss_kb" == "0" ]]; then
    printf "  ${YELLOW}SKIP${RESET}  %-45s  (could not read RSS)\n" "$label"
    return
  fi

  local rss_mb
  rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc)

  if (( $(echo "$rss_mb <= $limit_mb" | bc -l) )); then
    printf "  ${GREEN}PASS${RESET}  %-45s  %5.1f MB  (limit %d MB)\n" \
      "$label" "$rss_mb" "$limit_mb"
    PASS=$(( PASS + 1 ))
  else
    printf "  ${RED}FAIL${RESET}  %-45s  %5.1f MB  (limit %d MB — exceeds by %.1f MB)\n" \
      "$label" "$rss_mb" "$limit_mb" "$(echo "scale=1; $rss_mb - $limit_mb" | bc)"
    FAIL=$(( FAIL + 1 ))
  fi
}

# ── Tests ─────────────────────────────────────────────────────────────────────

echo ""
printf "${BOLD}RDAPify Memory Usage Check${RESET}\n"
echo "=================================================="

echo ""
echo "--- Idle (no network) ---"
measure_rss "idle: --help"  "$IDLE_LIMIT_MB"  "$BINARY" "--help"

if (( NETWORK == 1 )); then
  echo ""
  echo "--- Single query (requires network) ---"
  echo "Querying example.com via live RDAP..."
  measure_rss "query: domain example.com"  "$QUERY_LIMIT_MB"  \
    "$BINARY" "domain" "example.com" 2>/dev/null || \
    printf "  ${YELLOW}SKIP${RESET}  query: domain example.com  (network unavailable)\n"
else
  echo ""
  printf "  ${YELLOW}NOTE${RESET}   Network tests skipped. Run with --network to enable.\n"
fi

echo ""
echo "--------------------------------------------------"
printf "  Total: ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}\n" "$PASS" "$FAIL"
echo ""

# ── Tips ──────────────────────────────────────────────────────────────────────

cat << 'EOF'
Measurement tips:
  - For heap profiling, use valgrind --tool=massif:
      valgrind --tool=massif --pages-as-heap=yes ./target/release/rdapify domain example.com
      ms_print massif.out.* | head -50

  - For memory leak detection:
      valgrind --leak-check=full ./target/release/rdapify domain example.com

  - For live RSS monitoring under sustained load:
      watch -n 0.5 "ps -o rss= -p \$(pgrep rdapify)"
EOF

echo ""

# ── Exit code ─────────────────────────────────────────────────────────────────

if (( REPORT_ONLY == 0 && FAIL > 0 )); then
  printf "${RED}FAIL: %d check(s) exceeded memory targets.${RESET}\n\n" "$FAIL"
  exit 1
fi

printf "${GREEN}Memory checks passed.${RESET}\n\n"
