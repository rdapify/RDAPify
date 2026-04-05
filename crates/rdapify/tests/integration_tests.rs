//! End-to-end integration tests using a local mock server.
//!
//! Each test:
//! 1. Starts a mock HTTP server (mockito).
//! 2. Points the client's bootstrap URL to the mock.
//! 3. Mocks both the bootstrap file and the RDAP endpoint.
//! 4. Verifies the normalised response.
//!
//! No real network calls are made — all tests run offline.

mod common;

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient, RdapError};

use std::time::Duration;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Builds a client that:
/// - uses `bootstrap_base` as the IANA bootstrap base URL
/// - has SSRF disabled (mock server runs on localhost)
/// - has a short timeout (tests should be fast)
/// - has caching disabled (avoids cross-test pollution)
fn test_client(bootstrap_base: &str) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(bootstrap_base.to_string()),
        cache: false,
        ssrf: SsrfConfig {
            enabled: false, // mock server is on localhost
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(5),
            max_attempts: 1,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("test client construction failed")
}

// ── Domain ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn domain_query_returns_normalised_response() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // Bootstrap: "com" → this mock server
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    // RDAP domain endpoint
    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("example.com").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client
        .domain("example.com")
        .await
        .expect("domain query failed");

    assert_eq!(res.query, "example.com");
    assert_eq!(res.ldh_name.as_deref(), Some("example.com"));
    assert!(
        !res.nameservers.is_empty(),
        "nameservers should not be empty"
    );
    assert!(
        res.nameservers.contains(&"ns1.example.com".to_string()),
        "expected ns1.example.com in nameservers"
    );
    assert!(res.registrar.is_some(), "registrar should be present");
    assert_eq!(
        res.registrar.as_ref().unwrap().name.as_deref(),
        Some("Test Registrar Inc.")
    );
    assert_eq!(res.expiration_date(), Some("2025-08-13T04:00:00Z"));
    assert_eq!(res.registration_date(), Some("1995-08-14T04:00:00Z"));
    assert!(!res.meta.cached, "response should not be cached");
}

#[tokio::test]
async fn domain_query_normalises_idn() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    // "пример.com" → idna crate produces "xn--e1afmkfd.com"
    server
        .mock("GET", "/rdap/domain/xn--e1afmkfd.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("xn--e1afmkfd.com").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client
        .domain("пример.com")
        .await
        .expect("IDN domain query failed");

    assert_eq!(res.query, "xn--e1afmkfd.com");
}

#[tokio::test]
async fn domain_query_no_server_for_tld() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // Bootstrap returns empty services
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"version":"1.0","publication":"2024-01-01T00:00:00Z","description":"","services":[]}"#)
        .create_async()
        .await;

    let client = test_client(&base);
    let err = client.domain("example.xyz").await.unwrap_err();

    assert!(
        matches!(err, RdapError::NoServerFound { .. }),
        "expected NoServerFound, got: {err}"
    );
}

#[tokio::test]
async fn domain_query_rdap_server_404() {
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
        .mock("GET", "/rdap/domain/notfound.com")
        .with_status(404)
        .create_async()
        .await;

    let client = test_client(&base);
    let err = client.domain("notfound.com").await.unwrap_err();

    assert!(
        matches!(err, RdapError::HttpStatus { status: 404, .. }),
        "expected HttpStatus(404), got: {err}"
    );
}

// ── IP ────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn ip_query_returns_normalised_response() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/ipv4.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::ipv4_bootstrap_json("8.0.0.0/8", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/ip/8.8.8.8")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::ip_rdap_response("8.8.8.0", "8.8.8.255", "US").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client.ip("8.8.8.8").await.expect("IP query failed");

    assert_eq!(res.query, "8.8.8.8");
    assert_eq!(res.start_address.as_deref(), Some("8.8.8.0"));
    assert_eq!(res.country.as_deref(), Some("US"));
    assert_eq!(res.ip_version.as_ref(), Some(&rdapify::IpVersion::V4));
}

#[tokio::test]
async fn ip_query_rejects_invalid_input() {
    // No mock needed — validation happens before any network call.
    let client = RdapClient::new().expect("client construction failed");
    let err = client.ip("not-an-ip").await.unwrap_err();
    assert!(
        matches!(err, RdapError::InvalidInput(_)),
        "expected InvalidInput, got: {err}"
    );
}

// ── ASN ───────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn asn_query_accepts_numeric_string() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/asn.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::asn_bootstrap_json("15169-15169", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/autnum/15169")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::asn_rdap_response(15169, 15169, "GOOGLE").to_string())
        .create_async()
        .await;

    let client = test_client(&base);

    // Both "15169" and "AS15169" should work
    let res1 = client.asn("15169").await.expect("ASN numeric query failed");
    assert_eq!(res1.query, 15169);
    assert_eq!(res1.name.as_deref(), Some("GOOGLE"));
    assert_eq!(res1.country.as_deref(), Some("US"));
}

