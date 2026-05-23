//! Network simulation tests — verify client behaviour against a live HTTP mock.
//!
//! Uses [`wiremock`] to drive a real Hyper-backed HTTP server that can:
//! - Return arbitrary status codes
//! - Inject configurable response delays (for timeout testing)
//! - Count and verify the exact number of requests received
//!
//! Every test scenario uses two mock routes on the same server:
//!   `/dns.json`     — bootstrap discovery (returns a pointer to itself)
//!   `/rdap/…`       — the actual RDAP endpoint under test
//!
//! # Scenarios covered
//!
//! | Test                           | Server behaviour          | Expected outcome              |
//! |--------------------------------|---------------------------|-------------------------------|
//! | `sim_200_ok`                   | 200 + valid JSON          | `Ok(DomainResponse)`          |
//! | `sim_404_not_found`            | 404                       | `HttpStatus { 404 }`          |
//! | `sim_500_exhausts_retries`     | 500 (always)              | `HttpStatus { 500 }`, 3 calls |
//! | `sim_429_exhausts_retries`     | 429 (always)              | `HttpStatus { 429 }`, 3 calls |
//! | `sim_timeout`                  | 60 s delay                | `Timeout { … }`               |
//! | `sim_slow_within_timeout`      | 50 ms delay, 1 s limit    | `Ok(DomainResponse)`          |
//! | `sim_500_then_200_succeeds`    | 500 × 1, then 200         | `Ok` after 1 retry            |

mod common;

use std::time::Duration;

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient, RdapError};
use wiremock::matchers::{method, path, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};

// ── Test client builders ──────────────────────────────────────────────────────

/// Client with no retries, 5 s timeout — for basic happy/sad-path tests.
fn sim_client(base: &str) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(base.to_string()),
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
    .expect("test client")
}

/// Client with `n` retry attempts and minimal backoff — for retry-path tests.
fn sim_client_retry(base: &str, max_attempts: u32) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(base.to_string()),
        cache: false,
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(5),
            max_attempts,
            initial_backoff: Duration::from_millis(1), // fast retries in tests
            max_backoff: Duration::from_millis(10),
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("test client with retries")
}

/// Client with a very short timeout — for timeout-path tests.
fn sim_client_short_timeout(base: &str, timeout_ms: u64) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(base.to_string()),
        cache: false,
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_millis(timeout_ms),
            max_attempts: 1,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("test client short-timeout")
}

// ── Bootstrap helper ──────────────────────────────────────────────────────────

/// Mounts the bootstrap `/dns.json` route on `server`.
///
/// The returned RDAP base URL is `{server_uri}/rdap`, which means all domain
/// queries will be routed to `/rdap/domain/<name>` on the same mock server.
async fn mount_bootstrap(server: &MockServer) {
    let uri = server.uri();
    let rdap_base = format!("{uri}/rdap");
    Mock::given(method("GET"))
        .and(path("/dns.json"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::dns_bootstrap_json("com", &rdap_base)),
        )
        .mount(server)
        .await;
}

// ── Scenario: 200 OK ──────────────────────────────────────────────────────────

#[tokio::test]
async fn sim_200_ok_returns_domain_response() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::domain_rdap_response("example.com")),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = sim_client(&server.uri());
    let result = client.domain("example.com").await;
    assert!(
        result.is_ok(),
        "200 OK must yield Ok(DomainResponse), got: {result:?}"
    );
    assert_eq!(result.unwrap().query, "example.com");
}

// ── Scenario: 404 Not Found ───────────────────────────────────────────────────

#[tokio::test]
async fn sim_404_not_found_returns_http_status_error() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(404))
        .expect(1) // 404 is non-retryable — exactly one attempt
        .mount(&server)
        .await;

    let client = sim_client(&server.uri());
    let result = client.domain("notfound.com").await;
    assert!(result.is_err(), "404 must yield an error");
    match result.unwrap_err() {
        RdapError::HttpStatus { status, .. } => {
            assert_eq!(status, 404, "error must carry HTTP 404 status");
        }
        other => panic!("expected HttpStatus(404), got: {other:?}"),
    }
}

// ── Scenario: 500 exhausts retries ───────────────────────────────────────────

#[tokio::test]
async fn sim_500_exhausts_all_retries() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    const MAX_ATTEMPTS: u32 = 3;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(500))
        .expect(MAX_ATTEMPTS as u64) // retryable — must be called exactly 3 times
        .mount(&server)
        .await;

    let client = sim_client_retry(&server.uri(), MAX_ATTEMPTS);
    let result = client.domain("error.com").await;
    assert!(result.is_err(), "persistent 500 must yield an error");
    match result.unwrap_err() {
        RdapError::HttpStatus { status, .. } => {
            assert_eq!(status, 500);
        }
        other => panic!("expected HttpStatus(500) after retries, got: {other:?}"),
    }
    // wiremock verifies expect(3) on drop — so 3 RDAP calls are confirmed.
}

// ── Scenario: 429 exhausts retries ───────────────────────────────────────────

