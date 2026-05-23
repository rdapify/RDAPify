#!/usr/bin/env node
/**
 * RDAPify — Realistic Load Test (1000 Virtual Users)
 *
 * Simulates 1000 virtual users with 3 behavior personas against the ACTUAL
 * compiled rdapify library. No real network calls — a fetch interceptor
 * redirects all RDAP + IANA bootstrap traffic to an in-process mock that
 * simulates realistic latency distributions, cache behavior, and error rates.
 *
 * Usage:
 *   node benchmarks/load-test/index.js
 *   node benchmarks/load-test/index.js --users 500 --concurrency 30
 *
 * Requires: npm run build (run once before the test)
 *
 * Output:
 *   - Live progress to stdout
 *   - Final metrics report to stdout
 *   - Saves benchmarks/results/load-test-<timestamp>.md
 */

'use strict';

const path   = require('path');
const fs     = require('fs');
const { performance } = require('perf_hooks');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 ? parseInt(args[i + 1], 10) : def;
};
const TOTAL_USERS   = getArg('--users', 1000);
const CONCURRENCY   = getArg('--concurrency', 50);

// ─── Configuration ────────────────────────────────────────────────────────────

const MOCK_BASE = 'https://rdap.mock.test/v1';

// Latency buckets (ms): probability weights for fast / medium / slow / very-slow
const LATENCY_PROFILE = [
  { min: 30,  max: 90,  weight: 0.55 },   // fast registry (55%)
  { min: 90,  max: 200, weight: 0.30 },   // medium registry (30%)
  { min: 200, max: 400, weight: 0.12 },   // slow registry (12%)
  { min: 400, max: 800, weight: 0.03 },   // very slow (3%)
];

const ERROR_PROBS = {
  rateLimitPct:  0.030,  // 3.0 % → 429
  serverErrorPct: 0.005, // 0.5 % → 500
  timeoutPct:    0.010,  // 1.0 % → simulated timeout (>10 s)
};

// User personas
// Think times are compressed 10× for the simulator so 1000 users completes in ~60 s.
// In production, multiply these by 10 to get realistic session pacing.
const PERSONAS = {
  SOLO_DEV:  { weight: 0.60, minQueries: 5,  maxQueries: 15, thinkMin: 80,  thinkMax: 400 },
  POWER:     { weight: 0.25, minQueries: 10, maxQueries: 30, thinkMin: 20,  thinkMax: 150 },
  API_INT:   { weight: 0.15, minQueries: 20, maxQueries: 50, thinkMin: 0,   thinkMax: 10  },
};

// Query-type distribution per persona [domain, ip, asn]
const TYPE_DIST = {
  SOLO_DEV: [0.80, 0.15, 0.05],
  POWER:    [0.50, 0.30, 0.20],
  API_INT:  [0.45, 0.35, 0.20],
};

// Batch usage per persona (probability user makes ≥1 batch call this session)
const BATCH_PROB = { SOLO_DEV: 0.05, POWER: 0.30, API_INT: 0.70 };
const BATCH_SIZE = { SOLO_DEV: [2, 5], POWER: [5, 15], API_INT: [10, 30] };

// ─── Sample data ──────────────────────────────────────────────────────────────

const POPULAR_DOMAINS = [
  'google.com','cloudflare.com','github.com','microsoft.com','amazon.com',
  'facebook.com','youtube.com','twitter.com','netflix.com','apple.com',
  'stripe.com','twilio.com','vercel.com','heroku.com','digitalocean.com',
];

const LONG_TAIL_SUFFIXES = ['com','org','net','io','dev','app','co','ai'];

const POPULAR_IPS = [
  '1.1.1.1','8.8.8.8','9.9.9.9','208.67.222.222','64.6.64.6',
  '104.16.0.1','172.64.0.1','192.0.2.1',
];

const POPULAR_ASNS = [15169, 13335, 8075, 16509, 32934, 20940, 36040];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randInt(min, max)     { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max)   { return Math.random() * (max - min) + min; }
function sleep(ms)             { return new Promise(r => setTimeout(r, ms)); }
function pick(arr)             { return arr[Math.floor(Math.random() * arr.length)]; }

