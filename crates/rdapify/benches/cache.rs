//! Benchmarks for the in-memory RDAP response cache.
//!
//! Measures:
//! - Cache hit (pre-populated key, fresh TTL)
//! - Cache miss (key absent)
//! - Cache insert (single write)
//! - Cache eviction (insert at max capacity → oldest entry evicted)

use std::time::Duration;

use criterion::{criterion_group, criterion_main, BatchSize, BenchmarkId, Criterion};
use serde_json::json;

use rdapify::cache::{CacheConfig, MemoryCache};

fn bench_cache_hit(c: &mut Criterion) {
    let cache = MemoryCache::new();
    let key = "https://rdap.verisign.com/com/v1/domain/example.com".to_string();
    let value = json!({
        "objectClassName": "domain",
        "ldhName": "example.com",
        "status": ["active"]
    });
    cache.set(key.clone(), value);

    c.bench_function("cache_hit", |b| {
        b.iter(|| {
            criterion::black_box(cache.get(&key));
        });
    });
}

fn bench_cache_miss(c: &mut Criterion) {
    let cache = MemoryCache::new();

    c.bench_function("cache_miss", |b| {
        b.iter(|| {
            criterion::black_box(cache.get("https://rdap.verisign.com/com/v1/domain/notfound.com"));
        });
    });
}

fn bench_cache_set(c: &mut Criterion) {
    let value = json!({
        "objectClassName": "domain",
        "ldhName": "example.com",
        "status": ["active"],
        "nameservers": [
            { "ldhName": "ns1.example.com" },
            { "ldhName": "ns2.example.com" }
        ]
    });

    c.bench_function("cache_set", |b| {
        b.iter_batched(
            || {
                (
                    MemoryCache::with_config(CacheConfig {
                        ttl: Duration::from_secs(300),
                        max_entries: 10_000,
                    }),
                    value.clone(),
                )
            },
            |(cache, v)| {
                cache.set(
                    "https://rdap.verisign.com/com/v1/domain/example.com".to_string(),
                    criterion::black_box(v),
                );
            },
            BatchSize::SmallInput,
        );
    });
}

fn bench_cache_eviction(c: &mut Criterion) {
    let value = json!({ "objectClassName": "domain" });

    // Benchmark the cost of an insert that triggers eviction (cache is at capacity).
    c.bench_function("cache_eviction", |b| {
        b.iter_batched(
            || {
                let cache = MemoryCache::with_config(CacheConfig {
                    ttl: Duration::from_secs(300),
                    max_entries: 100,
                });
                // Pre-fill to capacity.
                for i in 0..100 {
                    cache.set(
                        format!("https://rdap.example.com/domain/key-{i}"),
                        value.clone(),
                    );
                }
                cache
            },
            |cache| {
                // This insert must evict the oldest entry first.
                cache.set(
                    "https://rdap.example.com/domain/overflow".to_string(),
                    criterion::black_box(value.clone()),
                );
            },
            BatchSize::SmallInput,
        );
    });
}

fn bench_cache_bulk_insert(c: &mut Criterion) {
    let value = json!({ "objectClassName": "domain", "ldhName": "example.com" });

    let mut group = c.benchmark_group("cache_bulk_insert");
    for n in [100usize, 500, 1_000] {
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, &n| {
            b.iter_batched(
                || {
                    MemoryCache::with_config(CacheConfig {
                        ttl: Duration::from_secs(300),
                        max_entries: n + 1,
                    })
                },
                |cache| {
                    for i in 0..n {
                        cache.set(
                            format!("https://rdap.example.com/domain/entry-{i}"),
                            value.clone(),
                        );
                    }
                },
                BatchSize::SmallInput,
            );
        });
    }
    group.finish();
}

criterion_group!(
    benches,
    bench_cache_hit,
    bench_cache_miss,
    bench_cache_set,
    bench_cache_eviction,
    bench_cache_bulk_insert,
);
criterion_main!(benches);
