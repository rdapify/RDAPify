//! Unit tests for the streaming API (stream_asn, stream_nameserver).
//!
//! Tests are designed to run fully offline — no live network calls.
//! They verify:
//! - Correct event count per input.
//! - Graceful cancellation (dropping the stream must not panic).
//! - Error events are yielded instead of panicking on bad input.

mod common;

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{AsnEvent, ClientConfig, NameserverEvent, RdapClient, StreamConfig};
use std::time::Duration;
use tokio_stream::StreamExt;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn test_client(bootstrap_base: &str) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(bootstrap_base.to_string()),
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
    .expect("test client construction failed")
}

// ── stream_asn ────────────────────────────────────────────────────────────────

/// Dropping the stream immediately must not panic or deadlock.
#[tokio::test]
async fn stream_asn_cancel_before_completion() {
    let client = RdapClient::default();
    let config = StreamConfig { buffer_size: 1 };
    let stream = client.stream_asn(
        vec!["AS1".to_string(), "AS2".to_string(), "AS3".to_string()],
        config,
    );
    // Drop immediately — background task should exit cleanly.
    drop(stream);
}

/// An invalid ASN string must yield an `AsnEvent::Error`, not a panic.
#[tokio::test]
async fn stream_asn_error_does_not_stop_stream() {
    let client = RdapClient::default();
    let config = StreamConfig::default();
    let stream = client.stream_asn(vec!["INVALID_ASN_FORMAT".to_string()], config);
    let results: Vec<_> = stream.collect().await;
    assert_eq!(results.len(), 1, "stream must yield exactly one event");
    assert!(
        matches!(results[0], AsnEvent::Error { .. }),
        "invalid ASN must produce AsnEvent::Error"
    );
}

/// Each input must produce exactly one event (result or error).
#[tokio::test]
async fn stream_asn_yields_one_event_per_input() {
    let mut server = mockito::Server::new_async().await;
    let base = server.url();

    // Bootstrap: ASN 15169 → this mock server
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
    let inputs = vec!["AS15169".to_string()];
    let len = inputs.len();
    let stream = client.stream_asn(inputs, StreamConfig::default());
    let results: Vec<_> = stream.collect().await;
    assert_eq!(results.len(), len, "must yield one event per input");
}

// ── stream_nameserver ─────────────────────────────────────────────────────────

/// Each input must produce exactly one event (result or error).
#[tokio::test]
async fn stream_nameserver_yields_one_event_per_input() {
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
        .mock("GET", "/rdap/nameserver/ns1.example.com")
        .with_status(200)
        .with_header("content-type", "application/rdap+json")
        .with_body(common::nameserver_rdap_response("ns1.example.com").to_string())
        .create_async()
        .await;

    let client = test_client(&base);
    let inputs = vec!["ns1.example.com".to_string()];
    let len = inputs.len();
    let stream = client.stream_nameserver(inputs, StreamConfig::default());
    let results: Vec<_> = stream.collect().await;
    assert_eq!(results.len(), len, "must yield one event per input");
}

/// Dropping the stream immediately must not panic or deadlock.
#[tokio::test]
async fn stream_nameserver_cancel_before_completion() {
    let client = RdapClient::default();
    let config = StreamConfig { buffer_size: 1 };
    let stream = client.stream_nameserver(
        vec!["ns1.example.com".to_string(), "ns2.example.com".to_string()],
        config,
    );
    drop(stream);
}

/// An invalid hostname must yield `NameserverEvent::Error`, not a panic.
#[tokio::test]
async fn stream_nameserver_error_does_not_stop_stream() {
    let client = RdapClient::default();
    let config = StreamConfig::default();
    // Empty string is an invalid hostname — normalise_domain will reject it.
    let stream = client.stream_nameserver(vec!["".to_string()], config);
    let results: Vec<_> = stream.collect().await;
    assert_eq!(results.len(), 1, "stream must yield exactly one event");
    assert!(
        matches!(results[0], NameserverEvent::Error { .. }),
        "invalid hostname must produce NameserverEvent::Error"
    );
}