function randomDomain(popularBias = 0.30) {
  if (Math.random() < popularBias) return pick(POPULAR_DOMAINS);
  const word = Math.random().toString(36).slice(2, 8);
  return `${word}.${pick(LONG_TAIL_SUFFIXES)}`;
}

function randomIP() {
  if (Math.random() < 0.60) return pick(POPULAR_IPS);
  return `${randInt(1,254)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`;
}

function randomASN() {
  return Math.random() < 0.60 ? pick(POPULAR_ASNS) : randInt(1, 50000);
}

function sampleLatency() {
  const roll = Math.random();
  let cumulative = 0;
  for (const bucket of LATENCY_PROFILE) {
    cumulative += bucket.weight;
    if (roll < cumulative) return randInt(bucket.min, bucket.max);
  }
  return randInt(400, 800);
}

// ─── Mock RDAP responses ──────────────────────────────────────────────────────

function mockDomainResponse(domain) {
  const now = new Date();
  const exp = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  return {
    objectClassName: 'domain',
    handle: `${domain.toUpperCase().replace('.', '-')}-12345`,
    ldhName: domain,
    status: ['active', 'client transfer prohibited'],
    entities: [{
      objectClassName: 'entity',
      roles: ['registrar'],
      vcardArray: ['vcard', [
        ['version', {}, 'text', '4.0'],
        ['fn', {}, 'text', 'Mock Registrar LLC'],
      ]],
    }],
    events: [
      { eventAction: 'registration', eventDate: '2020-01-15T00:00:00Z' },
      { eventAction: 'expiration',   eventDate: exp.toISOString() },
      { eventAction: 'last changed', eventDate: now.toISOString() },
    ],
    nameservers: [
      { objectClassName: 'nameserver', ldhName: `ns1.${domain}` },
      { objectClassName: 'nameserver', ldhName: `ns2.${domain}` },
    ],
    secureDNS: { delegationSigned: false },
    rdapConformance: ['rdap_level_0'],
  };
}

function mockIPResponse(ip) {
  const isV6 = ip.includes(':');
  return {
    objectClassName: 'ip network',
    handle: `NET-${ip.replace(/[.:]/g, '-')}`,
    startAddress: ip,
    endAddress: ip,
    ipVersion: isV6 ? 'v6' : 'v4',
    name: 'MOCK-NET',
    type: 'DIRECT ALLOCATION',
    country: 'US',
    status: ['active'],
    entities: [],
    events: [
      { eventAction: 'registration', eventDate: '2015-06-01T00:00:00Z' },
      { eventAction: 'last changed', eventDate: '2023-01-01T00:00:00Z' },
    ],
    rdapConformance: ['rdap_level_0'],
  };
}

function mockASNResponse(asnNumber) {
  return {
    objectClassName: 'autnum',
    handle: `AS${asnNumber}`,
    startAutnum: asnNumber,
    endAutnum: asnNumber,
    name: `MOCK-AS-${asnNumber}`,
    type: 'DIRECT ALLOCATION',
    status: ['active'],
    entities: [],
    events: [
      { eventAction: 'registration', eventDate: '2010-01-01T00:00:00Z' },
    ],
    rdapConformance: ['rdap_level_0'],
  };
}

