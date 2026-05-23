# RDAPify — Performance Notes

> What latency to expect, how the engine scales, and what the bottlenecks
> are. Numbers come from the Stage E load-test harness in `loadtest/`,
> reproducible on a 4-core developer box. See
> [`loadtest/reports/STAGE_E_SLO_REPORT.md`](../loadtest/reports/STAGE_E_SLO_REPORT.md)
> for the raw runs.

---

## Latency expectations

Measured against a **deterministic in-process mock** so the numbers
isolate engine overhead from upstream variability. Real RDAP registries
add 30–500 ms of network and DNS time on top.

### Cache-warm path (E1)

| SLI | Target | Measured |
|---|---|---|
| p50 | < 10 ms | **0.00 ms** |
| p95 | < 50 ms | **0.01 ms** |
| p99 | < 100 ms | **0.01 ms** |

Cache hits are essentially free — one `DashMap` read plus a
`serde_json::Value::clone()`. At 1 000 req/s sustained, all 10 000
hits land in a single histogram bucket.

### Cold cache, 200 concurrent fan-out (E2)

| SLI | Target | Measured |
|---|---|---|
| p50 | ≤ 100 ms | **11.51 ms** (= 10 ms upstream + 1.5 ms engine) |
| p95 | ≤ 300 ms | **12.25 ms** |
| **upstream calls** | ≈ unique domains | **1 000 / 1 000** (1.00× fan-out) |

The single-flight collapse is **arithmetically perfect**: 200 × 1 000 =
200 000 client operations produce exactly 1 000 upstream calls — one per
unique domain, with 199 followers waking up from the leader's `Notify`.

### Burst (E3) — 0 → 2 000 rps in 1 s

| SLI | Target | Measured |
|---|---|---|
| p50 | ≤ 50 ms | **6.09 ms** |
| p95 | ≤ 300 ms | **7.05 ms** |
| p99 | ≤ 1 000 ms | **7.89 ms** |

Tight p50 → p99 spread (1.8 ms) — the upstream-concurrency semaphore
queues internally instead of stampeding the upstream.

### Engine overhead per call (above mock latency)

| Path | Overhead |
|---|---|
| Cache hit | ~ 0 ms |
| Cache miss + single-flight follower | ~ 1.5 ms |
| Cache miss + leader (single fetch) | ~ 1.1 ms |
| 50 000 unique domains @ 256 concurrent (E6) | ~ 26 ms p50 |

The E6 number is the upper bound observed. It's dominated by tokio
scheduler effects and `DashMap` contention at very high parallelism —
not by any engine-level bottleneck.

---

## Scaling notes

### Concurrency: bounded, not adaptive

The engine ships a **process-wide upstream-concurrency semaphore**
(default 256 permits). Permits are acquired per HTTP attempt and
released as soon as the attempt completes — backoff sleeps do **not**
hold a permit. Under spike load, requests queue inside the engine
instead of stampeding the upstream.

**This is static**, not adaptive. Operators tune it at construction
via [`FetcherConfig::concurrency_limit`]. See
[KNOWN_LIMITS.md](./KNOWN_LIMITS.md) for the rationale.

### Cache: bounded LRU-ish eviction

The in-memory cache is a `DashMap<String, Entry>` with a
configurable cap (default 1 000 entries). When the cap is hit, the
oldest entry by `inserted_at` is evicted. Memory is bounded by the
**working set**, not by the input cardinality — Stage E E6 confirmed
this: 50 000 unique-domain queries grew RSS by 47 MiB (≈ 1 KiB ×
active entries), not by 50 MiB+ proportional to input.

### Circuit-breaker registry: bounded LRU

Per-origin breakers live in a `moka::sync::Cache` with capacity
1 024 origins and a 10-minute idle TTL. Even an attacker producing
1 000 000 distinct origins keeps the registry under ~ 1 MiB —
verified by `rdap-core::circuit_breaker::tests::registry_caps_at_capacity_under_million_keys`.

### Single-flight: mandatory under fan-out

Concurrent identical queries deduplicate via `try_acquire_refresh`.
Only one upstream call is made per `(query_type, normalised_input)`
even with 200 concurrent waiters — the followers park on a `Notify`
and read from the cache after the leader populates it.

This is the most consequential optimisation in the engine: without
it, a 200-concurrent fan-out across 1 000 domains would produce
200 000 upstream calls instead of the observed 1 000.

---

## Configuration tuning

