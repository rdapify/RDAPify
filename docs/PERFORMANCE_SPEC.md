# RDAPify Performance Specification

> **Version:** 0.3.x pre-1.0 · **Updated:** 2026-05-01
> **Status:** Normative — CI must not regress below these targets.

This document defines the performance requirements for RDAPify before v1.0.
All targets apply to the Rust workspace (`rdapify-rust`).

The numbers below were tightened on 2026-05-01 based on what is already
achieved in `docs/PERFORMANCE.md` and what is competitive in the Rust
ecosystem (ripgrep, bat). Loose ceilings have been replaced with hard
gates so CI catches regressions early.

For deployment-mode tradeoffs (embedded · sidecar · container · WASM)
see [ISOLATION_MODES.md](ISOLATION_MODES.md). Latency targets in §1 below
are baseline — sidecar/container modes add +1–3 ms RTT; WASM adds 2–5× CPU.

---

## 1. Latency Targets

### 1.1 Engine Overhead (no network — the fair benchmark)

The library's own code path, measured against an in-process mock.
Network latency is upstream-bound and not the engine's responsibility.

| Percentile | Target  | Rationale                                  |
|------------|---------|--------------------------------------------|
| P50        | < 100 µs | Cache-miss code path, no network          |
| P99        | **< 1 ms** | Hard regression gate — engine overhead   |

### 1.2 End-to-end Query Latency (real RDAP servers, 1 Gbps link)

| Percentile | Target    | Rationale                              |
|------------|-----------|----------------------------------------|
| P50        | < 50 ms   | Typical registrar RDAP response        |
| P95        | < 150 ms  | Accounts for slow registrars           |
| P99        | < 250 ms  | Allows for one retry                   |
| Cold query | 200–350 ms| First request, no bootstrap cache      |
| Warm query | 80–150 ms | Subsequent requests, bootstrap cached  |

"Cold" = first query after process start (bootstrap must be fetched from IANA).
"Warm" = bootstrap cache populated, TCP connection may or may not be reused.

### 1.3 Cache Latency (in-process, no network)

| Cache type    | Target          | Measurement                       |
|---------------|-----------------|-----------------------------------|
| Memory cache p99 | **< 50 µs**  | DashMap lookup — regression gate  |
| Memory cache typical | 1–5 µs   | DashMap lookup, no deserialization|
| SQLite cache  | 3–10 ms         | Local disk, no network            |

### 1.4 Cache-warm Throughput

| Metric | Target |
|--------|--------|
| Sustained rps per core (cache-warm) | **≥ 5,000 rps** |

> **Note:** Benchmark suite measures code-path overhead only (mockito).
> Add your measured network latency on top of these numbers for real estimates.

---

## 2. Binary Size Targets

Measured on the `rdap-cli` binary after `cargo build --release` (stripped, LTO).

| Build profile                       | Target      |
|-------------------------------------|-------------|
| Core only (`--no-default-features`) | **≤ 3 MB**  |
| Default features                    | **≤ 4 MB**  |
| Core + CLI binary                   | **≤ 5 MB**  |
| Core + service                      | **≤ 6 MB**  |
| Full (`--features full`)            | **≤ 8 MB**  |
| Docker image (distroless + static)  | **≤ 15 MB** |
| WASM core (future)                  | **≤ 400 KB** gzipped |

Build flags applied:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
panic = "abort"
```

These tighter ceilings force feature-flag discipline: `pro-monitoring`,
`pro-history`, `pro-analytics` and similar must not be in default features,
and the CLI must not pull in every crate without an explicit `--features`.

---

## 3. Memory Usage Targets

| Scenario              | Max RSS   | Measurement tool                                |
|-----------------------|-----------|-------------------------------------------------|
| Idle (library loaded) | **≤ 5 MiB** | `valgrind --tool=massif` or `/usr/bin/time -v` |
| Single query          | < 20 MB   | Peak during response parsing                    |
| Batch (100 domains)   | < 100 MB  | Peak during concurrent queries                  |
| Service (10 rps)      | < 150 MB  | Steady-state under sustained load               |

---

## 4. Startup Time Target

| Binary           | Target         | Measurement                |
|------------------|----------------|----------------------------|
| `rdapify --help` | **< 30 ms**    | `time ./rdapify --help`    |

Tightened from < 100 ms — ripgrep and bat start in 5–10 ms; an RDAP CLI
is simpler than either. Startup must be dominated by dynamic linking and
Tokio runtime init, not by any warmup work. No network calls occur at startup.

---

## 5. Batch Throughput Targets

| Batch size | Max wall-clock time (real network) |
|------------|-------------------------------------|
| 10 domains | < 600 ms                            |
| 50 domains | < 2 s                               |
| 100 domains| < 5–8 s                             |

Concurrency defaults to 10. Assumes median 150 ms server latency.

---

## 6. Cache Hit Ratio Target

| Scenario                          | Target |
|-----------------------------------|--------|
| Repeated queries same session     | > 85%  |
| Repeated queries across sessions (SQLite) | > 60% |

Bootstrap cache hit ratio (after first query in session): 100%.

---

## 7. Validation Layer Overhead

The RDAP response validation layer (`rdap-core::validation`) must add
negligible overhead relative to the network round-trip time.

| Payload size        | Max overhead |
|---------------------|-------------|
| Minimal (~100 B)    | < 10 µs     |
| Typical (~1 KB)     | < 50 µs     |
| Large (~10 KB, 50 entities) | < 200 µs |

---

## 8. SSRF Validation Overhead

`SsrfGuard::validate()` must be negligible relative to network latency.

| URL type       | Max overhead |
|----------------|-------------|
| Public domain  | < 5 µs      |
| Blocked IP     | < 2 µs      |

---

## 9. Benchmark Suite

Criterion benchmarks live in [`crates/rdapify/benches/`](../crates/rdapify/benches/).
See [`crates/rdapify/benches/README.md`](../crates/rdapify/benches/README.md) for
how to run them and interpret results.

### Quick run

```bash
# All benchmarks (mock-only, CI-safe):
cargo bench --workspace

# One group:
cargo bench -p rdapify --bench cache
cargo bench -p rdapify --bench query
cargo bench -p rdapify --bench validation
cargo bench -p rdapify --bench bootstrap
cargo bench -p rdapify --bench batch
cargo bench -p rdapify --bench ssrf
cargo bench -p rdapify --bench streaming
```

---

## 10. CI Enforcement

The following checks run on every pull request:

| Check                | Command                          | Fails if                                        |
|----------------------|----------------------------------|-------------------------------------------------|
| Binary size          | `scripts/size-check.sh` + `cargo bloat` | Any binary exceeds target OR grows > +5% |
| Benchmark compile    | `cargo bench --no-run`           | Any bench fails to compile                      |
| Latency regression   | `criterion` (key benches)        | p99 grows > +10% vs baseline                    |
| Startup time         | `scripts/startup-benchmark.sh`   | `--help` takes > 30 ms                          |

Full criterion runs are **not** in CI (network-free benches are fast but
still too slow for per-commit runs). Run them locally before releases.

---

## 11. Measurement Environment

Targets were validated on:

| Component | Spec                        |
|-----------|-----------------------------|
| CPU       | x86-64, 4+ cores            |
| RAM       | 8 GB+                       |
| OS        | Linux 6.x (amd64)           |
| Rust      | stable ≥ 1.75 (MSRV)        |
| Network   | Measured on 1 Gbps link      |

Performance on other platforms (macOS, Windows, ARM) may differ by ±20%.

---

> Last reviewed: 2026-05-01 · dev@rdapify.com