// IANA bootstrap responses — maps TLDs/CIDRs/ASN-ranges to our mock server
function mockBootstrapData(type) {
  const server = `${MOCK_BASE}`;
  const TLDS = [
    'com','net','org','edu','gov','mil','int','io','dev','app','co','ai',
    'cloud','tech','info','biz','us','uk','ca','de','fr','jp','au','br',
    'ru','cn','in','nl','pl','es','it','se','no','fi','dk','ch','at','be',
  ];

  if (type === 'dns') {
    return {
      version: '1.0',
      publication: '2024-01-01T00:00:00Z',
      description: 'IANA RDAP Bootstrap — DNS (mock)',
      services: [ [TLDS, [server]] ],
    };
  }
  if (type === 'ipv4') {
    // Cover all popular /8 blocks used in the test
    const cidrs = [
      '1.0.0.0/8','2.0.0.0/8','4.0.0.0/8','8.0.0.0/8','9.0.0.0/8',
      '12.0.0.0/8','13.0.0.0/8','15.0.0.0/8','16.0.0.0/8','17.0.0.0/8',
      '18.0.0.0/8','20.0.0.0/8','23.0.0.0/8','34.0.0.0/8','35.0.0.0/8',
      '52.0.0.0/8','54.0.0.0/8','64.0.0.0/8','104.0.0.0/8','128.0.0.0/8',
      '172.0.0.0/8','192.0.0.0/8','198.0.0.0/8','208.0.0.0/8','216.0.0.0/8',
      '0.0.0.0/1',   // catch-all lower half
      '128.0.0.0/1', // catch-all upper half
    ];
    return {
      version: '1.0',
      publication: '2024-01-01T00:00:00Z',
      description: 'IANA RDAP Bootstrap — IPv4 (mock)',
      services: [ [cidrs, [server]] ],
    };
  }
  if (type === 'ipv6') {
    return {
      version: '1.0',
      publication: '2024-01-01T00:00:00Z',
      description: 'IANA RDAP Bootstrap — IPv6 (mock)',
      services: [ [['2606:4700::/32', '2001:4860::/32', '::/0'], [server]] ],
    };
  }
  if (type === 'asn') {
    return {
      version: '1.0',
      publication: '2024-01-01T00:00:00Z',
      description: 'IANA RDAP Bootstrap — ASN (mock)',
      services: [ [['1-131071', '131072-4199999999'], [server]] ],
    };
  }
  return { version: '1.0', services: [] };
}

// ─── Metrics store ────────────────────────────────────────────────────────────

function createMetrics() {
  return {
    latencies:      [],           // ms per successful query
    cacheHitCount:  0,
    cacheMissCount: 0,
    queryTypes:     { domain: 0, ip: 0, asn: 0 },
    errors:         { rateLimit: 0, timeout: 0, serverError: 0, other: 0 },
    batchCalls:     0,
    batchSizes:     [],
    totalQueries:   0,
    successCount:   0,
    usersComplete:  0,
  };
}

// ─── Fetch interceptor ────────────────────────────────────────────────────────
// Must be installed BEFORE rdapify is require()'d

function installInterceptor(metrics) {
  const _origFetch = globalThis.fetch;

  globalThis.fetch = async function rdapifyMockFetch(urlInput, options) {
    const url = typeof urlInput === 'string' ? urlInput : urlInput.toString();

    // ── IANA Bootstrap requests ────────────────────────────────────────────
    if (url.includes('data.iana.org/rdap')) {
      const type = url.split('/rdap/')[1]?.replace('.json', '') ?? 'dns';
      const body = mockBootstrapData(type);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Mock RDAP server requests ──────────────────────────────────────────
    if (url.includes('rdap.mock.test')) {
      const roll = Math.random();

      // --- Rate limit (429) ------------------------------------------------
      if (roll < ERROR_PROBS.rateLimitPct) {
        metrics.errors.rateLimit++;
        return new Response(
          JSON.stringify({ errorCode: 429, title: 'Too Many Requests' }),
          { status: 429, headers: { 'Content-Type': 'application/rdap+json' } }
        );
      }

      // --- Server error (500) -----------------------------------------------
      if (roll < ERROR_PROBS.rateLimitPct + ERROR_PROBS.serverErrorPct) {
        metrics.errors.serverError++;
        return new Response(
          JSON.stringify({ errorCode: 500, title: 'Internal Server Error' }),
          { status: 500, headers: { 'Content-Type': 'application/rdap+json' } }
        );
      }

      // --- Timeout ----------------------------------------------------------
      // We simulate the timeout experience (error counted, ~10s latency recorded)
      // without actually blocking the pool for 10 s. A realistic p99 penalty is
      // added to latencies by the caller when it catches this error type.
      if (roll < ERROR_PROBS.rateLimitPct + ERROR_PROBS.serverErrorPct + ERROR_PROBS.timeoutPct) {
        metrics.errors.timeout++;
        await sleep(200); // brief delay to simulate handshake before timeout fires
        throw Object.assign(new Error('Request timed out after 10000ms'), { name: 'TimeoutError' });
      }

      // --- Normal response --------------------------------------------------
      metrics.cacheMissCount++;
      const latency = sampleLatency();
      await sleep(latency);

      // Determine RDAP object type from URL path
      let body;
      if (url.includes('/domain/')) {
        const domain = decodeURIComponent(url.split('/domain/').pop() ?? 'unknown.com');
        body = mockDomainResponse(domain);
      } else if (url.includes('/ip/')) {
        const ip = url.split('/ip/').pop() ?? '0.0.0.0';
        body = mockIPResponse(ip);
      } else if (url.includes('/autnum/')) {
        const asn = parseInt(url.split('/autnum/').pop() ?? '0', 10);
        body = mockASNResponse(asn);
      } else {
        body = mockDomainResponse('unknown.com');
      }

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/rdap+json' },
      });
    }

    // Fallback — should never reach real network during the test
    return _origFetch(urlInput, options);
  };
}

