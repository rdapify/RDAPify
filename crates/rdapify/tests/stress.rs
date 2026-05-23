//! Stress tests — system behaviour under high load.
//!
//! These tests exercise the concurrency model, batch engine, and memory
//! stability when the system is under real pressure.
//!
//! # Test tiers
//!
//! | Tag       | Concurrency | Queries | Runs in CI |
//! |-----------|-------------|---------|------------|
//! | (none)    | 50          | 200     | Yes        |
//! | `#[ignore]` | 1 000     | 10 000  | No (manual)|
//!
//! Run the full stress suite with:
//! ```sh
//! cargo test -p rdapify --test stress -- --ignored --nocapture
//! ```
//!
//! # Invariants verified
//!
//! - No panic or deadlock under concurrent requests
//! - N batch inputs → N batch outputs (completeness under load)
//! - Memory usage does not grow linearly with request count (tested via
//!   peak allocation tracking with a before/after `len()` proxy)
//! - Mixed domain/IP/ASN workloads complete without error

mod common;

use std::sync::Arc;
use std::time::Duration;

use rdap_batch::{BatchConfig, BatchExecutor, BatchItemResult, BatchQuery};
use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};
use tokio_stream::StreamExt;

// ── Client builder ────────────────────────────────────────────────────────────

fn stress_client(base: &str, concurrency: usize) -> Arc<RdapClient> {
    Arc::new(
        RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(base.to_string()),
            cache: true,
            ssrf: SsrfConfig {
                enabled: false,
                ..Default::default()
            },
            fetcher: FetcherConfig {
                timeout: Duration::from_secs(10),
                max_attempts: 1,
                max_connections_per_host: concurrency,
                ..Default::default()
            },
            ..Default::default()
        })
        .expect("stress client"),
    )
}

// ── Mock setup helpers ────────────────────────────────────────────────────────

/// Spin up a mock server that responds to all domain/ip/asn queries with 200.
async fn mock_server_all_ok() -> mockito::ServerGuard {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // Bootstrap routes
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/ipv4.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::ipv4_bootstrap_json("0.0.0.0/0", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/asn.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::asn_bootstrap_json("0-4294967295", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    // RDAP responses
    server
        .mock("GET", mockito::Matcher::Regex(r"^/rdap/domain/.*".into()))
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("stress.com").to_string())
        .create_async()
        .await;

    server
        .mock("GET", mockito::Matcher::Regex(r"^/rdap/ip/.*".into()))
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::ip_rdap_response("10.0.0.0", "10.255.255.255", "US").to_string())
        .create_async()
        .await;

    server
        .mock("GET", mockito::Matcher::Regex(r"^/rdap/autnum/.*".into()))
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::asn_rdap_response(64496, 64511, "STRESS-TEST").to_string())
        .create_async()
        .await;

    server
}

// ── CI-safe stress tests (run in normal `cargo test`) ────────────────────────

/// 50 concurrent domain queries must all complete without panic or deadlock.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn stress_50_concurrent_domain_queries() {
    const N: usize = 50;
    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), N);

    let tasks: Vec<_> = (0..N)
        .map(|i| {
            let c = Arc::clone(&client);
            tokio::spawn(async move { c.domain(&format!("stress{i}.com")).await })
        })
        .collect();

    let results = futures::future::join_all(tasks).await;
    let failures: Vec<_> = results
        .iter()
        .filter(|r| r.as_ref().map(|inner| inner.is_err()).unwrap_or(true))
        .collect();

    assert!(
        failures.is_empty(),
        "{} out of {N} concurrent requests failed",
        failures.len()
    );
}

/// Batch executor: 200 domain queries must produce exactly 200 results.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn stress_batch_200_queries_completeness() {
    const N: usize = 200;
    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), 20);

    let queries: Vec<BatchQuery> = (0..N)
        .map(|i| BatchQuery::Domain(format!("batch{i}.com")))
        .collect();

    let executor = BatchExecutor::new(client);
    let config = BatchConfig {
        concurrency: 20,
        ..Default::default()
    };
    let mut stream = executor.run_stream(queries, config);

    let mut total = 0usize;
    let mut errors = 0usize;
    while let Some(item) = stream.next().await {
        total += 1;
        if matches!(item, BatchItemResult::Err(_)) {
            errors += 1;
        }
    }

    assert_eq!(
        total, N,
        "batch must produce exactly {N} results, got {total}"
    );
    assert_eq!(errors, 0, "{errors} batch items failed unexpectedly");
}

