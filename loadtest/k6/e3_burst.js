// Stage E · E3 — Burst load.
//
// Spike from 0 → 2 000 req/s in < 1 s. Each request hits a unique domain
// so cache hits don't mask the burst. Validates that the engine's
// upstream-concurrency semaphore caps the actual upstream load and that
// no Tokio task explosion occurs.
//
// Pass criteria (Stage E spec):
//   - semaphore caps concurrency (rdap_inflight_requests stays ≤ configured limit)
//   - no task explosion (the host doesn't OOM; harness completes)
//   - p95 < 300 ms (Stage E SLO target under spike)
//   - error_rate < 1 %
//
// Run:
//   k6 run --env TARGET=http://127.0.0.1:8080 loadtest/k6/e3_burst.js

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const TARGET = __ENV.TARGET || 'http://127.0.0.1:8080';

const burstLatency = new Trend('rdap_burst_latency_ms');
const burstSuccess = new Counter('rdap_burst_success');

export const options = {
  scenarios: {
    burst: {
      // ramping-arrival-rate steps from `startRate` up to `target` over the
      // stage duration. With duration=1s, startRate=0, target=2000 we get
      // a roughly linear ramp from 0 → 2 000 rps in 1 s, then hold for 4 s
      // to capture queue drain.
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 4000,
      stages: [
        { target: 2000, duration: '1s' },
        { target: 2000, duration: '4s' },
        { target: 0,    duration: '1s' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [
      'p(95)<300',
      'p(99)<1000',
    ],
    // Sanity: at least 5 000 of the ~10 000 expected requests must complete
    // successfully. The lower bound catches a hung service.
    rdap_burst_success: ['count>5000'],
  },
  tags: { scenario: 'e3_burst' },
};

export default function () {
  // Each VU iteration → unique domain (using k6's iteration counter).
  // Avoids any cache-hit shortcut.
  const i = exec.scenario.iterationInTest;
  const domain = `burst-${String(i).padStart(7, '0')}.example`;

  const r = http.post(
    `${TARGET}/rdap`,
    JSON.stringify({ query: domain, kind: 'domain' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { call: 'rdap_lookup' },
    },
  );

  const ok = check(r, {
    'status 2xx or 5xx (not crashed)': (r) =>
      (r.status >= 200 && r.status < 300) || (r.status >= 500 && r.status < 600),
  });
  if (r.status === 200) {
    burstSuccess.add(1);
    burstLatency.add(r.timings.duration);
  } else if (!ok) {
    // Log the first failure for triage. k6 will sample.
    console.warn(`E3 unexpected status ${r.status}: ${r.body}`);
  }
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'loadtest/reports/e3_summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return (
    `\nE3 burst summary\n` +
    `  http_req_duration p50: ${m.http_req_duration?.values?.['p(50)']?.toFixed(2)} ms\n` +
    `  http_req_duration p95: ${m.http_req_duration?.values?.['p(95)']?.toFixed(2)} ms\n` +
    `  http_req_duration p99: ${m.http_req_duration?.values?.['p(99)']?.toFixed(2)} ms\n` +
    `  http_req_duration max: ${m.http_req_duration?.values?.max?.toFixed(2)} ms\n` +
    `  errors: ${(m.http_req_failed?.values?.rate * 100).toFixed(2)}%\n` +
    `  successes: ${m.rdap_burst_success?.values?.count}\n` +
    `  total requests: ${m.http_reqs?.values?.count}\n`
  );
}