// ─── Virtual user sessions ────────────────────────────────────────────────────

async function runQuery(client, type, target, metrics) {
  const start = performance.now();
  metrics.totalQueries++;

  try {
    let result;
    if (type === 'domain') {
      result = await client.domain(target);
      metrics.queryTypes.domain++;
    } else if (type === 'ip') {
      result = await client.ip(target);
      metrics.queryTypes.ip++;
    } else {
      result = await client.asn(target);
      metrics.queryTypes.asn++;
    }

    const ms = performance.now() - start;
    metrics.successCount++;

    // Detect cache hit: response came back in < 8 ms (well below min server latency)
    if (ms < 8) {
      metrics.cacheHitCount++;
    }
    // Note: cacheMissCount incremented in the interceptor (only on real fetch calls)

    metrics.latencies.push(ms);
    return result;
  } catch (err) {
    const ms = performance.now() - start;
    const msg = err?.message ?? '';

    if (err?.statusCode === 429 || msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      // already counted in interceptor
    } else if (msg.toLowerCase().includes('timeout') || err?.name === 'TimeoutError') {
      // already counted in interceptor — push a synthetic 10 s latency so p99 reflects reality
      metrics.latencies.push(10_000);
    } else if (err?.statusCode >= 500) {
      // already counted in interceptor
    } else {
      metrics.errors.other++;
    }
  }
}

async function runBatchQuery(client, persona, metrics) {
  const sizes = BATCH_SIZE[persona];
  const size  = randInt(sizes[0], sizes[1]);
  metrics.batchCalls++;
  metrics.batchSizes.push(size);

  const start = performance.now();
  const requests = Array.from({ length: size }, () => {
    const roll = Math.random();
    if (roll < 0.50) return { type: 'domain', query: randomDomain(0.20) };
    if (roll < 0.80) return { type: 'ip',     query: randomIP() };
    return           { type: 'domain', query: randomDomain(0.10) };
  });

  metrics.totalQueries += size;

  try {
    const results = [];
    for await (const res of client.streamBatch(requests, { concurrency: 3 })) {
      results.push(res);
      if (res.success) {
        metrics.successCount++;
        metrics.queryTypes[res.result?.objectClass === 'ip network' ? 'ip' : 'domain']++;
      } else {
        metrics.errors.other++;
      }
    }
    const ms = performance.now() - start;
    metrics.latencies.push(ms / size); // per-item latency
  } catch {
    metrics.errors.other++;
  }
}

async function runUser(client, userId, metrics) {
  // Select persona
  const roll = Math.random();
  const persona = roll < 0.60 ? 'SOLO_DEV' : roll < 0.85 ? 'POWER' : 'API_INT';
  const cfg      = PERSONAS[persona];
  const typeDist = TYPE_DIST[persona];

  const numQueries = randInt(cfg.minQueries, cfg.maxQueries);

  // Maybe run one batch call this session
  const runBatch = Math.random() < BATCH_PROB[persona];
  if (runBatch) {
    await runBatchQuery(client, persona, metrics);
    await sleep(randInt(cfg.thinkMin, cfg.thinkMax));
  }

  // Individual queries
  for (let i = 0; i < numQueries; i++) {
    const qRoll = Math.random();
    let type, target;

    if (qRoll < typeDist[0]) {
      type   = 'domain';
      // SOLO_DEV reuses popular domains more (triggers cache hits)
      target = randomDomain(persona === 'SOLO_DEV' ? 0.50 : 0.20);
    } else if (qRoll < typeDist[0] + typeDist[1]) {
      type   = 'ip';
      target = randomIP();
    } else {
      type   = 'asn';
      target = randomASN();
    }

    await runQuery(client, type, target, metrics);
    await sleep(randInt(cfg.thinkMin, cfg.thinkMax));
  }

  metrics.usersComplete++;
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function runPool(taskFns, concurrency) {
  let index = 0;
  async function worker() {
    while (index < taskFns.length) {
      const fn = taskFns[index++];
      try { await fn(); } catch { /* individual failure never stops the pool */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, taskFns.length) }, worker));
}

