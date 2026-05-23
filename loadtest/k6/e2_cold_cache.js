// Stage E · E2 — Cold cache / fan-out (single-flight verification).
//
// 200 concurrent VUs hit the same set of 1 000 unique domains. The engine's
// `try_acquire_refresh` single-flight should collapse concurrent same-key
// fetches into one upstream call per domain. The k6 path can't directly
// query the mock's request count, so this script asserts the *latency
// distribution* expected when single-flight is working:
//
//   - p50 ≈ upstream_latency + small overhead (followers wake fast)
//   - p95 < 300 ms (engine SLO)
//   - error_rate < 1 %
//
// To verify the upstream-call count exactly, run the in-process harness
// (`loadtest/run.sh harness e2`) which scrapes the mock's `/stats`.
//
// Run:
//   k6 run --env TARGET=http://127.0.0.1:8080 loadtest/k6/e2_cold_cache.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const TARGET = __ENV.TARGET || 'http://127.0.0.1:8080';
const UNIQUE = parseInt(__ENV.UNIQUE_DOMAINS || '1000', 10);

const lookupLatency = new Trend('rdap_cold_cache_latency_ms');
const successCount = new Counter('rdap_cold_cache_success');

export const options = {
  scenarios: {
    cold_cache: {
      executor: 'shared-iterations',
      vus: 200,
      iterations: 200 * UNIQUE,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    rdap_cold_cache_success: [`count>${(200 * UNIQUE * 0.99).toFixed(0)}`],
  },
  tags: { scenario: 'e2_cold_cache' },
};

export default function () {
  // Each VU iterates through the same domain list in the same order. With
  // 200 VUs starting in lock-step, all 200 hit `cold-000000.example` first;
  // the engine's single-flight collapses 199 of those into one upstream
  // call.
  const i = exec.vu.iterationInScenario % UNIQUE;
  const domain = `cold-${String(i).padStart(6, '0')}.example`;
  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: domain, kind: 'domain' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { call: 'rdap_lookup' },
    },
  );
  const ok = check(r, { 'status is 200': (r) => r.status === 200 });
  if (ok) {
    successCount.add(1);
    lookupLatency.add(r.timings.duration);
  }
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'loadtest/reports/e2_summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return (
    `\nE2 cold-cache summary\n` +
    `  http_req_duration p50: ${m.http_req_duration?.values?.['p(50)']?.toFixed(2)} ms\n` +
    `  http_req_duration p95: ${m.http_req_duration?.values?.['p(95)']?.toFixed(2)} ms\n` +
    `  http_req_duration p99: ${m.http_req_duration?.values?.['p(99)']?.toFixed(2)} ms\n` +
    `  errors: ${(m.http_req_failed?.values?.rate * 100).toFixed(2)}%\n` +
    `  successes: ${m.rdap_cold_cache_success?.values?.count}\n` +
    `\nNote: to verify exact upstream-call count (single-flight collapse),\n` +
    `run the in-process harness:\n` +
    `  loadtest/run.sh harness e2\n`
  );
}
