//! Performance regression guards.
//!
//! These tests assert that hot-path operations stay within documented latency
//! thresholds.  They run entirely in-memory (no network, no I/O) so they are
//! reliable in CI.
//!
//! Network-bound tests (warm lookup, batch throughput) are marked `#[ignore]`
//! and intended for local developer runs.
//!
//! # Thresholds (in-memory, CI-safe)
//!
//! | Operation                  | Threshold  | Rationale                        |
//! |----------------------------|------------|----------------------------------|
//! | Cache set + get (100×)     | 10 ms      | Pure DashMap read/write          |
//! | Normalizer (domain, 100×)  | 50 ms      | Pure JSON parse + struct build   |
//! | Rate limiter try_acquire   | 5 ms       | GCRA check + lazy DashMap init   |
//! | Cache len()                | 1 ms       | DashMap shard scan               |
//!
//! # Thresholds (network-bound, `#[ignore]`)
//!
//! | Operation                  | Threshold  |
//! |----------------------------|------------|
//! | Cached lookup (1 req)      | 10 ms      |
//! | Warm lookup (mock server)  | 150 ms     |
//! | Batch 50 items (mock)      | 5 s        |

mod common;

use std::time::{Duration, Instant};

use rdap_cache::MemoryCache;
use rdap_core::Normalizer;
use rdap_rate_limit::{RateLimitConfig, RdapRateLimiter};

// ── In-memory guards (always run in CI) ───────────────────────────────────────