// ─── Progress display ─────────────────────────────────────────────────────────

function startProgress(metrics, total) {
  const interval = setInterval(() => {
    const done = metrics.usersComplete;
    const pct  = Math.floor(done / total * 100);
    const bar  = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    const req  = metrics.totalQueries.toLocaleString();
    const avg  = metrics.latencies.length
      ? (metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length).toFixed(0)
      : '—';
    process.stdout.write(`\r  [${bar}] ${done}/${total} users | ${req} queries | avg ${avg}ms   `);
  }, 250);
  return () => { clearInterval(interval); process.stdout.write('\n'); };
}

// ─── Report generation ────────────────────────────────────────────────────────

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = p * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return +(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)).toFixed(1);
}

function buildReport(metrics, durationMs) {
  const lats   = [...metrics.latencies].sort((a, b) => a - b);
  const p50    = percentile(lats, 0.50);
  const p95    = percentile(lats, 0.95);
  const p99    = percentile(lats, 0.99);

  const totalMiss   = metrics.cacheMissCount;
  const totalHit    = metrics.cacheHitCount;
  const totalQueried = totalHit + totalMiss;
  const hitRate     = totalQueried ? (totalHit / totalQueried * 100).toFixed(1) : '0.0';
  const missRate    = totalQueried ? (totalMiss / totalQueried * 100).toFixed(1) : '0.0';

  const total        = metrics.totalQueries;
  const errors       = metrics.errors;
  const rlPct        = (errors.rateLimit   / total * 100).toFixed(2);
  const toPct        = (errors.timeout     / total * 100).toFixed(2);
  const svPct        = (errors.serverError / total * 100).toFixed(2);

  const qt           = metrics.queryTypes;
  const domainPct    = (qt.domain / total * 100).toFixed(1);
  const ipPct        = (qt.ip     / total * 100).toFixed(1);
  const asnPct       = (qt.asn    / total * 100).toFixed(1);

  const batchSizes   = metrics.batchSizes;
  const avgBatch     = batchSizes.length
    ? (batchSizes.reduce((a, b) => a + b, 0) / batchSizes.length).toFixed(1)
    : '0';
  const batchUsagePct = (metrics.batchCalls / TOTAL_USERS * 100).toFixed(1);

  const throughput   = (total / (durationMs / 1000)).toFixed(1);
  const successRate  = (metrics.successCount / total * 100).toFixed(1);

  // Decision flags (from POST_LAUNCH_ANALYSIS.md thresholds)
  const flags = [];
  if (parseFloat(hitRate)  < 70)  flags.push('⚠️  Cache hit rate < 70% → consider increasing TTL');
  if (parseFloat(p95)      > 200) flags.push('⚠️  p95 latency > 200ms → trace hot path');
  if (parseFloat(p99)      > 500) flags.push('🔥  p99 latency > 500ms → add timeout + fallback');
  if (parseFloat(rlPct)    > 2)   flags.push('🔥  Rate-limit errors > 2% → lower default concurrency');
  if (parseFloat(toPct)    > 1)   flags.push('⚠️  Timeout rate > 1% → increase timeout budget');
  if (parseFloat(batchUsagePct) < 10) flags.push('🟢  Batch usage < 10% → improve docs/CLI discoverability');

  const dateStr = new Date().toISOString().split('T')[0];

  return {
    p50, p95, p99,
    hitRate, missRate,
    rlPct, toPct, svPct,
    total, successRate, throughput,
    domainPct, ipPct, asnPct,
    avgBatch, batchUsagePct,
    flags,
    dateStr,
    durationSec: (durationMs / 1000).toFixed(1),
  };
}

