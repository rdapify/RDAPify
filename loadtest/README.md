# Stage E — Load Testing & SLO Validation

> Validate p50/p95/p99 latency, error rate, retry behaviour, circuit breaker
> effectiveness and cache efficiency under real-world conditions.

This directory ships **two** ways to run the same scenarios:

| Path | What it does | When to use |
|------|--------------|-------------|
| **harness** | A Rust binary that drives the `rdapify` library directly against an in-process mock upstream. Deterministic, reproducible, runs anywhere `cargo` does. | CI smoke tests, local verification, regression detection. |
| **k6** | k6 scripts that drive `rdap-service` over HTTP. Exercises the full stack including axum middleware. | Pre-release validation, lab/staging, production-faithful spike tests. |

---

## Layout

```
loadtest/
├── README.md                    # this file
├── mock-upstream/               # standalone Cargo project — deterministic RDAP server
│   ├── Cargo.toml
│   └── src/main.rs              # axum binary with --latency-ms / --failure-rate / --rate-limit-rate
├── harness/                     # standalone Cargo project — in-process load driver
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs              # CLI: harness e1 | e3
│       ├── scenarios/{e1,e3}.rs # one scenario per file
│       ├── stats.rs             # HdrHistogram-backed p50/p95/p99
│       └── slo.rs               # threshold validation
├── k6/
│   ├── e1_baseline.js           # E1 — 1000 rps × 10 s, same domain (cache warm)
│   └── e3_burst.js              # E3 — 0 → 2000 rps in < 1 s, unique domains
├── reports/                     # captured run output (`loadtest/reports/`)
└── run.sh                       # orchestrator: build / harness / k6
```

The `mock-upstream` and `harness` Cargo projects sit **outside** the
engine's workspace (`Cargo.toml` `exclude` list) so they don't slow down
`cargo test --workspace`. Each has its own `Cargo.lock`.

---

## Quick start

```bash
# Build mock + harness once.
loadtest/run.sh build

# Run E1 (cache warm) and E3 (burst) via the in-process harness.
loadtest/run.sh harness e1
loadtest/run.sh harness e3

# To run the production-faithful k6 path, first start rdap-service
# pointed at the mock, then:
loadtest/run.sh k6 e1
loadtest/run.sh k6 e3
```

Knobs (env vars):

| Variable | Default | What |
|----------|---------|------|
| `MOCK_PORT` | `18080` | Port the mock listens on (harness reads same value) |
| `MOCK_LATENCY_MS` | `5` | Fixed delay applied by the mock to successful responses |
| `MOCK_FAILURE_RATE` | `0.0` | Fraction of mock responses that 500 (E4) |
| `MOCK_RATE_LIMIT_RATE` | `0.0` | Fraction of mock responses that 429 with `Retry-After` (E5) |
| `TARGET` | `http://127.0.0.1:8080` | k6 target — `rdap-service` URL |
| `DOMAIN` | `example.com` | E1 cache-warm domain |

---

## Scenarios

| ID | Description | k6 script | Harness sub-command | Status |
|----|-------------|-----------|---------------------|--------|
| **E1** | Baseline (cache warm) | `k6/e1_baseline.js` | `harness e1` | ✅ shipped |
| **E2** | Cold cache, 1 000 unique, 200 concurrent | `k6/e2_cold_cache.js` | `harness e2` | ✅ shipped |
| **E3** | Burst: 0 → 2 000 rps in < 1 s | `k6/e3_burst.js` | `harness e3` | ✅ shipped |
| **E4** | Upstream failure (50 % 500s) | `k6/e4_upstream_failure.js` | `harness e4` | ✅ shipped |
| **E5** | Rate limiting (429 + Retry-After) | `k6/e5_rate_limit.js` | `harness e5` | ✅ shipped |
| **E6** | Adversarial input (high cardinality) | `k6/e6_adversarial.js` | `harness e6` | ✅ shipped |

All six scenarios are wired into `loadtest/run.sh` — invoke with
`loadtest/run.sh harness <eN>` or `loadtest/run.sh k6 <eN>`. The
`STAGE_E_SLO_REPORT.md` in `reports/` captures the verdict for each.

---

All-scenario summary (verdicts and headline numbers from
`reports/STAGE_E_SLO_REPORT.md`):