#[tokio::test]
async fn sim_429_rate_limited_exhausts_retries() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    const MAX_ATTEMPTS: u32 = 3;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(429))
        .expect(MAX_ATTEMPTS as u64)
        .mount(&server)
        .await;

    let client = sim_client_retry(&server.uri(), MAX_ATTEMPTS);
    let result = client.domain("throttled.com").await;
    assert!(result.is_err(), "persistent 429 must yield an error");
    match result.unwrap_err() {
        RdapError::HttpStatus { status, .. } => {
            assert_eq!(status, 429, "error must carry HTTP 429 status");
        }
        other => panic!("expected HttpStatus(429) after retries, got: {other:?}"),
    }
}

// ── Scenario: transient 500 — success after one retry ────────────────────────

#[tokio::test]
async fn sim_transient_500_succeeds_after_retry() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // First call → 500
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(500))
        .up_to_n_times(1)
        .mount(&server)
        .await;

    // Second call → 200 OK
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::domain_rdap_response("retry.com")),
        )
        .mount(&server)
        .await;

    let client = sim_client_retry(&server.uri(), 3);
    let result = client.domain("retry.com").await;
    assert!(
        result.is_ok(),
        "must succeed after one transient 500: {result:?}"
    );
}

// ── Scenario: timeout ─────────────────────────────────────────────────────────

#[tokio::test]
async fn sim_timeout_returns_timeout_error() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // Respond after 5 seconds — far beyond the 100 ms client timeout.
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_delay(Duration::from_secs(5))
                .set_body_json(common::domain_rdap_response("slow.com")),
        )
        .mount(&server)
        .await;

    let client = sim_client_short_timeout(&server.uri(), 100); // 100 ms timeout
    let result = client.domain("slow.com").await;
    assert!(result.is_err(), "delayed response must time out");
    match result.unwrap_err() {
        RdapError::Timeout { .. } => {} // expected
        RdapError::Network(_) => {}     // reqwest may report network error on timeout
        other => panic!("expected Timeout error, got: {other:?}"),
    }
}

// ── Scenario: slow response within timeout ────────────────────────────────────

#[tokio::test]
async fn sim_slow_response_within_timeout_succeeds() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // 50 ms delay — well within the 2 s client timeout.
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_delay(Duration::from_millis(50))
                .set_body_json(common::domain_rdap_response("slow-ok.com")),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = sim_client_short_timeout(&server.uri(), 2_000); // 2 s timeout
    let result = client.domain("slow-ok.com").await;
    assert!(
        result.is_ok(),
        "response within timeout must succeed: {result:?}"
    );
}

// ── Scenario: IP lookup 200 OK ────────────────────────────────────────────────

#[tokio::test]
async fn sim_ip_lookup_200_ok() {
    let server = MockServer::start().await;

    let uri = server.uri();
    Mock::given(method("GET"))
        .and(path("/ipv4.json"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::ipv4_bootstrap_json(
                "8.0.0.0/8",
                &format!("{uri}/rdap"),
            )),
        )
        .mount(&server)
        .await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/ip/.*$"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::ip_rdap_response(
                "8.8.8.0",
                "8.8.8.255",
                "US",
            )),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(uri),
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
    .expect("test client");

    let result = client.ip("8.8.8.8").await;
    assert!(result.is_ok(), "IP lookup must succeed: {result:?}");
}

// ── Scenario: ASN lookup 200 OK ───────────────────────────────────────────────

#[tokio::test]
async fn sim_asn_lookup_200_ok() {
    let server = MockServer::start().await;

    let uri = server.uri();
    Mock::given(method("GET"))
        .and(path("/asn.json"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::asn_bootstrap_json(
                "15169-15169",
                &format!("{uri}/rdap"),
            )),
        )
        .mount(&server)
        .await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/autnum/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(common::asn_rdap_response(15169, 15169, "GOOGLE")),
        )
        .expect(1)
        .mount(&server)
        .await;

    let client = RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(uri),
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
    .expect("test client");

    let result = client.asn("15169").await;
    assert!(result.is_ok(), "ASN lookup must succeed: {result:?}");
}

// ── Scenario: error classification ───────────────────────────────────────────

#[tokio::test]
async fn sim_error_codes_are_classified_correctly() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // Serve a different status code based on the requested domain name.
    // We encode the status in the subdomain: e.g. "code404.com" → 404.
    for &code in &[400u16, 401, 403, 404] {
        Mock::given(method("GET"))
            .and(path(format!("/rdap/domain/code{code}.com")))
            .respond_with(ResponseTemplate::new(code))
            .mount(&server)
            .await;
    }

    let client = sim_client(&server.uri());

    for &code in &[400u16, 401, 403, 404] {
        let domain = format!("code{code}.com");
        let result = client.domain(&domain).await;
        assert!(result.is_err(), "HTTP {code} must yield an error");
        match result.unwrap_err() {
            RdapError::HttpStatus { status, .. } => {
                assert_eq!(status, code, "error status must match HTTP {code}");
            }
            other => panic!("HTTP {code}: expected HttpStatus, got: {other:?}"),
        }
    }
}