function printConsoleReport(r, metrics) {
  const hr = '─'.repeat(60);
  console.log(`\n${hr}`);
  console.log('  RDAPify Load Test — Results');
  console.log(`  ${TOTAL_USERS} users · ${CONCURRENCY} concurrent · ${r.durationSec}s · ${r.throughput} req/s`);
  console.log(hr);

  console.log('\n  PERFORMANCE');
  console.log(`    p50 latency : ${r.p50} ms`);
  console.log(`    p95 latency : ${r.p95} ms`);
  console.log(`    p99 latency : ${r.p99} ms`);

  console.log('\n  CACHE');
  console.log(`    hit rate    : ${r.hitRate}%`);
  console.log(`    miss rate   : ${r.missRate}%`);

  console.log('\n  ERRORS');
  console.log(`    rate-limit  : ${r.rlPct}%  (${metrics.errors.rateLimit} req)`);
  console.log(`    timeout     : ${r.toPct}%  (${metrics.errors.timeout} req)`);
  console.log(`    server err  : ${r.svPct}%  (${metrics.errors.serverError} req)`);

  console.log('\n  USAGE');
  console.log(`    total       : ${r.total.toLocaleString()} queries   (success rate ${r.successRate}%)`);
  console.log(`    domain      : ${r.domainPct}%`);
  console.log(`    ip          : ${r.ipPct}%`);
  console.log(`    asn         : ${r.asnPct}%`);
  console.log(`    batch usage : ${r.batchUsagePct}% of sessions used batch  (avg size ${r.avgBatch})`);

  if (r.flags.length) {
    console.log('\n  DECISION FLAGS (vs. POST_LAUNCH_ANALYSIS.md thresholds)');
    r.flags.forEach(f => console.log(`    ${f}`));
  } else {
    console.log('\n  ✅ All metrics within thresholds');
  }
  console.log(`\n${hr}\n`);
}