| Scenario | Verdict | Headline |
|---|---|---|
| **E1** baseline cache warm | ✅ PASS | p95 0.01 ms; 99.99 % hit rate |
| **E2** cold cache / fan-out | ✅ PASS | p95 12.25 ms; **fan-out factor 1.00×** (perfect single-flight) |
| **E3** burst 0 → 2 000 rps in 1 s | ✅ PASS | p95 7.05 ms; tight queue spread |
| **E4** 50 % upstream failure | ✅ PASS | p95 128.83 ms; retry amplification 1.72× |
| **E5** 100 % 429 with Retry-After: 2 s | ✅ PASS | p50 = 4 003 ms = 2 × Retry-After |
| **E6** 50 000 unique domains | ✅ PASS | p95 48.67 ms; **RSS Δ 47 MiB** (bounded by cache cap, not input) |

See `reports/STAGE_E_SLO_REPORT.md` for the per-scenario tables and
methodology notes.

---

## What's measured

The harness captures from two surfaces:

1. **Wall-clock latency** (HdrHistogram in-process). This is what the
   user perceives. Used for the `p50 / p95 / p99 / max / mean` lines in
   the report.
2. **Engine metrics** (Prometheus text format from `rdap-metrics`).
   Counters for cache hits/misses, errors by class, retries, breaker
   open events, inflight gauge. Printed below the latency report.

The k6 path additionally exposes k6's native trends (`http_req_duration`,
`http_req_failed`) and writes a JSON summary to
`reports/e{1,3}_summary.json`.

---

## Pass criteria (Stage E spec)

The system passes overall if **every** scenario passes its own
thresholds **and** the global rules hold:

- p95 < 300 ms under normal load — covered by E1 and E3 thresholds.
- error_rate < 1 % — every scenario.
- no unbounded memory growth — covered by the bounded breaker registry
  (1024-cap moka LRU) and the bounded in-flight refresh map (4096 cap)
  shipped in Stages B/C. The harness runs to completion which is
  itself a proof of "no unbounded growth on this workload"; long-soak
  scenarios are E6's job.
- no retry storms — verified by inspecting `rdap_retry_total` after
  the run; ratio of retries to requests should stay below the
  per-error-class retry caps (`retry_limit()` in `rdap-core::fetcher`).
- no circuit flapping — verified by inspecting
  `rdap_circuit_breaker_open_total{origin}`; counts should be a small
  integer, not a per-request increment.

The harness binary exits non-zero if any threshold is breached, so it
plugs directly into CI.

---

## Bottlenecks observed

E1 and E3 against the mock surface no engine-level bottleneck: the
fast path through the cache is essentially free (sub-ms p99) and the
burst path is dominated by the simulated upstream latency. **The
engine itself contributes ~1–3 ms of overhead per cache miss**, which
is well below every Stage E target.

In a real lab two additional bottlenecks become visible that this
in-process harness cannot show:

- **HTTP/middleware overhead in `rdap-service`** — the axum stack, JSON
  body parsing, gzip layer, request-id stamping, tracing middleware.
  E1 over k6 against `rdap-service` typically shows p95 in the 5–15 ms
  range on a warm cache.
- **TLS handshake cost** when the upstream is real — the engine
  amortises this via `pool_max_idle_per_host=10` keep-alive, but a
  cold pool on a fresh deploy will see one ~50 ms hit per origin
  before the connection cache fills.

E2 (cold cache, real upstream) and E4 (upstream failure) are the
scenarios that exercise both. They're scheduled for the next pass.

---

## Pre-flight checks for `k6` runs

Before running `loadtest/run.sh k6 …`:

1. `rdap-service` is running on `$TARGET` (default `127.0.0.1:8080`).
2. `mock-upstream` is running, and `rdap-service`'s
   `custom_bootstrap_servers` config maps `example` → `http://127.0.0.1:18080`
   (or whatever you set `MOCK_PORT` to).
3. `k6` is installed (`k6 --version`).
4. `curl` is available (used by `run.sh` for readiness probes).

The orchestrator validates these and exits with a clear error if any
check fails.

---

## Reproducing on a fresh checkout

```bash
git clone <rdapify-rust>
cd rdapify-rust
loadtest/run.sh build
loadtest/run.sh harness e1
loadtest/run.sh harness e3
ls loadtest/reports/
```

Total wall time on a 4-core dev box: **~ 12 s** (10 s for E1 + 1 s burst
window + ~1 s setup/teardown).
