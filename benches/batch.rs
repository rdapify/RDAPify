//! Benchmarks for the high-performance batch RDAP engine (rdap-batch v0.2).
//!
//! All benchmarks use a local mock HTTP server so measurements reflect
//! CPU / async-scheduling overhead — not network latency.
//!
//! Key comparisons:
//!
//! | Benchmark            | Engine              | Queries |
//! |----------------------|---------------------|---------|
//! | `batch_unordered_10` | buffer_unordered(10)| 10      |
//! | `batch_unordered_50` | buffer_unordered(50)| 50      |
//! | `batch_sizes/N`      | buffer_unordered(N) | N       |
//! | `batch_ordered_10`   | buffered(10)        | 10      |
//! | `batch_cached_10`    | unordered + cache   | 10      |

use std::sync::Arc;
use std::time::Duration;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use tokio::runtime::Runtime;
use tokio_stream::StreamExt;

use rdap_batch::{BatchConfig, BatchExecutor, BatchQuery};
use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};

// ── Fixture helpers ───────────────────────────────────────────────────────────

fn dns_bootstrap(tld: &str, rdap_base: &str) -> serde_json::Value {
    serde_json::json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[tld], [rdap_base]]]
    })
}

fn domain_response(ldh: &str) -> serde_json::Value {
    serde_json::json!({
        "objectClassName": "domain",
        "handle": "BENCH-1",
        "ldhName": ldh,
        "status": ["active"],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" },
            { "eventAction": "expiration",   "eventDate": "2030-01-01T00:00:00Z" }
        ],
        "nameservers": [
            { "objectClassName": "nameserver", "ldhName": "ns1.bench.com" }
        ],
        "entities": [{
            "objectClassName": "entity",
            "handle": "REG-1",
            "roles": ["registrar"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn",      {}, "text", "Bench Registrar"]
            ]]
        }]
    })
}

/// Build a `BatchExecutor` pointing at the mock `server_url`, with optional caching.
fn make_executor(rt: &Runtime, server_url: &str, cache: bool, n: usize) -> BatchExecutor {
    let client = rt.block_on(async {
        RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(server_url.to_string()),
            cache,
            rate_limit: None,
            ssrf: SsrfConfig {
                enabled: false,
                ..Default::default()
            },
            fetcher: FetcherConfig {
                timeout: Duration::from_secs(10),
                max_attempts: 1,
                ..Default::default()
            },
            ..Default::default()
        })
        .expect("client construction failed")
    });

    // Warm up the bootstrap cache so it doesn't count toward the benchmark.
    // The bootstrap is shared across all n queries (24 h TTL).
    let _ = rt.block_on(async {
        // We can't call domain() here because the RDAP mock isn't set up yet.
        // Bootstrap will be fetched on first query inside the benchmark loop.
        let _ = n; // suppress lint
    });

    BatchExecutor::new(Arc::new(client))
}

fn make_queries(n: usize) -> Vec<BatchQuery> {
    (0..n)
        .map(|i| BatchQuery::Domain(format!("bench{i:04}.com")))
        .collect()
}

// ── bench_batch_unordered_10 ──────────────────────────────────────────────────

fn bench_batch_unordered_10(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    const N: usize = 10;

    let (server, executor) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_body(dns_bootstrap("com", &rdap_base).to_string())
            .create_async()
            .await;

        for i in 0..N {
            let name = format!("bench{i:04}.com");
            let path = format!("/rdap/domain/{name}");
            server
                .mock("GET", path.as_str())
                .with_status(200)
                .with_header("content-type", "application/rdap+json")
                .with_body(domain_response(&name).to_string())
                .create_async()
                .await;
        }

        let executor = make_executor(&Runtime::new().unwrap(), &base, false, N);
        (server, executor)
    });

    let cfg = BatchConfig {
        concurrency: N,
        ordered: false,
        buffer: N * 2,
    };

    c.bench_function("batch_unordered_10", |b| {
        b.to_async(&rt).iter(|| async {
            let queries = make_queries(N);
            let mut stream = executor.run_stream(queries, cfg.clone());
            while let Some(_) = stream.next().await {}
        });
    });

    drop(server);
}

