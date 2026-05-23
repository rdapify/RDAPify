# RDAPify Performance Specification (TypeScript)

> **Scope:** This file covers the TypeScript package (`rdapify` on npm).
> **Canonical engine spec:** [`rdapify-rust/docs/PERFORMANCE_SPEC.md`](../../../rdapify-rust/docs/PERFORMANCE_SPEC.md) — Rust is the reference implementation; the Node bindings (`rdapify-nd`) inherit its targets.
> **Updated:** 2026-05-01

## 1. Purpose

This document defines the performance targets and performance budget for the
TypeScript distribution of RDAPify.

It establishes:

- Expected response times
- Cache performance targets
- Resource usage limits
- Concurrency targets
- Benchmark methodology
- Performance metrics to collect

This document is used to ensure RDAPify remains fast, efficient, and production-ready.

---

## 2. RDAP Query Latency Targets

| Query Type                          | Target Latency |
| ----------------------------------- | -------------- |
| Cold RDAP query                     | 200–350 ms     |
| Warm RDAP query (connection reused) | 80–150 ms      |
| SQLite cache hit                    | 3–10 ms        |
| Memory cache hit                    | 1–5 ms         |
| Bootstrap lookup                    | < 1 ms         |

Definitions:

- **Cold query** — new TCP connection, no cache, full DNS + TLS + HTTP round-trip to RDAP server.
- **Warm query** — connection reused (keep-alive), no cache, skips TCP/TLS overhead.
- **Cached query** — served entirely from memory cache or SQLite; no network I/O.

---

## 3. Percentile Performance Targets

Averages mask tail latency. Percentile targets define acceptable worst-case behavior under real-world load.

| Percentile | Target   |
| ---------- | -------- |
| P50        | < 50 ms  |
| P90        | < 120 ms |
| P95        | < 150 ms |
| P99        | < 250 ms |

P99 latency matters because in batch workloads, the slowest 1% of queries determine overall wall-clock time. A system with a good average but a bad P99 will feel slow in production.

---

## 4. Cache Performance Targets

RDAPify's effective latency depends heavily on cache efficiency. The following targets must be met in typical production workloads:

| Metric                 | Target |
| ---------------------- | ------ |
| Total cache hit ratio  | > 85%  |
| Memory cache hit ratio | > 60%  |
| Bootstrap cache hit    | > 99%  |
| Negative cache hit     | > 90%  |

- **Bootstrap cache** must be effectively 100% after first initialization — bootstrap data changes rarely.
- **Negative cache** (caching NXDOMAIN / not-found results) prevents redundant network queries for invalid inputs.
- If total cache hit ratio drops below 85%, cache TTL configuration or cache sizing should be reviewed.

---

## 5. Batch Performance Targets

Batch performance assumes concurrency (parallel inflight requests) and warm caches. Targets reflect wall-clock time from batch start to final result.

| Batch Size  | Target Time |
| ----------- | ----------- |
| 10 domains  | < 1 sec     |
| 50 domains  | < 3 sec     |
| 100 domains | < 5–8 sec   |
| 500 domains | < 30 sec    |

These targets assume:

- Default concurrency limit applied
- Mixed cache/network split (not all cold)
- No rate-limiting from RDAP servers

---

## 6. Resource Usage Targets

| Resource          | Target             |
| ----------------- | ------------------ |
| Idle RAM          | < 30 MB (Node)     |
| RAM under load    | < 150 MB           |
| CPU usage         | Low (I/O bound)    |
| Bundle size (ESM) | ≤ 600 KB           |
| Bundle size (CJS) | ≤ 600 KB           |
| Tree-shakeable    | Yes (`"sideEffects": false`) |
| Docker image size | ≤ 50 MB            |
| SQLite database   | < 2 GB recommended |

RDAPify is I/O bound, not CPU bound. CPU usage should remain low even under concurrency. Memory growth under load is expected but must not exceed 150 MB for typical workloads. SQLite databases approaching 2 GB should trigger a cache eviction or pruning review.

