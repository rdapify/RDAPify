// Stage E · E4 — Upstream failure (50 % 5xx).
//
// Mock upstream returns 500 for half of all requests, 20 ms latency.
// Validates that the engine's circuit breaker + bounded retries keep p95
// under control — the breaker design lets failures fail-fast once tripped,
// so latency under sustained 50 % failure is *better* than under random
// upstream pressure (because the breaker short-circuits before the
// upstream RTT).
//
// Pre-flight:
//   - rdap-service must be running
//   - mock-upstream must be running with --failure-rate 0.5 --latency-ms 20
//
// Run:
//   k6 run --env TARGET=http://127.0.0.1:8080 loadtest/k6/e4_upstream_failure.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const TARGET = __ENV.TARGET || 'http://127.0.0.1:8080';

const e4Latency = new Trend('rdap_e4_latency_ms');
const e4Failures = new Counter('rdap_e4_failures');

export const options = {
  scenarios: {
    upstream_failure: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    // p95 < 500 ms is the Stage E target. error_rate is *not* bounded
    // here — the upstream is 50 % broken; we expect high observed
    // failure. The point is bounded latency, not low error rate.
    http_req_duration: ['p(95)<500'],
  },
  tags: { scenario: 'e4_upstream_failure' },
};

export default function () {
  const i = exec.scenario.iterationInTest;
  const domain = `e4-${String(i).padStart(6, '0')}.example`;
  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: domain, kind: 'domain' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  // Don't fail the test on 500/CircuitOpen — those are *expected*.
  check(r, {
    'either success or expected failure': (r) =>
      r.status === 200 || r.status === 502 || r.status === 503 || r.status === 504 ||
      r.status === 500,
  });
  e4Latency.add(r.timings.duration);
  if (r.status !== 200) e4Failures.add(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'loadtest/reports/e4_summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return (
    `\nE4 upstream-failure summary\n` +
    `  http_req_duration p50: ${m.http_req_duration?.values?.['p(50)']?.toFixed(2)} ms\n` +
    `  http_req_duration p95: ${m.http_req_duration?.values?.['p(95)']?.toFixed(2)} ms\n` +
    `  http_req_duration p99: ${m.http_req_duration?.values?.['p(99)']?.toFixed(2)} ms\n` +
    `  observed failures: ${m.rdap_e4_failures?.values?.count}\n` +
    `  total requests: ${m.http_reqs?.values?.count}\n` +
    `\nValidation note:\n` +
    `  When a real RDAP-service /metrics endpoint is scraped after this run,\n` +
    `  rdap_circuit_breaker_open_total{origin="..."} should be > 0 if failures\n` +
    `  ever land 5-in-a-row. With 50% random failures that's a ~3% chance per\n` +
    `  window — the breaker may or may not trip depending on the random seed.\n` +
    `  Concentrated-failure breaker tests live in the rdap-core unit suite.\n`
  );
}