function buildMarkdownReport(r, metrics) {
  const observations = r.flags.length
    ? r.flags.map(f => `- ${f}`).join('\n')
    : '- All metrics within defined thresholds — no action required this week';

  const decisions = r.flags.map(f => {
    if (f.includes('cache hit'))    return '| Cache hit rate low | TTL too low | Increase default TTL | 🔥 |';
    if (f.includes('p95'))          return '| p95 latency high | Slow registry path | Trace + optimize hot path | ⚠️ |';
    if (f.includes('p99'))          return '| p99 latency critical | No timeout fallback | Add server-level timeout | 🔥 |';
    if (f.includes('Rate-limit'))   return '| 429 errors high | Default concurrency too high | Lower concurrency default | 🔥 |';
    if (f.includes('Timeout'))      return '| Timeout rate elevated | Timeout budget low | Increase timeout budget | ⚠️ |';
    if (f.includes('Batch'))        return '| Batch usage low | Users unaware | Improve docs + CLI help | 🟢 |';
    return '';
  }).filter(Boolean).join('\n') || '| No issues detected | — | — | — |';

  return `# Weekly Analysis Report — Load Test Simulation

> **Period:** ${r.dateStr} (load test run)
> **Analyst:** automated (benchmarks/load-test/index.js)
> **Users simulated:** ${TOTAL_USERS} | **Concurrency:** ${CONCURRENCY} | **Duration:** ${r.durationSec}s
> **Status:** Generated ✅

---

## 1. Performance

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| p50 latency | ${r.p50} ms | < 100ms | ${parseFloat(r.p50) < 100 ? '✅' : '⚠️'} |
| p95 latency | ${r.p95} ms | < 200ms | ${parseFloat(r.p95) < 200 ? '✅' : '⚠️'} |
| p99 latency | ${r.p99} ms | < 500ms | ${parseFloat(r.p99) < 500 ? '✅' : '🔥'} |
| Throughput   | ${r.throughput} req/s | — | — |

**Notes:**
Latency simulated from realistic registry distribution (30–800ms range, weighted).

---

## 2. Cache

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Hit rate  | ${r.hitRate}% | > 70% | ${parseFloat(r.hitRate) > 70 ? '✅' : '⚠️'} |
| Miss rate | ${r.missRate}% | < 30% | ${parseFloat(r.missRate) < 30 ? '✅' : '⚠️'} |

**Notes:**
Cache hits detected by response time < 8ms (in-memory cache path). Miss = fetch reached mock server.

---

## 3. Errors

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Rate limit (429) | ${r.rlPct}% | < 2% | ${parseFloat(r.rlPct) < 2 ? '✅' : '🔥'} |
| Timeout | ${r.toPct}% | < 1% | ${parseFloat(r.toPct) < 1 ? '✅' : '⚠️'} |
| Server error (5xx) | ${r.svPct}% | < 0.5% | ${parseFloat(r.svPct) < 0.5 ? '✅' : '⚠️'} |

---

## 4. Usage

| Metric | Value |
|--------|-------|
| Total queries | ${r.total.toLocaleString()} |
| Success rate | ${r.successRate}% |
| Domain queries | ${r.domainPct}% |
| IP queries | ${r.ipPct}% |
| ASN queries | ${r.asnPct}% |
| Avg batch size | ${r.avgBatch} items |
| Batch usage | ${r.batchUsagePct}% of sessions |

---

## 5. Observations

${observations}

---

## 6. Pattern Classification

| Observation | Category | Severity |
|-------------|----------|----------|
${r.flags.length
  ? r.flags.map(f => {
      if (f.includes('cache'))    return '| Cache hit rate below threshold | Load issue | Medium |';
      if (f.includes('p95'))      return '| p95 latency elevated | Performance issue | Medium |';
      if (f.includes('p99'))      return '| p99 latency critical | Performance issue | High |';
      if (f.includes('Rate-limit')) return '| Rate-limit errors elevated | Load issue | High |';
      if (f.includes('Timeout'))  return '| Timeout rate elevated | Reliability issue | Medium |';
      if (f.includes('Batch'))    return '| Batch feature underused | UX issue | Low |';
      return '';
    }).filter(Boolean).join('\n')
  : '| No patterns detected | — | — |'}

---

## 7. Decision Matrix

| Problem | Root Cause | Action | Priority |
|---------|-----------|--------|----------|
${decisions}

---

## 8. Roadmap Impact

${r.flags.length
  ? '- [ ] Pattern detected — monitor next week before adding to ROADMAP.md'
  : '- [x] No roadmap change needed — all metrics within thresholds'}

---

## 9. Next Week Focus

1. Re-run load test after any config changes
2. Watch cache hit rate trend (target: > 70%)
3. Monitor 429 rate under real production concurrency

---

_Generated by \`benchmarks/load-test/index.js\` · ${new Date().toISOString()}_
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Verify build exists
  const distPath = path.join(__dirname, '../../dist/cjs/index.js');
  if (!fs.existsSync(distPath)) {
    console.error('\n  ❌  Build not found. Run: npm run build\n');
    process.exit(1);
  }

  console.log('\n  ╔══════════════════════════════════════════════════╗');
  console.log('  ║   RDAPify Load Test — 1000 Virtual Users        ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log(`\n  Users: ${TOTAL_USERS}  |  Concurrency: ${CONCURRENCY}  |  3 Personas\n`);

  // Initialise metrics store
  const metrics = createMetrics();

  // Install fetch interceptor BEFORE requiring rdapify
  installInterceptor(metrics);

  // Now safe to import rdapify (fetch is already patched)
  const { RDAPClient } = require(distPath);

  // Shared client — simulates a singleton application instance
  const client = new RDAPClient({
    ssrfProtection: false,           // needed so mock.test URLs pass validation
    cache: { strategy: 'memory', ttl: 300 },
    retry: { maxAttempts: 1 },       // no retries — surface errors cleanly
    timeout: 10_000,
  });

  // Build the task list
  const tasks = Array.from({ length: TOTAL_USERS }, (_, i) =>
    () => runUser(client, i, metrics)
  );

  // Start progress display
  const stopProgress = startProgress(metrics, TOTAL_USERS);
  const wallStart = performance.now();

  // Run all users through the concurrency pool
  await runPool(tasks, CONCURRENCY);

  const wallMs = performance.now() - wallStart;
  stopProgress();

  // Generate and display report
  const report = buildReport(metrics, wallMs);
  printConsoleReport(report, metrics);

  // Save markdown report
  const resultsDir = path.join(__dirname, '../results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const timestamp   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportFile  = path.join(resultsDir, `load-test-${timestamp}.md`);
  fs.writeFileSync(reportFile, buildMarkdownReport(report, metrics), 'utf8');
  console.log(`  Report saved → benchmarks/results/load-test-${timestamp}.md\n`);
}

main().catch(err => {
  console.error('\n  ❌ Load test failed:', err.message);
  process.exit(1);
});
