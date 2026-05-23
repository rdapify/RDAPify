// Stage E · E5 — Rate limiting (429 + Retry-After: 2).
//
// Mock upstream emits 429 with `Retry-After: 2` on every request. The
// engine should:
//   - honour the Retry-After header (each retry waits ≥ 2 s)
//   - cap retries (per `retry_limit_429` = 3 in rdap-core::fetcher)
//   - never produce a "retry storm" (upstream calls bounded by
//     total_requests × max_attempts)
//
// Each query takes ~ 4 s wall time (2 retries × 2 s). The total run
// time is small (50 queries / 10 concurrent ⇒ ~20 s) so it's safe in CI.
//
// Pre-flight:
//   - rdap-service must be running
//   - mock-upstream with --rate-limit-rate 1.0 --retry-after-secs 2
//
// Run:
//   k6 run --env TARGET=http://127.0.0.1:8080 loadtest/k6/e5_rate_limit.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const TARGET = __ENV.TARGET || 'http://127.0.0.1:8080';

const e5Latency = new Trend('rdap_e5_latency_ms');
const e5Failed = new Counter('rdap_e5_failed');

export const options = {
  scenarios: {
    rate_limit: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 50,
      maxDuration: '2m',
    },
  },
  thresholds: {
    // Per-query latency floor: 2 retries × 2 s Retry-After = 4 s.
    // p50 < 4 s would prove the engine ignored Retry-After (retry storm).
    'rdap_e5_latency_ms': ['p(50)>3500'],
    // Upper bound: with timeouts and slack, no query should exceed 30 s.
    http_req_duration: ['p(99)<30000'],
  },
  tags: { scenario: 'e5_rate_limit' },
};

export default function () {
  const i = exec.scenario.iterationInTest;
  const domain = `e5-${String(i).padStart(6, '0')}.example`;
  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: domain, kind: 'domain' }),
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: '30s',
    },
  );
  check(r, {
    // Every query is expected to fail with 429 / 502 / 503 / 504 after
    // exhausting retries — surfaced by rdap-service as a 5xx-class
    // ServiceError, depending on its mapping.
    'failed as expected (not 200)': (r) => r.status !== 200,
  });
  e5Latency.add(r.timings.duration);
  if (r.status !== 200) e5Failed.add(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'loadtest/reports/e5_summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return (
    `\nE5 rate-limit summary\n` +
    `  http_req_duration p50: ${m.http_req_duration?.values?.['p(50)']?.toFixed(2)} ms  (must be ≥ 3500 ms)\n` +
    `  http_req_duration p95: ${m.http_req_duration?.values?.['p(95)']?.toFixed(2)} ms\n` +
    `  http_req_duration p99: ${m.http_req_duration?.values?.['p(99)']?.toFixed(2)} ms\n` +
    `  total queries: ${m.http_reqs?.values?.count}\n` +
    `  failed (expected): ${m.rdap_e5_failed?.values?.count}\n` +
    `\nIf p50 < 3500 ms, the engine is NOT honouring Retry-After — that's a\n` +
    `retry-storm bug. Confirm with the in-process harness which scrapes\n` +
    `the mock /stats for an exact upstream call count.\n`
  );
}
