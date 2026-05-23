//! Chaos tests — failure injection under adversarial conditions.
//!
//! These tests exercise the client's resilience when the network layer or
//! the remote RDAP server behaves in unexpected ways. Each scenario must be
//! handled **gracefully**: the client must return a typed `RdapError`, never
//! panic, and never deadlock.
//!
//! # Scenarios
//!
//! | Test                          | Failure injected                     | Expected outcome              |
//! |-------------------------------|--------------------------------------|-------------------------------|
//! | `chaos_corrupted_json`        | 200 with non-JSON body               | `ParseError`                  |
//! | `chaos_partial_json`          | 200 with truncated JSON              | `ParseError`                  |
//! | `chaos_empty_body`            | 200 with zero-byte body              | `ParseError` / `MissingClass` |
//! | `chaos_connection_reset`      | TCP connection immediately closed    | `Network`                     |
//! | `chaos_wrong_object_class`    | 200 with unknown objectClassName     | `UnknownObjectClass`          |
//! | `chaos_missing_object_class`  | 200 with no objectClassName field    | `MissingObjectClass`          |
//! | `chaos_timeout_then_recovery` | First call times out, second OK      | `Ok` after retry              |
//! | `chaos_rate_limit_spikes`     | N×429 then 200                       | `Ok` after retries            |
//! | `chaos_oversized_response`    | 200 with very large JSON body        | `ParseError` (size limit)     |

mod common;

use std::time::Duration;

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient, RdapError};
use wiremock::matchers::{method, path, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};

// ── Client builders ───────────────────────────────────────────────────────────

fn chaos_client(base: &str) -> RdapClient {
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
    .expect("chaos client")
}

fn chaos_client_retry(base: &str, max_attempts: u32, timeout_ms: u64) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(base.to_string()),
        cache: false,
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_millis(timeout_ms),
            max_attempts,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(10),
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("chaos client with retries")
}

async fn mount_bootstrap(server: &MockServer) {
    let uri = server.uri();
    Mock::given(method("GET"))
        .and(path("/dns.json"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(common::dns_bootstrap_json("com", &format!("{uri}/rdap"))),
        )
        .mount(server)
        .await;
}

// ── Scenario 1: Corrupted JSON ────────────────────────────────────────────────

#[tokio::test]
async fn chaos_corrupted_json_does_not_panic() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .append_header("content-type", "application/rdap+json")
                .set_body_bytes(b"} this is not json at all { garbage !!!"),
        )
        .mount(&server)
        .await;

    let client = chaos_client(&server.uri());
    let result = client.domain("corrupt.com").await;

    assert!(
        result.is_err(),
        "corrupted JSON must yield an error, not Ok"
    );
    // Must not panic — the test reaching here proves that.
}

// ── Scenario 2: Partial / truncated response ──────────────────────────────────

#[tokio::test]
async fn chaos_partial_json_does_not_panic() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // Truncated at an arbitrary byte offset — JSON parser must fail gracefully.
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .append_header("content-type", "application/rdap+json")
                // Cut off mid-key to guarantee a parse failure.
                .set_body_bytes(b"{\"objectClassName\": \"do"),
        )
        .mount(&server)
        .await;

    let client = chaos_client(&server.uri());
    let result = client.domain("partial.com").await;

    assert!(result.is_err(), "truncated JSON must yield an error");
}

// ── Scenario 3: Empty body ────────────────────────────────────────────────────

#[tokio::test]
async fn chaos_empty_body_does_not_panic() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .append_header("content-type", "application/rdap+json")
                .set_body_bytes(b""),
        )
        .mount(&server)
        .await;

    let client = chaos_client(&server.uri());
    let result = client.domain("empty.com").await;

    assert!(result.is_err(), "empty body must yield an error");
}

// ── Scenario 4: Connection reset ──────────────────────────────────────────────

/// Spawn a raw TCP server that accepts connections and immediately closes them,
/// simulating an abrupt connection reset by the peer.
async fn spawn_resetting_server() -> String {
    use tokio::net::TcpListener;

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            // Drop immediately — OS will send RST to the client.
            drop(stream);
        }
    });
    format!("http://127.0.0.1:{}", addr.port())
}

#[tokio::test]
async fn chaos_connection_reset_does_not_panic() {
    let reset_url = spawn_resetting_server().await;

    // Bootstrap points the client at the resetting TCP server for RDAP queries.
    let bootstrap = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/dns.json"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::dns_bootstrap_json("com", &reset_url)),
        )
        .mount(&bootstrap)
        .await;

    let client = chaos_client(&bootstrap.uri());
    let result = client.domain("reset.com").await;

    assert!(result.is_err(), "connection reset must yield an error");
    assert!(
        matches!(
            result.unwrap_err(),
            RdapError::Network(_) | RdapError::Timeout { .. }
        ),
        "connection reset must be classified as Network or Timeout error"
    );
}

// ── Scenario 5: Unknown objectClassName ──────────────────────────────────────

#[tokio::test]
async fn chaos_unknown_object_class_does_not_panic() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "objectClassName": "totally-unknown-class",
            "handle": "XYZ-123",
        })))
        .mount(&server)
        .await;

    let client = chaos_client(&server.uri());
    let result = client.domain("unknown-class.com").await;

    assert!(
        result.is_err(),
        "unknown objectClassName must yield an error"
    );
    assert!(
        matches!(
            result.unwrap_err(),
            RdapError::UnknownObjectClass { .. } | RdapError::ParseError { .. }
        ),
        "must be classified as UnknownObjectClass or ParseError"
    );
}

