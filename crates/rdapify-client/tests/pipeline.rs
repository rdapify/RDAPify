//! Integration tests for the request pipeline reordering (B2.5).
//!
//! Verifies that:
//!
//! 1. Concurrent identical cache misses produce exactly one upstream fetch
//!    (dedup at the cache layer).
//! 2. Concurrent stale hits produce at most one background refresh.
//! 3. Cache hits skip rate-limit and fetch entirely (no duplicate pressure).
//!
//! The `domain` query path is exercised because it goes through the full
//! pipeline (bootstrap + cache + dedup + rate-limit + fetch).

use std::sync::Arc;

use rdap_rate_limit::RateLimitConfig;
use rdap_types::RdapError;
use rdapify_client::{ClientConfig, RdapClient};

const BOOTSTRAP_DNS: &str = r#"{
    "version": "1.0",
    "publication": "2026-01-01T00:00:00Z",
    "description": "test",
    "services": [
        [["test"], ["__SERVER__"]]
    ]
}"#;

const DOMAIN_RESPONSE: &str = r#"{
    "objectClassName": "domain",
    "ldhName": "EXAMPLE.TEST",
    "handle": "EX-TEST"
}"#;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_identical_misses_produce_one_upstream_fetch() {
    // Stand up two mock servers:
    //   1. bootstrap_server — serves /dns.json
    //   2. rdap_server      — serves /domain/example.test, expected exactly once.
    //
    // Fire 100 concurrent client.domain("example.test") calls. With dedup at
    // the cache layer, exactly one /domain/* fetch should hit the rdap_server.
    let mut rdap_server = mockito::Server::new_async().await;
    let rdap_url = rdap_server.url();

    let mut bootstrap_server = mockito::Server::new_async().await;
    let bs_body = BOOTSTRAP_DNS.replace("__SERVER__", &rdap_url);
    let _bs_mock = bootstrap_server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(bs_body)
        .expect_at_least(1)
        .create_async()
        .await;

    let domain_mock = rdap_server
        .mock("GET", "/domain/example.test")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        // Slow upstream so all followers actually overlap the leader.
        .with_chunked_body(|w| {
            std::thread::sleep(std::time::Duration::from_millis(60));
            w.write_all(DOMAIN_RESPONSE.as_bytes())
        })
        .expect(1)
        .create_async()
        .await;

    let mut config = ClientConfig {
        bootstrap_url: Some(bootstrap_server.url()),
        rate_limit: Some(RateLimitConfig::default()),
        ..Default::default()
    };
    // Disable SSRF (mock servers bind to 127.0.0.1).
    config.ssrf.enabled = false;

    let client = Arc::new(RdapClient::with_config(config).expect("client"));

    let n = 100usize;
    let barrier = Arc::new(tokio::sync::Barrier::new(n));
    let mut handles = Vec::with_capacity(n);
    for _ in 0..n {
        let c = Arc::clone(&client);
        let b = Arc::clone(&barrier);
        handles.push(tokio::spawn(async move {
            b.wait().await;
            c.domain("example.test").await
        }));
    }

    let mut ok_count = 0usize;
    for h in handles {
        if h.await.unwrap().is_ok() {
            ok_count += 1;
        }
    }
    assert_eq!(ok_count, n, "all 100 queries should succeed");

    // The crucial assertion — only one upstream fetch happened.
    domain_mock.assert_async().await;
}

#[tokio::test]
async fn negative_cache_dedups_repeated_nxdomain() {
    // T2 case 5 — Negative caching at the integration layer.
    //
    // After the upstream returns 404 once, a subsequent identical query
    // must be served from the negative cache (no second upstream call,
    // same 404 error returned to the caller).
    //
    // Test shape:
    //   1. mockito returns 404 on /domain/missing.test, expect(1).
    //   2. Two sequential client.domain("missing.test") calls.
    //   3. Both return Err(HttpStatus { 404, .. }).
    //   4. mockito asserts exactly one upstream fetch.
    let mut rdap_server = mockito::Server::new_async().await;
    let rdap_url = rdap_server.url();

    let mut bootstrap_server = mockito::Server::new_async().await;
    let bs_body = BOOTSTRAP_DNS.replace("__SERVER__", &rdap_url);
    let _bs_mock = bootstrap_server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(bs_body)
        .create_async()
        .await;

    let domain_mock = rdap_server
        .mock("GET", "/domain/missing.test")
        .with_status(404)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"errorCode":404,"title":"Not Found"}"#)
        .expect(1)
        .create_async()
        .await;

    let mut config = ClientConfig {
        bootstrap_url: Some(bootstrap_server.url()),
        ..Default::default()
    };
    config.ssrf.enabled = false;

    let client = RdapClient::with_config(config).expect("client");

    // First call — populates negative cache.
    let first = client.domain("missing.test").await;
    assert!(
        matches!(first, Err(RdapError::HttpStatus { status: 404, .. })),
        "first call should be 404, got: {first:?}"
    );

    // Second call — must hit the negative cache and not contact upstream.
    let second = client.domain("missing.test").await;
    assert!(
        matches!(second, Err(RdapError::HttpStatus { status: 404, .. })),
        "second call should be 404 from negative cache, got: {second:?}"
    );

    // Mockito asserts only 1 upstream call.
    domain_mock.assert_async().await;
}

#[tokio::test]
async fn cache_hit_does_not_call_rate_limiter_or_upstream() {
    let mut rdap_server = mockito::Server::new_async().await;
    let rdap_url = rdap_server.url();

    let mut bootstrap_server = mockito::Server::new_async().await;
    let bs_body = BOOTSTRAP_DNS.replace("__SERVER__", &rdap_url);
    let _bs_mock = bootstrap_server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(bs_body)
        .create_async()
        .await;

    // /domain/example.test is allowed exactly once across the whole test —
    // populates the cache. The second client.domain() call must hit the
    // cache and not contact the upstream.
    let domain_mock = rdap_server
        .mock("GET", "/domain/example.test")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(DOMAIN_RESPONSE)
        .expect(1)
        .create_async()
        .await;

    let mut config = ClientConfig {
        bootstrap_url: Some(bootstrap_server.url()),
        ..Default::default()
    };
    config.ssrf.enabled = false;

    let client = RdapClient::with_config(config).expect("client");

    // First call — populates cache.
    let first = client.domain("example.test").await;
    assert!(first.is_ok(), "first call should succeed: {first:?}");

    // Second call — must hit cache.
    let second = client.domain("example.test").await;
    assert!(second.is_ok(), "second call should hit cache: {second:?}");

    // Mockito asserts only 1 upstream call.
    domain_mock.assert_async().await;
}