// ── bench_batch_ordered_10 ───────────────────────────────────────────────────

fn bench_batch_ordered_10(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    const N: usize = 10;

    let (server, executor) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_body(dns_bootstrap("com", &rdap_base).to_string())
            .create_async()
            .await;

        for i in 0..N {
            let name = format!("bench{i:04}.com");
            let path = format!("/rdap/domain/{name}");
            server
                .mock("GET", path.as_str())
                .with_status(200)
                .with_header("content-type", "application/rdap+json")
                .with_body(domain_response(&name).to_string())
                .create_async()
                .await;
        }

        let executor = make_executor(&Runtime::new().unwrap(), &base, false, N);
        (server, executor)
    });

    let cfg = BatchConfig {
        concurrency: N,
        ordered: true,
        buffer: N * 2,
    };

    c.bench_function("batch_ordered_10", |b| {
        b.to_async(&rt).iter(|| async {
            let queries = make_queries(N);
            let mut stream = executor.run_stream(queries, cfg.clone());
            while let Some(_) = stream.next().await {}
        });
    });

    drop(server);
}

// ── bench_batch_sizes (group: 10 / 50 / 100) ─────────────────────────────────

fn bench_batch_sizes(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("batch_sizes");

    for &n in &[10usize, 50, 100] {
        let (server, executor) = rt.block_on(async {
            let mut server = mockito::Server::new_async().await;
            let base = server.url();
            let rdap_base = format!("{base}/rdap");

            server
                .mock("GET", "/dns.json")
                .with_status(200)
                .with_body(dns_bootstrap("com", &rdap_base).to_string())
                .create_async()
                .await;

            for i in 0..n {
                let name = format!("bench{i:04}.com");
                let path = format!("/rdap/domain/{name}");
                server
                    .mock("GET", path.as_str())
                    .with_status(200)
                    .with_header("content-type", "application/rdap+json")
                    .with_body(domain_response(&name).to_string())
                    .create_async()
                    .await;
            }

            let executor = make_executor(&Runtime::new().unwrap(), &base, false, n);
            (server, executor)
        });

        let cfg = BatchConfig {
            concurrency: n.min(50),
            ordered: false,
            buffer: n * 2,
        };

        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, &n| {
            b.to_async(&rt).iter(|| async {
                let queries = make_queries(n);
                let mut stream = executor.run_stream(queries, cfg.clone());
                while let Some(_) = stream.next().await {}
            });
        });

        drop(server);
    }

    group.finish();
}

// ── bench_batch_cached_10 ────────────────────────────────────────────────────

fn bench_batch_cached_10(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    const N: usize = 10;

    let (server, executor) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_body(dns_bootstrap("com", &rdap_base).to_string())
            .create_async()
            .await;

        for i in 0..N {
            let name = format!("bench{i:04}.com");
            let path = format!("/rdap/domain/{name}");
            server
                .mock("GET", path.as_str())
                .with_status(200)
                .with_header("content-type", "application/rdap+json")
                .with_body(domain_response(&name).to_string())
                .create_async()
                .await;
        }

        let executor = make_executor(&Runtime::new().unwrap(), &base, true, N);
        (server, executor)
    });

    let cfg = BatchConfig {
        concurrency: N,
        ordered: false,
        buffer: N * 2,
    };

    // Prime the cache with one full batch run before measuring.
    rt.block_on(async {
        let mut stream = executor.run_stream(make_queries(N), cfg.clone());
        while let Some(_) = stream.next().await {}
    });

    c.bench_function("batch_cached_10", |b| {
        b.to_async(&rt).iter(|| async {
            let queries = make_queries(N);
            let mut stream = executor.run_stream(queries, cfg.clone());
            while let Some(_) = stream.next().await {}
        });
    });

    drop(server);
}

criterion_group!(
    benches,
    bench_batch_unordered_10,
    bench_batch_ordered_10,
    bench_batch_sizes,
    bench_batch_cached_10,
);
criterion_main!(benches);