// ── Scenario 6: Missing objectClassName ──────────────────────────────────────

#[tokio::test]
async fn chaos_missing_object_class_does_not_panic() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "handle": "MISSING-1",
            "ldhName": "missing.com",
        })))
        .mount(&server)
        .await;

    let client = chaos_client(&server.uri());
    let result = client.domain("missing.com").await;

    assert!(
        result.is_err(),
        "missing objectClassName must yield an error"
    );
    assert!(
        matches!(
            result.unwrap_err(),
            RdapError::MissingObjectClass | RdapError::ParseError { .. }
        ),
        "must be classified as MissingObjectClass or ParseError"
    );
}

// ── Scenario 7: Timeout then recovery ────────────────────────────────────────

/// The first RDAP request times out; the second (retry) succeeds.
/// Verifies that `Timeout` is classified as retryable.
#[tokio::test]
async fn chaos_timeout_then_recovery_succeeds() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // First call: 2 s delay with a 200 ms client timeout → times out
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_delay(Duration::from_secs(2))
                .set_body_json(common::domain_rdap_response("recover.com")),
        )
        .up_to_n_times(1)
        .mount(&server)
        .await;

    // Second call: no delay → succeeds
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::domain_rdap_response("recover.com")),
        )
        .mount(&server)
        .await;

    // 200 ms timeout, 2 attempts — first times out (retryable), second succeeds.
    let client = chaos_client_retry(&server.uri(), 2, 200);
    let result = client.domain("recover.com").await;

    assert!(
        result.is_ok(),
        "must succeed on second attempt after timeout: {result:?}"
    );
}

// ── Scenario 8: Rate limit spikes then recovery ───────────────────────────────

/// Simulates a burst of 429 responses followed by successful recovery.
/// Verifies that 429 is retried and that the client eventually succeeds.
#[tokio::test]
async fn chaos_rate_limit_spike_then_recovery() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    const SPIKE: u64 = 3; // number of 429s before recovery

    // First SPIKE calls: 429
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(ResponseTemplate::new(429))
        .up_to_n_times(SPIKE)
        .mount(&server)
        .await;

    // After spike: 200 OK
    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(common::domain_rdap_response("rate-ok.com")),
        )
        .mount(&server)
        .await;

    // max_attempts = SPIKE + 1 to allow recovery
    let client = chaos_client_retry(&server.uri(), SPIKE as u32 + 1, 5_000);
    let result = client.domain("rate-ok.com").await;

    assert!(
        result.is_ok(),
        "must recover after {SPIKE} rate-limit responses: {result:?}"
    );
}

// ── Scenario 9: Oversized response body ──────────────────────────────────────

/// A response body that exceeds `RdapValidationLimits::max_body_bytes` must
/// be rejected with a validation or parse error — not silently accepted.
#[tokio::test]
async fn chaos_oversized_response_is_rejected() {
    use rdap_core::validation::RdapValidationLimits;

    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // Build a response that overflows the default max_body_bytes limit.
    // Default limit is typically in the MB range; we generate a 4 MB string field.
    let huge_string = "x".repeat(4 * 1024 * 1024); // 4 MB
    let oversized = serde_json::json!({
        "objectClassName": "domain",
        "ldhName": "big.com",
        "remarks": [{ "description": [huge_string] }],
    });

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .append_header("content-type", "application/rdap+json")
                .set_body_json(oversized),
        )
        .mount(&server)
        .await;

    // Configure a tight body size limit
    let tight_limits = RdapValidationLimits {
        max_json_size: 1024, // 1 KB — far below our 4 MB payload
        ..Default::default()
    };

    let client = RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(server.uri()),
        cache: false,
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(10),
            max_attempts: 1,
            validation_limits: tight_limits,
            ..Default::default()
        },
        ..Default::default()
    })
    .expect("client with tight limits");

    let result = client.domain("big.com").await;
    assert!(result.is_err(), "oversized response must be rejected");
}

// ── Scenario 10: Deeply nested JSON ──────────────────────────────────────────

/// Deeply nested JSON must be handled without a stack overflow.
/// `serde_json` enforces a recursion limit so this should return a parse error,
/// not a crash.
#[tokio::test]
async fn chaos_deeply_nested_json_does_not_crash() {
    let server = MockServer::start().await;
    mount_bootstrap(&server).await;

    // Build 200 levels of nesting — safely above serde_json's 128-level limit.
    let mut nested = serde_json::json!({ "leaf": true });
    for _ in 0..200 {
        nested = serde_json::json!({ "child": nested });
    }

    Mock::given(method("GET"))
        .and(path_regex(r"^/rdap/domain/.*$"))
        .respond_with(
            ResponseTemplate::new(200)
                .append_header("content-type", "application/rdap+json")
                .set_body_json(nested),
        )
        .mount(&server)
        .await;

    let client = chaos_client(&server.uri());
    let result = client.domain("deep.com").await;

    // serde_json rejects depth > 128 with a parse error.
    assert!(
        result.is_err(),
        "deeply nested JSON must be rejected or handled gracefully"
    );
    // The test reaching here proves no stack overflow or panic occurred.
}