/// Mixed workload (domain + ip + asn) completes without panic or deadlock.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn stress_mixed_workload_30_queries() {
    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), 10);

    let domain_tasks: Vec<_> = (0..10)
        .map(|i| {
            let c = Arc::clone(&client);
            tokio::spawn(async move { c.domain(&format!("mixed{i}.com")).await })
        })
        .collect();

    let ip_tasks: Vec<_> = (0..10)
        .map(|i| {
            let c = Arc::clone(&client);
            tokio::spawn(async move { c.ip(&format!("10.0.0.{}", i % 255)).await })
        })
        .collect();

    let asn_tasks: Vec<_> = (0..10)
        .map(|i| {
            let c = Arc::clone(&client);
            tokio::spawn(async move { c.asn(&(64496 + i as u32).to_string()).await })
        })
        .collect();

    let (d, ip, a) = tokio::join!(
        futures::future::join_all(domain_tasks),
        futures::future::join_all(ip_tasks),
        futures::future::join_all(asn_tasks),
    );

    // Count failures per type separately — the three Vecs have distinct
    // element types (DomainResponse / IpResponse / AsnResponse) and cannot
    // be placed in a single homogeneous array.
    let domain_failures = d
        .iter()
        .filter(|r| r.as_ref().map(|i| i.is_err()).unwrap_or(true))
        .count();
    let ip_failures = ip
        .iter()
        .filter(|r| r.as_ref().map(|i| i.is_err()).unwrap_or(true))
        .count();
    let asn_failures = a
        .iter()
        .filter(|r| r.as_ref().map(|i| i.is_err()).unwrap_or(true))
        .count();
    assert_eq!(
        domain_failures, 0,
        "{domain_failures} domain queries failed in mixed workload"
    );
    assert_eq!(
        ip_failures, 0,
        "{ip_failures} ip queries failed in mixed workload"
    );
    assert_eq!(
        asn_failures, 0,
        "{asn_failures} asn queries failed in mixed workload"
    );
}

/// Cache-backed repeated queries: no memory growth beyond initial warm-up.
///
/// After warming the cache, `cache_size()` must remain stable regardless of
/// how many more identical queries are made.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stress_cache_size_is_bounded() {
    const WARM: usize = 10; // distinct keys to warm up
    const REPEAT: usize = 200; // additional identical queries

    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), 10);

    // Warm the cache with distinct domains
    for i in 0..WARM {
        let _ = client.domain(&format!("cache{i}.com")).await;
    }
    let size_after_warm = client.cache_size();

    // Flood with repeated queries (all cache hits)
    for _ in 0..REPEAT {
        let _ = client.domain("cache0.com").await;
    }
    let size_after_flood = client.cache_size();

    assert_eq!(
        size_after_warm, size_after_flood,
        "cache size must not grow on repeated cache hits: \
         warm={size_after_warm}, after_flood={size_after_flood}"
    );
}

// ── Full stress tests (marked `#[ignore]` — run with `-- --ignored`) ─────────

/// 1 000 concurrent domain queries.  Run manually to verify no crash/deadlock.
#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "slow stress test — run with `-- --ignored`"]
async fn stress_1000_concurrent_domain_queries() {
    const N: usize = 1_000;
    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), 100);

    let tasks: Vec<_> = (0..N)
        .map(|i| {
            let c = Arc::clone(&client);
            tokio::spawn(async move { c.domain(&format!("heavy{i}.com")).await })
        })
        .collect();

    let results = futures::future::join_all(tasks).await;
    let panics = results.iter().filter(|r| r.is_err()).count();
    let failures = results
        .iter()
        .filter(|r| r.as_ref().map(|inner| inner.is_err()).unwrap_or(false))
        .count();

    assert_eq!(panics, 0, "no tokio task must panic");
    assert_eq!(failures, 0, "{failures}/{N} concurrent requests failed");
}

/// Batch 10 000 queries — completeness guarantee at scale.
#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "slow stress test — run with `-- --ignored`"]
async fn stress_batch_10k_queries_completeness() {
    const N: usize = 10_000;
    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), 100);

    let queries: Vec<BatchQuery> = (0..N)
        .map(|i| BatchQuery::Domain(format!("bulk{i}.com")))
        .collect();

    let executor = BatchExecutor::new(client);
    let config = BatchConfig {
        concurrency: 100,
        ..Default::default()
    };
    let mut stream = executor.run_stream(queries, config);

    let mut total = 0usize;
    while stream.next().await.is_some() {
        total += 1;
    }

    assert_eq!(total, N, "batch must produce exactly {N} results");
}

/// Mixed 1 000 domain/IP/ASN queries under high concurrency.
#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "slow stress test — run with `-- --ignored`"]
async fn stress_1000_mixed_workload() {
    const PER_TYPE: usize = 333;
    let server = mock_server_all_ok().await;
    let client = stress_client(&server.url(), 100);

    let mut all_tasks = Vec::new();

    for i in 0..PER_TYPE {
        let c = Arc::clone(&client);
        all_tasks.push(tokio::spawn(async move {
            c.domain(&format!("mix{i}.com")).await.map(|_| ())
        }));
    }
    for i in 0..PER_TYPE {
        let c = Arc::clone(&client);
        all_tasks.push(tokio::spawn(async move {
            c.ip(&format!("10.{}.{}.1", i / 256, i % 256))
                .await
                .map(|_| ())
        }));
    }
    for i in 0..PER_TYPE {
        let c = Arc::clone(&client);
        all_tasks.push(tokio::spawn(async move {
            c.asn(&(64496 + i as u32).to_string()).await.map(|_| ())
        }));
    }

    let results = futures::future::join_all(all_tasks).await;
    let panics = results.iter().filter(|r| r.is_err()).count();
    let failures = results
        .iter()
        .filter(|r| r.as_ref().map(|i| i.is_err()).unwrap_or(false))
        .count();

    assert_eq!(panics, 0, "no task must panic in mixed workload");
    assert_eq!(
        failures, 0,
        "{failures} queries failed in 1000-item mixed workload"
    );
}