#[tokio::test]
async fn asn_query_accepts_as_prefix() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/asn.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::asn_bootstrap_json("15169-15169", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/autnum/15169")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::asn_rdap_response(15169, 15169, "GOOGLE").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client
        .asn("AS15169")
        .await
        .expect("AS-prefixed query failed");
    assert_eq!(res.query, 15169);
}

#[tokio::test]
async fn asn_query_rejects_invalid_input() {
    let client = RdapClient::new().expect("client construction failed");
    let err = client.asn("not-a-number").await.unwrap_err();
    assert!(matches!(err, RdapError::InvalidInput(_)));
}

// ── Nameserver ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn nameserver_query_returns_ip_addresses() {
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
        .mock("GET", "/rdap/nameserver/ns1.google.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::nameserver_rdap_response("ns1.google.com").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client
        .nameserver("ns1.google.com")
        .await
        .expect("nameserver query failed");

    assert_eq!(res.query, "ns1.google.com");
    assert_eq!(res.ldh_name.as_deref(), Some("ns1.google.com"));
    assert!(
        res.ip_addresses.v4.contains(&"8.8.8.8".to_string()),
        "expected 8.8.8.8 in IPv4 addresses"
    );
    assert!(!res.ip_addresses.v6.is_empty(), "expected IPv6 addresses");
}

// ── Entity ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn entity_query_returns_handle_and_roles() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/rdap/entity/ARIN-HN-1")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::entity_rdap_response("ARIN-HN-1").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let server_url = format!("{base}/rdap");
    let res = client
        .entity("ARIN-HN-1", &server_url)
        .await
        .expect("entity query failed");

    assert_eq!(res.query, "ARIN-HN-1");
    assert_eq!(res.handle.as_deref(), Some("ARIN-HN-1"));
    assert!(!res.roles.is_empty(), "roles should not be empty");
}

#[tokio::test]
async fn entity_query_rejects_empty_handle() {
    let client = RdapClient::new().expect("client construction failed");
    let err = client
        .entity("", "https://rdap.arin.net/registry")
        .await
        .unwrap_err();
    assert!(matches!(err, RdapError::InvalidInput(_)));
}

#[tokio::test]
async fn entity_query_rejects_empty_server_url() {
    let client = RdapClient::new().expect("client construction failed");
    let err = client.entity("ARIN-HN-1", "").await.unwrap_err();
    assert!(matches!(err, RdapError::InvalidInput(_)));
}

// ── SSRF protection ───────────────────────────────────────────────────────────

#[tokio::test]
async fn ssrf_blocks_private_ip_in_entity_server_url() {
    // Default client has SSRF enabled
    let client = RdapClient::new().expect("client construction failed");

    let err = client
        .entity("SOME-HANDLE", "https://192.168.1.1/rdap")
        .await
        .unwrap_err();

    assert!(err.is_ssrf_blocked(), "expected SSRF block for private IP");
}

#[tokio::test]
async fn ssrf_blocks_http_scheme() {
    let client = RdapClient::new().expect("client construction failed");
    let err = client
        .entity("SOME-HANDLE", "http://rdap.arin.net/registry")
        .await
        .unwrap_err();
    assert!(err.is_ssrf_blocked() || matches!(err, RdapError::InsecureScheme { .. }));
}

// ── Cache ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn cache_serves_second_request_without_network_call() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // Bootstrap called once
    let dns_mock = server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .expect(1) // bootstrap fetched once per client lifetime (cached in Bootstrap)
        .create_async()
        .await;

    // RDAP endpoint called exactly once
    let rdap_mock = server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("example.com").to_string())
        .expect(1) // served once — second call comes from cache
        .create_async()
        .await;

    // Cache-enabled client
    let client = RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(base.clone()),
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
    .expect("client construction failed");

    let res1 = client
        .domain("example.com")
        .await
        .expect("first query failed");
    let res2 = client
        .domain("example.com")
        .await
        .expect("second query failed");

    // First call is not cached, second is
    assert!(!res1.meta.cached, "first response should not be cached");
    assert!(res2.meta.cached, "second response should be cached");

    // Verify mock call counts
    dns_mock.assert_async().await;
    rdap_mock.assert_async().await;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn bootstrap_returns_error_on_server_failure() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(503)
        .create_async()
        .await;

    let client = test_client(&base);
    let err = client.domain("example.com").await.unwrap_err();

    assert!(
        matches!(err, RdapError::HttpStatus { status: 503, .. }),
        "expected HttpStatus(503), got: {err}"
    );
}

// ── domain_available ──────────────────────────────────────────────────────────

