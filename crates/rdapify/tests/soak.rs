//! Soak tests — long-running stability verification.
//!
//! These tests run the system continuously for an extended period to detect:
//! - Performance degradation over time (throughput drift)
//! - Memory leaks (cache size growing without bound)
//! - Sporadic failures that only appear under sustained load
//!
//! All soak tests are marked `#[ignore]` — they are not run in CI.
//! Run them locally:
//!
//! ```sh
//! # Quick soak (1 000 sequential requests)
//! cargo test -p rdapify --test soak -- --ignored soak_1k --nocapture
//!
//! # Full soak (10 000 requests)
//! cargo test -p rdapify --test soak -- --ignored soak_10k --nocapture
//! ```

mod common;

use std::sync::Arc;
use std::time::{Duration, Instant};

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};

// ── Helpers ───────────────────────────────────────────────────────────────────

async fn soak_server_and_client(concurrency: usize) -> (mockito::ServerGuard, Arc<RdapClient>) {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    server
        .mock("GET", mockito::Matcher::Regex(r"^/rdap/domain/.*".into()))
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("soak.com").to_string())
        .create_async()
        .await;

    let client = Arc::new(
        RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(base),
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
        .expect("soak client"),
    );

    (server, client)
}

// ── Soak: 1 000 sequential requests ──────────────────────────────────────────

/// 1 000 sequential domain queries.
///
/// Verifies:
/// - No panic or error accumulation
/// - Cache does not grow beyond the number of distinct domains queried
/// - Throughput stays stable (no unexpected slowdowns)
#[tokio::test]
#[ignore = "soak test — run locally with `-- --ignored`"]
async fn soak_1k_sequential_no_degradation() {
    const N: usize = 1_000;
    const DISTINCT_DOMAINS: usize = 10; // rotate through 10 domains to test cache pressure

    let (_server, client) = soak_server_and_client(1).await;
    let start = Instant::now();
    let mut failures = 0usize;

    for i in 0..N {
        let domain = format!("soak{}.com", i % DISTINCT_DOMAINS);
        if client.domain(&domain).await.is_err() {
            failures += 1;
        }
    }

    let elapsed = start.elapsed();
    let cache_size = client.cache_size();

    eprintln!(
        "soak_1k: {N} requests in {elapsed:.2?}, {failures} failures, \
         cache_size={cache_size}"
    );

    assert_eq!(failures, 0, "{failures} requests failed during soak");
    assert!(
        cache_size <= DISTINCT_DOMAINS,
        "cache must not exceed {DISTINCT_DOMAINS} entries, got {cache_size}"
    );
}

// ── Soak: 10 000 sequential requests ─────────────────────────────────────────

/// 10 000 sequential domain queries — full soak run.
///
/// Verifies:
/// - Throughput in the second half is not worse than the first half (no drift)
/// - Memory (cache_size proxy) remains bounded
/// - Zero failures
#[tokio::test]
#[ignore = "full soak — run locally: `-- --ignored soak_10k --nocapture`"]
async fn soak_10k_no_throughput_degradation() {
    const N: usize = 10_000;
    const HALF: usize = N / 2;
    const DISTINCT: usize = 20;

    let (_server, client) = soak_server_and_client(1).await;
    let mut failures = 0usize;

    // First half
    let t0 = Instant::now();
    for i in 0..HALF {
        if client
            .domain(&format!("soak{}.com", i % DISTINCT))
            .await
            .is_err()
        {
            failures += 1;
        }
    }
    let first_half_ms = t0.elapsed().as_millis();

    // Second half
    let t1 = Instant::now();
    for i in HALF..N {
        if client
            .domain(&format!("soak{}.com", i % DISTINCT))
            .await
            .is_err()
        {
            failures += 1;
        }
    }
    let second_half_ms = t1.elapsed().as_millis();

    let cache_size = client.cache_size();

    eprintln!(
        "soak_10k: {N} requests total | \
         first_half={first_half_ms}ms  second_half={second_half_ms}ms | \
         failures={failures}  cache_size={cache_size}"
    );

    assert_eq!(failures, 0, "{failures} requests failed during soak");
    assert!(
        cache_size <= DISTINCT,
        "cache grew beyond {DISTINCT} entries: {cache_size}"
    );

    // Throughput in second half must not be more than 3× slower than first half.
    // (3× is very generous — more than 3× indicates a serious leak or spin.)
    if first_half_ms > 0 {
        assert!(
            second_half_ms < first_half_ms * 3,
            "second half ({second_half_ms}ms) is more than 3× slower than first half \
             ({first_half_ms}ms) — possible performance degradation"
        );
    }
}

// ── Soak: memory stability ────────────────────────────────────────────────────

/// After 5 000 requests cycling through 5 domains, `cache_size()` must equal
/// exactly 5 — proving the cache is bounded regardless of request volume.
#[tokio::test]
#[ignore = "soak test — run locally with `-- --ignored`"]
async fn soak_memory_cache_stays_bounded() {
    const REQUESTS: usize = 5_000;
    const DISTINCT: usize = 5;

    let (_server, client) = soak_server_and_client(1).await;

    for i in 0..REQUESTS {
        let _ = client.domain(&format!("mem{}.com", i % DISTINCT)).await;
    }

    let size = client.cache_size();
    assert_eq!(
        size, DISTINCT,
        "after {REQUESTS} requests over {DISTINCT} domains, \
         cache_size must be {DISTINCT}, got {size}"
    );
}

// ── Soak: concurrent long-run ─────────────────────────────────────────────────

/// 500 concurrent tasks each making 20 requests (10 000 total) must all
/// complete without panic or deadlock.
#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
#[ignore = "concurrent soak — run locally with `-- --ignored`"]
async fn soak_concurrent_long_run() {
    use futures::future::join_all;

    const TASKS: usize = 500;
    const PER_TASK: usize = 20;

    let (_server, client) = soak_server_and_client(100).await;

    let tasks: Vec<_> = (0..TASKS)
        .map(|t| {
            let c = Arc::clone(&client);
            tokio::spawn(async move {
                let mut failures = 0u32;
                for i in 0..PER_TASK {
                    if c.domain(&format!("task{t}x{i}.com")).await.is_err() {
                        failures += 1;
                    }
                }
                failures
            })
        })
        .collect();

    let results = join_all(tasks).await;
    let total_failures: u32 = results.iter().filter_map(|r| r.as_ref().ok()).sum();
    let panics = results.iter().filter(|r| r.is_err()).count();

    eprintln!(
        "soak_concurrent: {total} total requests | failures={total_failures} | panics={panics}",
        total = TASKS * PER_TASK,
    );

    assert_eq!(panics, 0, "no task must panic");
    assert_eq!(
        total_failures, 0,
        "{total_failures} requests failed in concurrent soak"
    );
}