For native-engine size targets (Rust binary, WASM core, distroless Docker),
see the canonical [Rust performance spec](../../../rdapify-rust/docs/PERFORMANCE_SPEC.md#2-binary-size-targets).

---

## 7. Concurrency Targets

| Metric             | Target        |
| ------------------ | ------------- |
| Concurrent queries | 100+          |
| Batch processing   | 1,000 domains |
| Monitoring domains | 10,000+       |
| Webhook queue      | 10,000 events |

These are steady-state targets, not burst peaks. The concurrency model must not degrade P95 latency beyond 150 ms when 100 queries are inflight simultaneously.

---

## 8. Performance Budget (Latency Breakdown)

The following table breaks down where latency is spent in a cold RDAP query. Most time is consumed by network operations outside RDAPify's control.

| Component              | Budget      |
| ---------------------- | ----------- |
| Bootstrap lookup       | < 1 ms      |
| Memory cache check     | 1–5 ms      |
| SQLite cache check     | 3–10 ms     |
| DNS lookup             | 20–40 ms    |
| TCP connect            | 20–50 ms    |
| TLS handshake          | 30–80 ms    |
| HTTP request           | 50–150 ms   |
| RDAP server processing | 50–200 ms   |
| JSON parsing           | 1–5 ms      |
| **Total (cold)**       | **200–350 ms** |

Code-level optimizations (parsing, lookup, serialization) have limited impact on total latency. The primary levers are: cache hit ratio, connection reuse, and concurrency.

---

## 9. Benchmark Methodology

### Benchmark Suite

The following benchmarks must be implemented and maintained:

| Benchmark        | Description                                      |
| ---------------- | ------------------------------------------------ |
| `cold_query`     | Single domain query, fresh connection, no cache  |
| `warm_query`     | Single domain query, connection reused, no cache |
| `memory_cache`   | Single domain query served from memory cache     |
| `sqlite_cache`   | Single domain query served from SQLite cache     |
| `batch_100`      | Batch of 100 domains, mixed cache/network        |
| `bootstrap_lookup` | Bootstrap TLD-to-server resolution only        |

### Tooling

- **Rust**: `criterion.rs` for microbenchmarks (`benches/`)
- **TypeScript**: custom harness with `performance.now()` and percentile calculation

### Benchmark Requirements

- Run against **real RDAP servers** — synthetic or mocked benchmarks do not reflect production behavior
- Local cache enabled during cache benchmarks; disabled for cold/warm benchmarks
- Measure and report **P50, P95, P99** — not just mean
- Benchmarks must be reproducible in CI with stable results (< 10% variance between runs)
- Document the network environment when publishing results (latency to RDAP server matters)

---

## 10. Metrics and Observability

RDAPify must record the following metrics at runtime. Logs must be structured (JSON format).

| Metric                | Description                             |
| --------------------- | --------------------------------------- |
| `rdap_query_time`     | Total query latency (ms), end-to-end    |
| `cache_hit`           | Boolean — whether cache was used        |
| `cache_type`          | `memory` / `sqlite` / `network`         |
| `rdap_server`         | RDAP server hostname that responded     |
| `response_size`       | Response body size in bytes             |
| `batch_duration`      | Wall-clock time for full batch (ms)     |
| `webhook_retry_count` | Number of webhook delivery retries      |
| `db_size`             | SQLite database size in bytes           |

All metric values must be emitted as structured log entries. Example:

```json
{
  "event": "rdap_query",
  "rdap_query_time": 143,
  "cache_hit": false,
  "cache_type": "network",
  "rdap_server": "rdap.verisign.com",
  "response_size": 2048
}
```

---

## 11. Performance Goals Summary

```
RDAPify Performance Targets:

Cold query:      200–350 ms
Warm query:      80–150 ms
Memory cache:    1–5 ms
SQLite cache:    3–10 ms

P50 latency:     < 50 ms
P95 latency:     < 150 ms
P99 latency:     < 250 ms

Cache hit ratio: > 85%
```

---

## 12. Performance Is a Feature

Performance is a core feature of RDAPify.
All new features must be designed with performance impact in mind and must not violate the performance budget defined in this document.