Defaults are production-safe (Stage F · F1) and capped by the
validator (Stage F · F2). The full table:

| Field | Default | Validator bound | Notes |
|---|---|---|---|
| `timeout` | 5 s | ≤ 30 s | Tightened from 10 s pre-1.0 |
| `max_attempts` | 3 | 1–10 | 0 rejected (no upstream call) |
| `concurrency_limit` | 256 | 1–4 096 | File-descriptor exhaustion above ceiling |
| `slow_request_threshold` | 500 ms | > 0 | Counter-only; no per-request log |
| `trace_sample_rate` | 0.0 | [0.0, 1.0] | NaN / inf rejected |
| `initial_backoff` | 500 ms | ≤ `max_backoff` | Retry full-jitter base |
| `max_backoff` | 8 s | — | Retry full-jitter cap |
| `cache.max_entries` | 1 000 | bounded by config | Working-set cap |
| `breaker.failure_threshold` | 5 | — | Consecutive-failure trigger |
| `breaker.cooldown` | 30 s | — | Open → HalfOpen wait |
| `breaker.registry_capacity` | 1 024 | — | Per-origin LRU cap |
| `breaker.registry_ttl` | 10 min | — | Idle-eviction window |

Unsafe values are rejected at construction:

```rust
use rdapify::{ClientConfig, FetcherConfig, RdapClient};
use std::time::Duration;

let cfg = ClientConfig {
    fetcher: FetcherConfig {
        timeout: Duration::ZERO,    // ← rejected by FetcherConfig::validate
        ..Default::default()
    },
    ..Default::default()
};

assert!(RdapClient::with_config(cfg).is_err());
```

---

## Throughput observed (in-process)

| Workload | Throughput |
|---|---|
| E1 cache-warm at 1 000 rps | sustained 1 000 rps with 0.01 ms p95 |
| E2 200-fanout × 1 000 unique | 200 000 client ops / ~ 11.5 s ≈ 17 400 ops/s |
| E3 burst 0 → 2 000 rps | sustained 2 000 rps within the burst window |
| E6 50 000 unique @ 256 concurrent | 50 000 ops / ~ 27 s ≈ 1 850 ops/s (cache-miss bound) |

**These are in-process numbers** — the upstream is a loopback HTTP
mock with 0–10 ms artificial latency. Real upstream RTT is the
dominant term in production; these throughputs translate to
production as a *floor*, not a target.

---

## Memory footprint

| Scenario | RSS delta |
|---|---|
| Idle client | ~ 7 MiB |
| 50 000 unique-domain stress (E6) | + 47 MiB |
| 1 000 000 unique-origin breaker stress (unit test) | < 4 MiB |

The engine's resident memory is dominated by:
- The default 1 000-entry response cache (~ 1 KiB × entries)
- The 1 024-cap breaker registry (~ 100 bytes × origins)
- Reqwest's connection pool (10 idle connections × ~ 32 KiB each)

Beyond that, growth is proportional to the **working set**, not to
total request volume.

---

## Observability overhead

With `metrics` feature **off** (the default):

- No `metrics` / `metrics-exporter-prometheus` crates linked at all
  (verified via `cargo tree --no-default-features`).
- Every hook call site is an `#[inline(always)]` no-op stub; LTO
  elides them entirely.
- One `bool` short-circuit per query for the tracing sample decision.
- Zero heap allocations from observability code.

With `metrics` feature **on**:

- Prometheus recorder + exporter linked.
- Counters / gauges / histograms emit on every hook call.
- Tracing spans created when the per-call sampling decision is
  positive; otherwise `Span::none()` and the `record()` calls are
  no-ops.
- Per-sampled-call cost: one `String` for the redacted origin,
  plus one `String` for the UUID v7 `request_id` on the parent
  `rdap.query` span.

See [SLO.md](./SLO.md) for the formal latency / availability targets
and PromQL queries.

---

## Reproducing the numbers

```bash
loadtest/run.sh build
loadtest/run.sh harness e1     # E1 — cache warm
loadtest/run.sh harness e2     # E2 — single-flight verification
loadtest/run.sh harness e3     # E3 — burst
loadtest/run.sh harness e4     # E4 — upstream failure
loadtest/run.sh harness e5     # E5 — Retry-After honouring
loadtest/run.sh harness e6     # E6 — adversarial cardinality
```

Total wall time across all six: ~ 50 s. Each run writes its full
report to `loadtest/reports/eN_harness_run.txt`.
