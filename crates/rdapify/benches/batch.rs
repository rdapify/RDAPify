//! Benchmarks for batch RDAP query execution.
//!
//! # What is measured
//!
//! * Total throughput when checking availability for N domains in parallel.
//! * All requests go to a local mockito server — no real network latency.
//! * The measured time is pure Rust overhead: tokio scheduling, validation,
//!   JSON parsing, and cache interaction.
//!
//! # Performance targets (real network, not these benchmarks)
//!
//! | Batch size | Target wall-clock time |
//! |------------|------------------------|
//! | 10 domains | < 600 ms               |
//! | 50 domains | < 2 s                  |
//! | 100 domains| < 5–8 s                |
//!
//! These benchmarks measure only the code path. Add measured network latency
//! on top when estimating real-world performance.

use std::time::Duration;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use serde_json::json;
use tokio::runtime::Runtime;

use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn dns_bootstrap_json(tld: &str, server: &str) -> String {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[tld], [server]]]
    })
    .to_string()
}

fn availability_404() -> &'static str {
    // A minimal 404 response indicating "domain not found / available"
    r#"{"errorCode":404,"title":"Not Found"}"#
}

fn make_client(bootstrap_url: &str) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(bootstrap_url.to_string()),
        cache: false, // isolate batch overhead, not cache overhead
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: rdapify::http::FetcherConfig {
            timeout: Duration::from_secs(10),
            max_attempts: 1,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("client construction failed")
}

// ── Benchmarks ────────────────────────────────────────────────────────────────

fn bench_batch_availability(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("batch_availability");
    // Keep iteration counts low (these spin up mock servers): 10 and 25 items.
    group.sample_size(10);

    for batch_size in [10usize, 25] {
        group.bench_with_input(
            BenchmarkId::from_parameter(batch_size),
            &batch_size,
            |b, &n| {
                b.iter(|| {
                    rt.block_on(async {
                        let mut server = mockito::Server::new_async().await;
                        let base = server.url();

                        // Bootstrap mock
                        let _m_boot = server
                            .mock("GET", "/dns.json")
                            .with_status(200)
                            .with_header("content-type", "application/json")
                            .with_body(dns_bootstrap_json("com", &format!("{base}/rdap")))
                            .create_async()
                            .await;

                        // Mock each domain as "available" (404)
                        let domains: Vec<String> =
                            (1..=n).map(|i| format!("bench{i:04}.com")).collect();

                        for domain in &domains {
                            let _m = server
                                .mock("GET", format!("/rdap/domain/{domain}").as_str())
                                .with_status(404)
                                .with_header("content-type", "application/rdap+json")
                                .with_body(availability_404())
                                .create_async()
                                .await;
                        }

                        let client = make_client(&base);
                        // Warm bootstrap cache
                        let _ = client.domain("warmup.com").await;

                        let results = client.domain_available_batch(domains, Some(10)).await;

                        criterion::black_box(results)
                    })
                });
            },
        );
    }

    group.finish();
}

fn bench_batch_concurrency_scaling(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let mut group = c.benchmark_group("batch_concurrency");
    group.sample_size(10);

    // Fixed 20-domain batch, varying concurrency level
    for concurrency in [1usize, 5, 10, 20] {
        group.bench_with_input(
            BenchmarkId::from_parameter(concurrency),
            &concurrency,
            |b, &conc| {
                b.iter(|| {
                    rt.block_on(async {
                        let mut server = mockito::Server::new_async().await;
                        let base = server.url();

                        let _m_boot = server
                            .mock("GET", "/dns.json")
                            .with_status(200)
                            .with_header("content-type", "application/json")
                            .with_body(dns_bootstrap_json("com", &format!("{base}/rdap")))
                            .create_async()
                            .await;

                        let domains: Vec<String> =
                            (1..=20).map(|i| format!("domain{i:03}.com")).collect();

                        for domain in &domains {
                            let _m = server
                                .mock("GET", format!("/rdap/domain/{domain}").as_str())
                                .with_status(404)
                                .with_header("content-type", "application/rdap+json")
                                .with_body(availability_404())
                                .create_async()
                                .await;
                        }

                        let client = make_client(&base);
                        let _ = client.domain("warmup.com").await;

                        let results = client.domain_available_batch(domains, Some(conc)).await;

                        criterion::black_box(results)
                    })
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_batch_availability,
    bench_batch_concurrency_scaling,
);
criterion_main!(benches);
