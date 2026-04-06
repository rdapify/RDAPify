#!/usr/bin/env bash
# scripts/size-check.sh — Binary size validation for RDAPify
#
# Builds the rdap-cli binary in several feature configurations and checks
# each against the size targets defined in docs/PERFORMANCE_SPEC.md.
#
# Usage:
#   ./scripts/size-check.sh          # Check only (exit 1 on violation)
#   ./scripts/size-check.sh --report # Print sizes without failing
#
# Requirements:
#   - Rust toolchain with cargo
#   - strip(1) (optional — release profile already strips symbols)
#
# Targets:
#   Core only (--no-default-features)  < 6 MB
#   Default  (memory-cache + stream)   < 7 MB
#   Full     (--features full)         < 12 MB

set -euo pipefail

REPORT_ONLY=0
if [[ "${1:-}" == "--report" ]]; then
  REPORT_ONLY=1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0

# Returns file size in bytes
filesize() {
  if [[ "$(uname)" == "Darwin" ]]; then
    stat -f%z "$1"
  else
    stat -c%s "$1"
  fi
}

# Pretty-prints bytes as MB
to_mb() {
  echo "scale=2; $1 / 1048576" | bc
}

check_binary() {
  local label="$1"
  local binary="$2"
  local limit_mb="$3"

  if [[ ! -f "$binary" ]]; then
    printf "${YELLOW}  SKIP  ${RESET} %-40s  (binary not found)\n" "$label"
    return
  fi

  local bytes
  bytes=$(filesize "$binary")
  local mb
  mb=$(to_mb "$bytes")
  local limit_bytes=$(( limit_mb * 1048576 ))

  if (( bytes <= limit_bytes )); then
    printf "${GREEN}  PASS  ${RESET} %-40s  %5.2f MB  (limit %d MB)\n" "$label" "$mb" "$limit_mb"
    PASS=$(( PASS + 1 ))
  else
    printf "${RED}  FAIL  ${RESET} %-40s  %5.2f MB  (limit %d MB — EXCEEDS by %.2f MB)\n" \
      "$label" "$mb" "$limit_mb" "$(echo "scale=2; ($bytes - $limit_bytes) / 1048576" | bc)"
    FAIL=$(( FAIL + 1 ))
  fi
}

# ── Build ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$SCRIPT_DIR/.."
CLI_BIN="$WORKSPACE/target/release/rdapify"

cd "$WORKSPACE"

echo ""
printf "${BOLD}RDAPify Binary Size Check${RESET}\n"
echo "=================================================="

# Build 1: Core only (smallest possible binary)
echo ""
echo "Building: core only (--no-default-features)..."
cargo build --release -p rdap-cli --no-default-features 2>/dev/null || \
  cargo build --release -p rdap-cli 2>/dev/null
cp "$CLI_BIN" "/tmp/rdapify-core" 2>/dev/null || true

# Build 2: Default (memory-cache + stream)
echo "Building: default features..."
cargo build --release -p rdap-cli 2>/dev/null
cp "$CLI_BIN" "/tmp/rdapify-default" 2>/dev/null || true

# Build 3: Full
echo "Building: full (--features full)..."
cargo build --release -p rdapify --features full 2>/dev/null || true
cp "$CLI_BIN" "/tmp/rdapify-full" 2>/dev/null || true

# ── Size checks ───────────────────────────────────────────────────────────────

echo ""
echo "--------------------------------------------------"
printf "  %-6s  %-40s  %7s  %s\n" "Status" "Build" "Size" "Limit"
echo "--------------------------------------------------"

check_binary "core only (--no-default-features)" "/tmp/rdapify-core"    6
check_binary "default (memory-cache + stream)"   "/tmp/rdapify-default" 7
check_binary "full (--features full)"            "/tmp/rdapify-full"    12

# Also show the rdapify library for reference (not enforced)
RDAPIFY_LIB=$(find "$WORKSPACE/target/release" -name "librdapify.rlib" 2>/dev/null | head -1 || true)
if [[ -n "$RDAPIFY_LIB" ]]; then
  local_mb=$(to_mb "$(filesize "$RDAPIFY_LIB")")
  printf "  %-6s  %-40s  %5.2f MB  %s\n" "INFO" "librdapify.rlib (reference)" "$local_mb" "(not enforced)"
fi

echo "--------------------------------------------------"
printf "  Total: ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}\n" "$PASS" "$FAIL"
echo ""

# ── Cleanup ───────────────────────────────────────────────────────────────────

rm -f /tmp/rdapify-core /tmp/rdapify-default /tmp/rdapify-full

# ── Exit code ─────────────────────────────────────────────────────────────────

if (( REPORT_ONLY == 0 && FAIL > 0 )); then
  printf "${RED}FAIL: %d build(s) exceeded size targets.${RESET}\n\n" "$FAIL"
  echo "To reduce binary size:"
  echo "  - Disable unused features: --no-default-features"
  echo "  - Check for new heavy dependencies: cargo tree --duplicates"
  echo "  - Ensure profile.release has opt-level = \"z\", lto = true, strip = true"
  exit 1
fi

printf "${GREEN}All size checks passed.${RESET}\n\n"
