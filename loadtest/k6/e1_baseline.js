// Stage E · E1 — Baseline (cache warm).
//
// 1 000 req/s for 10 s against `rdap-service`, hammering the same domain so
// the response cache should hit ≈ 100 % after warm-up.
//
// Pass criteria (Stage E spec):
//   - error_rate < 1 %
//   - p50 < 10 ms
//   - p95 < 50 ms
//
// Run:
//   k6 run --env TARGET=http://127.0.0.1:8080 --env DOMAIN=example.com loadtest/k6/e1_baseline.js
//
// k6 docs: https://k6.io/docs/

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const TARGET = __ENV.TARGET || 'http://127.0.0.1:8080';
const DOMAIN = __ENV.DOMAIN || 'example.com';

// Custom metrics — k6 emits its own http_req_duration but we want a clean
// trend that's free of the warm-up call.
const cacheHitLatency = new Trend('rdap_cache_hit_latency_ms');
const cachedReplies = new Counter('rdap_cached_replies');

export const options = {
  // Open-loop arrival pattern at constant 1 000 req/s for 10 s. k6's
  // shared-iterations executor would be closed-loop; we use the constant
  // arrival rate executor so the test sustains 1 000 req/s regardless of
  // VU latency (queueing exposes saturation, which is the point).
  scenarios: {
    baseline: {
      executor: 'constant-arrival-rate',
      rate: 1000,
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 200,
      maxVUs: 500,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],            // < 1% errors
    http_req_duration: [
      'p(50)<10',                              // p50 < 10 ms
      'p(95)<50',                              // p95 < 50 ms
      'p(99)<100',                             // soft target
    ],
    rdap_cache_hit_latency_ms: ['p(95)<50'],
    rdap_cached_replies: ['count>9000'],
  },
  // Tag every request with the scenario name for easy grouping in
  // Grafana/k6 cloud.
  tags: { scenario: 'e1_baseline' },
};

// Warm the cache once, before the load executor starts.
export function setup() {
  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: DOMAIN, kind: 'domain' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (r.status !== 200) {
    throw new Error(`E1 setup: warm-up returned ${r.status}: ${r.body}`);
  }
}

export default function () {
  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: DOMAIN, kind: 'domain' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { call: 'rdap_lookup' },
    },
  );

  const ok = check(r, {
    'status is 200': (r) => r.status === 200,
    'has objectClassName': (r) =>
      r.body && (r.body.includes('"objectClassName"') || r.body.includes('"meta"')),
  });

  if (ok) {
    cacheHitLatency.add(r.timings.duration);
    cachedReplies.add(1);
  }
}

// Optional summary handler — k6 prints its own table; this writes a JSON
// file for the orchestrator to consume.
export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'loadtest/reports/e1_summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const fmt = (k) => (m[k] ? Math.round(m[k].values?.['p(95)'] ?? 0) : '—');
  return (
    `\nE1 baseline summary\n` +
    `  http_req_duration p50: ${m.http_req_duration?.values?.['p(50)']?.toFixed(2)} ms\n` +
    `  http_req_duration p95: ${m.http_req_duration?.values?.['p(95)']?.toFixed(2)} ms\n` +
    `  http_req_duration p99: ${m.http_req_duration?.values?.['p(99)']?.toFixed(2)} ms\n` +
    `  errors: ${(m.http_req_failed?.values?.rate * 100).toFixed(2)}%\n` +
    `  total requests: ${m.http_reqs?.values?.count}\n`
  );
}
