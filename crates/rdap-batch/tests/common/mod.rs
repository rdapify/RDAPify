//! Shared helpers for rdap-batch integration tests.

use mockito::ServerGuard;
use rdap_batch::{BatchConfig, BatchExecutor};
use rdap_core::FetcherConfig;
use rdap_security::SsrfConfig;
use rdapify_client::{ClientConfig, RdapClient};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;

// ── Client factory ────────────────────────────────────────────────────────────

/// Builds a test [`BatchExecutor`] pointed at `server`.
///
/// - SSRF disabled (mock server is on localhost)
/// - Cache disabled (avoids cross-test pollution)
/// - Rate limiting disabled (speed)
/// - Short timeout
pub fn test_executor(server: &ServerGuard) -> BatchExecutor {
    let client = test_client(server);
    BatchExecutor::new(Arc::new(client))
}

pub fn test_client(server: &ServerGuard) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(server.url()),
        cache: false,
        rate_limit: None,
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

/// Default batch config for tests: small concurrency, small buffer, unordered.
pub fn test_config(concurrency: usize) -> BatchConfig {
    BatchConfig {
        concurrency,
        ordered: false,
        buffer: 32,
    }
}

// ── Bootstrap fixtures ────────────────────────────────────────────────────────

pub fn dns_bootstrap(tld: &str, rdap_base: &str) -> Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[tld], [rdap_base]]]
    })
}

pub fn ipv4_bootstrap(cidr: &str, rdap_base: &str) -> Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[cidr], [rdap_base]]]
    })
}

pub fn asn_bootstrap(range: &str, rdap_base: &str) -> Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[range], [rdap_base]]]
    })
}

// ── RDAP response fixtures ────────────────────────────────────────────────────

pub fn domain_response(ldh_name: &str) -> Value {
    json!({
        "objectClassName": "domain",
        "handle": "TEST-HANDLE",
        "ldhName": ldh_name,
        "status": ["active"],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" },
            { "eventAction": "expiration",   "eventDate": "2030-01-01T00:00:00Z" }
        ],
        "links": []
    })
}

pub fn not_found_response() -> Value {
    json!({ "errorCode": 404, "title": "Not Found" })
}
