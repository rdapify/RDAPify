# RDAPify Benchmark Suite

Performance benchmarks for the `rdapify` Rust workspace, built with
[Criterion.rs](https://bheisler.github.io/criterion.rs/book/).

For performance targets and enforcement policy, see
[`docs/PERFORMANCE_SPEC.md`](../../../../docs/PERFORMANCE_SPEC.md).

---

## Quick Start

```bash
# Run all benchmarks (mock-only, no network required)
cargo bench -p rdapify

# Run a specific benchmark file
cargo bench -p rdapify --bench cache
cargo bench -p rdapify --bench query
cargo bench -p rdapify --bench ssrf
cargo bench -p rdapify --bench streaming
cargo bench -p rdapify --bench batch
cargo bench -p rdapify --bench bootstrap
cargo bench -p rdapify --bench validation

# Run a single benchmark by name (substring match)
cargo bench -p rdapify --bench cache -- "cache_hit"
cargo bench -p rdapify --bench validation -- "typical_domain"

# Compile-check without running (fast, CI-safe)
cargo bench --no-run
```

---

## Benchmark Files

| File | What it measures |
|------|-----------------|
| [`cache.rs`](cache.rs) | In-memory cache: hit, miss, insert, eviction, bulk insert |
| [`query.rs`](query.rs) | Full query pipeline: domain/IP/ASN with and without cache |
| [`ssrf.rs`](ssrf.rs) | `SsrfGuard::validate()` for various URL types |
| [`streaming.rs`](streaming.rs) | `stream_domain()` throughput (10 queries mocked) |
| [`batch.rs`](batch.rs) | Batch availability checks: sizes 10/25, concurrency 1/5/10/20 |
| [`bootstrap.rs`](bootstrap.rs) | Warm bootstrap lookup: TLD, IP, ASN, custom override |
| [`validation.rs`](validation.rs) | Validation layer overhead vs raw `serde_json` |

---

## Test Environment

All benchmarks use **mockito** (local HTTP server) — no real RDAP servers
or internet access is required. Results measure:

- Async task scheduling overhead (Tokio)
- JSON parsing and deserialization
- Validation layer (depth/array/size checks)
- Cache operations (DashMap reads/writes)
- SSRF guard (URL parsing + IP checks)

**Network latency is not included.** Add your measured P50 latency
(typically 100–300 ms for real RDAP servers) on top of mock results
to estimate real-world performance.

---

## Interpreting Results

Criterion prints statistics like:

```
cache_hit               time:   [543.14 ns 545.23 ns 547.43 ns]
                        change: [-1.23% -0.45% +0.34%] (p = 0.34 > 0.05)
                        No change in performance detected.
```

| Column | Meaning |
|--------|---------|
| Lower bound | Fastest observed, high confidence |
| Point estimate | Best estimate of the true mean |
| Upper bound | Slowest observed, high confidence |
| change % | Compared to previous saved baseline |

HTML reports are written to `target/criterion/`. Open
`target/criterion/report/index.html` in a browser for flame graphs and
regression plots.

### Regression detection

Criterion flags a regression when the measured time increases by more than
the noise threshold (default 5%). If you see:

```
Performance has regressed.
```

investigate before merging. Check `git blame` on any dependency that may
have changed.

---

## Network Benchmarks (Optional)

The benchmarks above use mocks. To measure real latency against production
RDAP servers, use the live test suite with a `--ignored` flag:

```bash
# Run live tests (requires internet)
cargo test -p rdapify -- --ignored

# Combine with timing to estimate real-world latency:
time cargo test -p rdapify live_domain_example_com -- --ignored
```

Or use the CLI directly:

```bash
# Cold query (first run, bootstrap must be fetched)
time ./target/release/rdapify domain example.com

# Warm query (repeated)
time ./target/release/rdapify domain example.com
```

---

## Performance Targets Summary

| Metric              | Target    | Benchmark           |
|---------------------|-----------|---------------------|
| Cache hit           | < 5 µs    | `cache/cache_hit`   |
| SSRF validation     | < 5 µs    | `ssrf/ssrf_domain_public` |
| Validation (typical)| < 50 µs   | `validation/typical_domain` |
| Query (no cache, mock) | < 500 µs | `query/domain_no_cache` |
| Query (cache hit, mock) | < 10 µs | `query/domain_cache_hit` |
| Bootstrap warm TLD  | < 1 µs    | `bootstrap/warm_tld_lookup` |
| Batch 10 (mock)     | < 50 ms   | `batch/batch_availability/10` |

Real-network targets (not measured by these benchmarks):

| Metric            | Target       |
|-------------------|--------------|
| Cold query P50    | 200–350 ms   |
| Warm query P50    | 80–150 ms    |
| P95 latency       | < 150 ms     |
| P99 latency       | < 250 ms     |
| Batch 100 domains | < 5–8 s      |

---

## CI Integration

```yaml
# .github/workflows/ci.yml
- name: Compile benchmarks
  run: cargo bench --no-run

- name: Binary size check
  run: ./scripts/size-check.sh
```

Full criterion runs are **not** recommended in CI (slow). Use
`--no-run` to catch compile errors, and run full benchmarks locally
before releases.

---

## Adding a New Benchmark

1. Create `benches/<name>.rs`.
2. Add to `crates/rdapify/Cargo.toml`:
   ```toml
   [[bench]]
   name = "<name>"
   harness = false
   ```
3. Add an entry to this README.
4. Verify compilation: `cargo bench --no-run`.
