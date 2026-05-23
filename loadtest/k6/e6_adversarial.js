// Stage E · E6 — Adversarial input (high cardinality).
//
// 50 000 unique domains, no cache reuse. Validates that the engine's
// internal data structures (cache, breaker registry, in-flight refresh
// map) are bounded under unbounded cardinality input.
//
// k6 can observe the *output* of bounded behaviour (no error spike, no
// latency drift, request rate stays sustainable), but cannot directly
// inspect the engine's internal state. The in-process harness does that
// via RSS measurement and the rdap-metrics handle. Use this script to
// stress-test rdap-service in a real lab; use the harness for CI.
//
// Pre-flight:
//   - rdap-service running with cache cap configured (default 1 000)
//   - mock-upstream running with --latency-ms 1
//
// Run:
//   k6 run --env TARGET=http://127.0.0.1:8080 loadtest/k6/e6_adversarial.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const TARGET = __ENV.TARGET || 'http://127.0.0.1:8080';
const UNIQUE = parseInt(__ENV.UNIQUE_DOMAINS || '50000', 10);

const advLatency = new Trend('rdap_adversarial_latency_ms');
const advSuccess = new Counter('rdap_adversarial_success');

export const options = {
  scenarios: {
    adversarial: {
      executor: 'shared-iterations',
      vus: 256,
      iterations: UNIQUE,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // Per the harness floor: with 1 ms upstream latency and 256 VUs we
    // measured p95 ≈ 49 ms in-process; over HTTP add ~50 ms middleware.
    http_req_duration: ['p(95)<300'],
    rdap_adversarial_success: [`count>${(UNIQUE * 0.99).toFixed(0)}`],
  },
  tags: { scenario: 'e6_adversarial' },
};

export default function () {
  const i = exec.scenario.iterationInTest;
  // Same hash-shape as the in-process harness so cache-key distribution
  // matches across the two paths.
  const mixed = (i * 2654435761) >>> 0; // Knuth multiplicative hash, u32
  const domain = `adv-${mixed.toString(16).padStart(8, '0')}-${i}.example`;
  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: domain, kind: 'domain' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const ok = check(r, { 'status is 200': (r) => r.status === 200 });
  if (ok) {
    advSuccess.add(1);
    advLatency.add(r.timings.duration);
  }
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'loadtest/reports/e6_summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return (
    `\nE6 adversarial summary\n` +
    `  http_req_duration p50: ${m.http_req_duration?.values?.['p(50)']?.toFixed(2)} ms\n` +
    `  http_req_duration p95: ${m.http_req_duration?.values?.['p(95)']?.toFixed(2)} ms\n` +
    `  http_req_duration p99: ${m.http_req_duration?.values?.['p(99)']?.toFixed(2)} ms\n` +
    `  errors: ${(m.http_req_failed?.values?.rate * 100).toFixed(2)}%\n` +
    `  successes: ${m.rdap_adversarial_success?.values?.count}\n` +
    `\nMemory bound is NOT validated by k6 — run \`loadtest/run.sh harness e6\`\n` +
    `to get RSS-stable assertion via /proc/self/status.\n`
  );
}