#[tokio::test]
async fn domain_available_returns_false_for_registered_domain() {
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
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("example.com").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client
        .domain_available("example.com")
        .await
        .expect("domain_available failed");

    assert_eq!(res.domain, "example.com");
    assert!(!res.available);
    assert_eq!(res.expires_at.as_deref(), Some("2025-08-13T04:00:00Z"));
}

#[tokio::test]
async fn domain_available_returns_true_on_404() {
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
        .mock("GET", "/rdap/domain/free-domain-xyz.com")
        .with_status(404)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"errorCode":404,"title":"Not Found"}"#)
        .create_async()
        .await;

    let client = test_client(&base);
    let res = client
        .domain_available("free-domain-xyz.com")
        .await
        .expect("domain_available failed");

    assert_eq!(res.domain, "free-domain-xyz.com");
    assert!(res.available);
    assert!(res.expires_at.is_none());
}

#[tokio::test]
async fn domain_available_propagates_non_404_errors() {
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
        .mock("GET", "/rdap/domain/error.com")
        .with_status(500)
        .create_async()
        .await;

    let client = test_client(&base);
    let err = client.domain_available("error.com").await.unwrap_err();

    assert!(
        matches!(err, RdapError::HttpStatus { status: 500, .. }),
        "expected HttpStatus(500), got: {err}"
    );
}

// ── domain_available_batch ────────────────────────────────────────────────────

#[tokio::test]
async fn domain_available_batch_returns_results_for_each_domain() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    // registered.com → 200 (not available)
    server
        .mock("GET", "/rdap/domain/registered.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("registered.com").to_string())
        .create_async()
        .await;

    // free-batch.com → 404 (available)
    server
        .mock("GET", "/rdap/domain/free-batch.com")
        .with_status(404)
        .with_header("content-type", "application/rdap+json")
        .with_body(r#"{"errorCode":404,"title":"Not Found"}"#)
        .create_async()
        .await;

    let client = test_client(&base);
    let results = client
        .domain_available_batch(
            vec!["registered.com".to_string(), "free-batch.com".to_string()],
            None,
        )
        .await;

    assert_eq!(results.len(), 2);
    let r0 = results[0].as_ref().expect("registered.com lookup failed");
    assert!(!r0.available);

    let r1 = results[1].as_ref().expect("free-batch.com lookup failed");
    assert!(r1.available);
}

// ── Input validation (client.rs coverage) ────────────────────────────────────

#[tokio::test]
async fn invalid_domain_returns_invalid_input_error() {
    let client = test_client("https://data.iana.org/rdap");
    let err = client.domain("").await.unwrap_err();
    assert!(matches!(err, RdapError::InvalidInput(_)), "got: {err}");
}

#[tokio::test]
async fn invalid_ip_returns_invalid_input_error() {
    let client = test_client("https://data.iana.org/rdap");
    let err = client.ip("not-an-ip").await.unwrap_err();
    assert!(matches!(err, RdapError::InvalidInput(_)), "got: {err}");
}

#[tokio::test]
async fn invalid_asn_returns_invalid_input_error() {
    let client = test_client("https://data.iana.org/rdap");
    let err = client.asn("not-a-number").await.unwrap_err();
    assert!(matches!(err, RdapError::InvalidInput(_)), "got: {err}");
}

#[tokio::test]
async fn client_with_cache_disabled_does_not_cache() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .expect(2) // bootstrap fetched twice — no caching
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("example.com").to_string())
        .expect(2)
        .create_async()
        .await;

    use rdapify::http::FetcherConfig;
    use rdapify::security::SsrfConfig;
    use std::time::Duration;

    let client = RdapClient::with_config(ClientConfig {
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
        custom_bootstrap_servers: Default::default(),
        ..Default::default()
    })
    .expect("client build failed");

    client
        .domain("example.com")
        .await
        .expect("first call failed");
    let res = client
        .domain("example.com")
        .await
        .expect("second call failed");

    assert!(
        !res.meta.cached,
        "response should not be cached when cache is disabled"
    );
}

#[tokio::test]
async fn client_with_max_attempts_1_does_not_retry() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .create_async()
        .await;

    // Return 503 exactly once; if retry happened, mockito would return 404 on
    // the second attempt (unmatched) which would change the error type.
    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(503)
        .expect(1)
        .create_async()
        .await;

    use rdapify::http::FetcherConfig;
    use rdapify::security::SsrfConfig;
    use std::time::Duration;

    let client = RdapClient::with_config(ClientConfig {
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
        custom_bootstrap_servers: Default::default(),
        ..Default::default()
    })
    .expect("client build failed");

    let err = client.domain("example.com").await.unwrap_err();
    assert!(
        matches!(err, RdapError::HttpStatus { status: 503, .. }),
        "got: {err}"
    );
}