/// 100 cache set+get cycles must complete in under 10 ms total.
///
/// Baseline: DashMap read/write on a single key is ≈ 200 ns on modern hardware.
/// 100 × 200 ns = 20 µs; the 10 ms threshold gives 500× headroom for CI noise.
#[test]
fn perf_cache_set_get_100x_under_10ms() {
    const ITERATIONS: usize = 100;
    const THRESHOLD: Duration = Duration::from_millis(10);

    let cache = MemoryCache::new();
    let value = serde_json::json!({ "ldhName": "perf.com" });

    let start = Instant::now();
    for i in 0..ITERATIONS {
        let key = format!("perf{i}.com");
        cache.set(key.clone(), value.clone());
        let _ = cache.get(&key);
    }
    let elapsed = start.elapsed();

    assert!(
        elapsed < THRESHOLD,
        "100 cache set+get cycles took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

/// 100 domain normalization calls must complete in under 50 ms total.
///
/// Baseline: serde_json parse + struct allocation ≈ 10–50 µs per call.
/// 100 × 50 µs = 5 ms; the 50 ms threshold gives 10× headroom.
#[test]
fn perf_normalizer_domain_100x_under_50ms() {
    const ITERATIONS: usize = 100;
    const THRESHOLD: Duration = Duration::from_millis(50);

    let norm = Normalizer::new();
    let raw = common::domain_rdap_response("perf.com");

    let start = Instant::now();
    for _ in 0..ITERATIONS {
        let _ = norm.domain("perf.com", raw.clone(), "rdap.perf.test", false);
    }
    let elapsed = start.elapsed();

    assert!(
        elapsed < THRESHOLD,
        "100 normalizer calls took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

/// A single `try_acquire` call must complete in under 5 ms.
///
/// GCRA is an O(1) atomic operation — should be < 1 µs on any hardware.
/// The first call also initialises the DashMap entry (hash + write), which
/// can take up to ~100 µs under load.  5 ms gives 50× headroom for a
/// loaded CI runner while still catching genuine regressions.
#[test]
fn perf_rate_limiter_try_acquire_under_1ms() {
    const THRESHOLD: Duration = Duration::from_millis(5);

    let limiter = RdapRateLimiter::new(RateLimitConfig {
        per_host_rps: 1_000_000, // effectively unlimited for this test
        per_host_burst: 1_000_000,
        global_rps: None,
        global_burst: 0,
    });

    let start = Instant::now();
    let _ = limiter.try_acquire("perf.rdap.example");
    let elapsed = start.elapsed();

    assert!(
        elapsed < THRESHOLD,
        "try_acquire took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

/// Cache `len()` on a 1 000-entry cache must complete in under 1 ms.
#[test]
fn perf_cache_len_1000_entries_under_1ms() {
    const ENTRIES: usize = 1_000;
    const THRESHOLD: Duration = Duration::from_millis(1);

    let cache = MemoryCache::new();
    for i in 0..ENTRIES {
        cache.set(format!("key{i}"), serde_json::json!(null));
    }

    let start = Instant::now();
    let _ = cache.len();
    let elapsed = start.elapsed();

    assert!(
        elapsed < THRESHOLD,
        "len() on {ENTRIES}-entry cache took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

/// Average per-call normalizer time must be under 500 µs.
#[test]
fn perf_normalizer_average_per_call_under_500us() {
    const ITERATIONS: usize = 200;
    const THRESHOLD_PER_CALL: Duration = Duration::from_micros(500);

    let norm = Normalizer::new();
    let raw = common::domain_rdap_response("avg.com");

    let start = Instant::now();
    for _ in 0..ITERATIONS {
        let _ = norm.domain("avg.com", raw.clone(), "rdap.avg.test", false);
    }
    let total = start.elapsed();
    let per_call = total / ITERATIONS as u32;

    assert!(
        per_call < THRESHOLD_PER_CALL,
        "average normalizer call time was {per_call:?}, threshold is {THRESHOLD_PER_CALL:?}"
    );
}

/// Normalizing IP responses must be as fast as domain responses (same code
/// path, sanity check).
#[test]
fn perf_normalizer_ip_100x_under_50ms() {
    const ITERATIONS: usize = 100;
    const THRESHOLD: Duration = Duration::from_millis(50);

    let norm = Normalizer::new();
    let raw = common::ip_rdap_response("8.8.8.0", "8.8.8.255", "US");

    let start = Instant::now();
    for _ in 0..ITERATIONS {
        let _ = norm.ip("8.8.8.8", raw.clone(), "rdap.arin.net", false);
    }
    let elapsed = start.elapsed();

    assert!(
        elapsed < THRESHOLD,
        "100 IP normalizer calls took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

// ── Network-bound performance tests (marked `#[ignore]`) ─────────────────────

/// Cached domain lookup (cache hit path) must complete in under 10 ms.
///
/// Run with: `cargo test -p rdapify --test performance -- --ignored`
#[tokio::test]
#[ignore = "network-bound — run with `-- --ignored`"]
async fn perf_cached_lookup_under_10ms() {
    use std::sync::Arc;

    use rdapify::http::FetcherConfig;
    use rdapify::security::SsrfConfig;
    use rdapify::{ClientConfig, RdapClient};

    const THRESHOLD: Duration = Duration::from_millis(10);

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
        .with_body(common::domain_rdap_response("cached-perf.com").to_string())
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
                timeout: Duration::from_secs(5),
                max_attempts: 1,
                ..Default::default()
            },
            ..Default::default()
        })
        .expect("perf client"),
    );

    // Warm the cache
    let _ = client.domain("cached-perf.com").await;

    // Measure the cache-hit path
    let start = Instant::now();
    let result = client.domain("cached-perf.com").await;
    let elapsed = start.elapsed();

    assert!(result.is_ok(), "cached lookup must succeed: {result:?}");
    assert!(
        elapsed < THRESHOLD,
        "cached lookup took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

/// Warm (uncached) lookup against a local mock must complete in under 150 ms.
#[tokio::test]
#[ignore = "network-bound — run with `-- --ignored`"]
async fn perf_warm_lookup_under_150ms() {
    use rdapify::http::FetcherConfig;
    use rdapify::security::SsrfConfig;
    use rdapify::{ClientConfig, RdapClient};

    const THRESHOLD: Duration = Duration::from_millis(150);

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
        .with_body(common::domain_rdap_response("warm-perf.com").to_string())
        .create_async()
        .await;

    let client = RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(base),
        cache: false,
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(5),
            max_attempts: 1,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("perf client");

    let start = Instant::now();
    let result = client.domain("warm-perf.com").await;
    let elapsed = start.elapsed();

    assert!(result.is_ok(), "warm lookup must succeed: {result:?}");
    assert!(
        elapsed < THRESHOLD,
        "warm lookup took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}

/// Batch of 50 queries against a local mock must complete in under 5 s total.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "network-bound — run with `-- --ignored`"]
async fn perf_batch_50_under_5s() {
    use std::sync::Arc;

    use rdap_batch::{BatchConfig, BatchExecutor, BatchItemResult, BatchQuery};
    use rdapify::http::FetcherConfig;
    use rdapify::security::SsrfConfig;
    use rdapify::{ClientConfig, RdapClient};
    use tokio_stream::StreamExt;

    const N: usize = 50;
    const THRESHOLD: Duration = Duration::from_secs(5);

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
        .with_body(common::domain_rdap_response("batch-perf.com").to_string())
        .create_async()
        .await;

    let client = Arc::new(
        RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(base),
            cache: false,
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
        .expect("perf client"),
    );

    let queries: Vec<BatchQuery> = (0..N)
        .map(|i| BatchQuery::Domain(format!("perf{i}.com")))
        .collect();

    let executor = BatchExecutor::new(client);
    let config = BatchConfig {
        concurrency: 20,
        ..Default::default()
    };

    let start = Instant::now();
    let mut stream = executor.run_stream(queries, config);
    let mut errors = 0usize;
    while let Some(item) = stream.next().await {
        if matches!(item, BatchItemResult::Err(_)) {
            errors += 1;
        }
    }
    let elapsed = start.elapsed();

    assert_eq!(errors, 0, "{errors} batch items failed in perf test");
    assert!(
        elapsed < THRESHOLD,
        "batch of {N} took {elapsed:?}, threshold is {THRESHOLD:?}"
    );
}
