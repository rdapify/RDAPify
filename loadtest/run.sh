#!/usr/bin/env bash
# Stage E load-test orchestrator.
#
# Usage:
#   loadtest/run.sh harness e1                  # in-process Rust harness, scenario E1
#   loadtest/run.sh harness e3                  # in-process Rust harness, scenario E3
#   loadtest/run.sh k6      e1                  # k6 against rdap-service (must be running)
#   loadtest/run.sh k6      e3
#   loadtest/run.sh build                       # build mock-upstream + harness
#
# The "harness" path drives the rdapify *library* directly against the mock
# upstream, bypassing rdap-service. Reproducible, fast, and what CI runs.
#
# The "k6" path drives `rdap-service` over HTTP — the production-faithful
# end-to-end measurement. Requires k6 (https://k6.io) and a running
# rdap-service. It does NOT spin up rdap-service for you; spin it up
# separately with the mock as its upstream.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WORKSPACE=$(cd "$ROOT/.." && pwd)
MOCK_BIN="$ROOT/mock-upstream/target/release/mock-upstream"
HARNESS_BIN="$ROOT/harness/target/release/harness"
MOCK_PORT="${MOCK_PORT:-18080}"
MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-5}"

cmd="${1:-help}"
scenario="${2:-}"

build() {
  echo "==> building mock-upstream"
  (cd "$ROOT/mock-upstream" && cargo build --release)
  echo "==> building harness"
  (cd "$ROOT/harness" && cargo build --release)
}

need_built() {
  if [[ ! -x "$MOCK_BIN" || ! -x "$HARNESS_BIN" ]]; then
    echo "==> binaries missing, building first"
    build
  fi
}

start_mock() {
  echo "==> starting mock-upstream on 127.0.0.1:$MOCK_PORT \
(latency=${MOCK_LATENCY_MS}ms failure=${MOCK_FAILURE_RATE:-0.0} \
rate-limit=${MOCK_RATE_LIMIT_RATE:-0.0} retry-after=${MOCK_RETRY_AFTER_SECS:-5}s)"
  "$MOCK_BIN" \
    --bind "127.0.0.1:$MOCK_PORT" \
    --latency-ms "$MOCK_LATENCY_MS" \
    --failure-rate "${MOCK_FAILURE_RATE:-0.0}" \
    --rate-limit-rate "${MOCK_RATE_LIMIT_RATE:-0.0}" \
    --retry-after-secs "${MOCK_RETRY_AFTER_SECS:-5}" \
    >/tmp/mock-upstream.log 2>&1 &
  MOCK_PID=$!
  trap 'kill "$MOCK_PID" 2>/dev/null || true; wait "$MOCK_PID" 2>/dev/null || true' EXIT
  # Wait for /health to come up.
  for _ in $(seq 1 50); do
    if curl -sfo /dev/null "http://127.0.0.1:$MOCK_PORT/health"; then
      return 0
    fi
    sleep 0.1
  done
  echo "mock-upstream failed to come up; tail of log:"
  tail -20 /tmp/mock-upstream.log
  exit 2
}

run_harness() {
  need_built
  case "$scenario" in
    e1)
      MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-0}" start_mock
      "$HARNESS_BIN" --upstream "http://127.0.0.1:$MOCK_PORT" e1
      ;;
    e2)
      MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-10}" start_mock
      "$HARNESS_BIN" --upstream "http://127.0.0.1:$MOCK_PORT" e2
      ;;
    e3)
      MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-5}" start_mock
      "$HARNESS_BIN" --upstream "http://127.0.0.1:$MOCK_PORT" e3
      ;;
    e4)
      MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-20}" \
      MOCK_FAILURE_RATE="${MOCK_FAILURE_RATE:-0.5}" start_mock
      "$HARNESS_BIN" --upstream "http://127.0.0.1:$MOCK_PORT" e4
      ;;
    e5)
      # E5 wants 100 % rate-limit and 2 s Retry-After. Override via env so
      # the operator can tune the wait without recompiling.
      MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-0}" \
      MOCK_RATE_LIMIT_RATE="${MOCK_RATE_LIMIT_RATE:-1.0}" \
      MOCK_RETRY_AFTER_SECS="${MOCK_RETRY_AFTER_SECS:-2}" start_mock
      "$HARNESS_BIN" --upstream "http://127.0.0.1:$MOCK_PORT" e5
      ;;
    e6)
      MOCK_LATENCY_MS="${MOCK_LATENCY_MS:-1}" start_mock
      "$HARNESS_BIN" --upstream "http://127.0.0.1:$MOCK_PORT" e6
      ;;
    *)
      echo "unknown harness scenario: $scenario (try: e1, e2, e3, e4, e5, e6)"
      exit 64
      ;;
  esac
}

run_k6() {
  if ! command -v k6 >/dev/null 2>&1; then
    echo "k6 not found in PATH. Install: https://k6.io/docs/get-started/installation/"
    echo "Or use the in-process harness:  loadtest/run.sh harness $scenario"
    exit 127
  fi
  TARGET="${TARGET:-http://127.0.0.1:8080}"
  if ! curl -sfo /dev/null "$TARGET/health"; then
    echo "rdap-service not reachable at $TARGET. Start it first:"
    echo "  cargo run --release -p rdap-service"
    echo "(make sure its config routes to the mock at port $MOCK_PORT)"
    exit 2
  fi
  mkdir -p "$ROOT/reports"
  case "$scenario" in
    e1) k6 run --env "TARGET=$TARGET" --env "DOMAIN=${DOMAIN:-example.com}" "$ROOT/k6/e1_baseline.js" ;;
    e2) k6 run --env "TARGET=$TARGET" --env "UNIQUE_DOMAINS=${UNIQUE_DOMAINS:-1000}" "$ROOT/k6/e2_cold_cache.js" ;;
    e3) k6 run --env "TARGET=$TARGET" "$ROOT/k6/e3_burst.js" ;;
    e4) k6 run --env "TARGET=$TARGET" "$ROOT/k6/e4_upstream_failure.js" ;;
    e5) k6 run --env "TARGET=$TARGET" "$ROOT/k6/e5_rate_limit.js" ;;
    e6) k6 run --env "TARGET=$TARGET" --env "UNIQUE_DOMAINS=${UNIQUE_DOMAINS:-50000}" "$ROOT/k6/e6_adversarial.js" ;;
    *)
      echo "unknown k6 scenario: $scenario (try: e1, e2, e3, e4, e5, e6)"
      exit 64
      ;;
  esac
}

case "$cmd" in
  build)   build ;;
  harness) run_harness ;;
  k6)      run_k6 ;;
  help|*)
    sed -n '1,28p' "$0"
    exit 0
    ;;
esac