// ── Custom bootstrap servers ──────────────────────────────────────────────────

#[tokio::test]
async fn custom_bootstrap_server_used_without_iana_fetch() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // IANA bootstrap should NOT be fetched — custom server takes priority
    // (no mock for /dns.json)

    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("example.com").to_string())
        .create_async()
        .await;

    use rdapify::http::FetcherConfig;
    use rdapify::security::SsrfConfig;
    use std::collections::HashMap;
    use std::time::Duration;

    let mut custom = HashMap::new();
    custom.insert("com".to_string(), format!("{base}/rdap"));

    let client = RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(format!("{base}/THIS_SHOULD_NOT_BE_CALLED")),
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
        custom_bootstrap_servers: custom,
        ..Default::default()
    })
    .expect("client build failed");

    let res = client.domain("example.com").await.expect("query failed");
    assert_eq!(res.query, "example.com");
}

// ── Streaming API ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn stream_domain_yields_results_for_all_queries() {
    use rdapify::{DomainEvent, StreamConfig};
    use tokio_stream::StreamExt;

    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // Bootstrap for "com" TLD
    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .expect_at_least(1)
        .create_async()
        .await;

    // RDAP endpoints for two domains
    for domain in &["example.com", "test.com"] {
        server
            .mock("GET", format!("/rdap/domain/{domain}").as_str())
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(common::domain_rdap_response(domain).to_string())
            .create_async()
            .await;
    }

    let client = test_client(&base);
    let names = vec!["example.com".to_string(), "test.com".to_string()];
    let mut stream = client.stream_domain(names, StreamConfig::default());

    let mut results: Vec<DomainEvent> = Vec::new();
    while let Some(event) = stream.next().await {
        results.push(event);
    }

    assert_eq!(results.len(), 2);
    assert!(results.iter().all(|e| matches!(e, DomainEvent::Result(_))));
}

#[tokio::test]
async fn stream_domain_isolates_individual_errors() {
    use rdapify::{DomainEvent, StreamConfig};
    use tokio_stream::StreamExt;

    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .expect_at_least(1)
        .create_async()
        .await;

    // First domain succeeds, second returns 404
    server
        .mock("GET", "/rdap/domain/example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::domain_rdap_response("example.com").to_string())
        .create_async()
        .await;

    server
        .mock("GET", "/rdap/domain/notfound.com")
        .with_status(404)
        .with_header("content-type", "application/json")
        .with_body(r#"{"errorCode":404,"title":"Not Found"}"#)
        .create_async()
        .await;

    let client = test_client(&base);
    let names = vec!["example.com".to_string(), "notfound.com".to_string()];
    let mut stream = client.stream_domain(names, StreamConfig::default());

    let mut ok_count = 0usize;
    let mut err_count = 0usize;

    while let Some(event) = stream.next().await {
        match event {
            DomainEvent::Result(_) => ok_count += 1,
            DomainEvent::Error { .. } => err_count += 1,
        }
    }

    assert_eq!(ok_count, 1);
    assert_eq!(err_count, 1);
}

#[tokio::test]
async fn stream_domain_cancel_mid_stream_does_not_panic() {
    use rdapify::{DomainEvent, StreamConfig};
    use tokio_stream::StreamExt;

    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    server
        .mock("GET", "/dns.json")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(common::dns_bootstrap_json("com", &format!("{base}/rdap")).to_string())
        .expect_at_least(0)
        .create_async()
        .await;

    for domain in &["a.com", "b.com", "c.com", "d.com", "e.com"] {
        server
            .mock("GET", format!("/rdap/domain/{domain}").as_str())
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(common::domain_rdap_response(domain).to_string())
            .expect_at_least(0)
            .create_async()
            .await;
    }

    let client = test_client(&base);
    let names: Vec<String> = vec!["a.com", "b.com", "c.com", "d.com", "e.com"]
        .into_iter()
        .map(String::from)
        .collect();

    let mut stream = client.stream_domain(names, StreamConfig::default());

    // Take only the first result then drop the stream — must not panic.
    let first = stream.next().await;
    drop(stream);

    // We got something (success or error) — the stream worked
    assert!(first.is_some());
}

// ── Connection Pool ───────────────────────────────────────────────────────────

#[tokio::test]
async fn client_config_accepts_connection_pool_settings() {
    // Structural: verify RdapClient builds with non-default pool settings
    let client = RdapClient::with_config(ClientConfig {
        reuse_connections: false,
        max_connections_per_host: 1,
        ..Default::default()
    });
    assert!(
        client.is_ok(),
        "client build should succeed with pool config"
    );
}

#[tokio::test]
async fn fetcher_config_reuse_connections_default_is_true() {
    let config = FetcherConfig::default();
    assert!(config.reuse_connections);
    assert_eq!(config.max_connections_per_host, 10);
}
