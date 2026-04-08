//! Benchmarks for IANA bootstrap discovery.
//!
//! Measures the cost of resolving the authoritative RDAP server URL for a
//! given query — the first step in every client call.
//!
//! | Benchmark                   | Bootstrap cache | IANA fetch |
//! |-----------------------------|-----------------|------------|
//! | `bootstrap_domain_warm`     | hot (24 h TTL)  | no         |
//! | `bootstrap_domain_cold`     | empty           | yes (mock) |
//! | `bootstrap_custom_server`   | bypassed        | no         |
//! | `bootstrap_mixed_types`     | hot             | no         |

use std::collections::HashMap;
use std::time::Duration;

use criterion::{criterion_group, criterion_main, Criterion};
use tokio::runtime::Runtime;

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};

// ── Fixture helpers ───────────────────────────────────────────────────────────

fn dns_bootstrap(tld: &str, rdap_base: &str) -> serde_json::Value {
    serde_json::json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[tld], [rdap_base]]]
    })
}

fn ipv4_bootstrap(cidr: &str, rdap_base: &str) -> serde_json::Value {
    serde_json::json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[cidr], [rdap_base]]]
    })
}

fn asn_bootstrap(range: &str, rdap_base: &str) -> serde_json::Value {
    serde_json::json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[range], [rdap_base]]]
    })
}

fn domain_response(ldh: &str) -> serde_json::Value {
    serde_json::json!({
        "objectClassName": "domain",
        "ldhName": ldh,
        "status": ["active"],
        "events": [{ "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" }]
    })
}

fn ip_response() -> serde_json::Value {
    serde_json::json!({
        "objectClassName": "ip network",
        "handle": "NET-BENCH",
        "startAddress": "8.8.8.0",
        "endAddress": "8.8.8.255",
        "ipVersion": "v4",
        "status": ["active"],
        "events": [{ "eventAction": "registration", "eventDate": "1992-12-01T00:00:00Z" }]
    })
}

fn asn_response() -> serde_json::Value {
    serde_json::json!({
        "objectClassName": "autnum",
        "handle": "AS15169",
        "startAutnum": 15169,
        "endAutnum": 15169,
        "name": "BENCH-ASN",
        "status": ["active"],
        "events": [{ "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" }]
    })
}

fn base_config(bootstrap_url: &str) -> ClientConfig {
    ClientConfig {
        bootstrap_url: Some(bootstrap_url.to_string()),
        cache: false,
        rate_limit: None,
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
    }
}

// ── bench_bootstrap_domain_warm ───────────────────────────────────────────────
//
// The bootstrap cache has a 24-hour TTL. After one lookup the TLD→server
// mapping is cached in-memory for all subsequent calls — no IANA fetch.

fn bench_bootstrap_domain_warm(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap("com", &rdap_base).to_string())
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(domain_response("example.com").to_string())
            .create_async()
            .await;

        let client = RdapClient::with_config(base_config(&base))
            .expect("client construction failed");

        // Warm the bootstrap cache (one real fetch).
        let _ = client.domain("example.com").await;

        (server, client)
    });

    // All iterations will hit the in-memory bootstrap cache → no IANA fetch.
    c.bench_function("bootstrap_domain_warm", |b| {
        b.to_async(&rt).iter(|| async {
            criterion::black_box(client.domain("example.com").await.unwrap())
        });
    });

    drop(server);
}

// ── bench_bootstrap_domain_cold ───────────────────────────────────────────────
//
// A fresh client per iteration forces the bootstrap file to be fetched from
// the mock IANA server. This measures the full cold-path cost.

fn bench_bootstrap_domain_cold(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, base) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap("com", &rdap_base).to_string())
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(domain_response("example.com").to_string())
            .create_async()
            .await;

        (server, base)
    });

    // Each iteration builds a fresh client → empty bootstrap cache → IANA fetch.
    c.bench_function("bootstrap_domain_cold", |b| {
        b.to_async(&rt).iter(|| async {
            let client = RdapClient::with_config(base_config(&base))
                .expect("client construction failed");
            criterion::black_box(client.domain("example.com").await.unwrap())
        });
    });

    drop(server);
}

// ── bench_bootstrap_custom_server ────────────────────────────────────────────
//
// `custom_bootstrap_servers` bypasses IANA entirely: no bootstrap fetch,
// straight to the RDAP endpoint.

fn bench_bootstrap_custom_server(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/rdap/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(domain_response("example.com").to_string())
            .create_async()
            .await;

        let mut custom = HashMap::new();
        custom.insert("com".to_string(), rdap_base);

        let client = RdapClient::with_config(ClientConfig {
            custom_bootstrap_servers: custom,
            cache: false,
            rate_limit: None,
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
        .expect("client construction failed");

        (server, client)
    });

    // No bootstrap fetch ever — pure RDAP lookup cost.
    c.bench_function("bootstrap_custom_server", |b| {
        b.to_async(&rt).iter(|| async {
            criterion::black_box(client.domain("example.com").await.unwrap())
        });
    });

    drop(server);
}

// ── bench_bootstrap_mixed_types ──────────────────────────────────────────────
//
// Measures bootstrap warm-path across all three query types in sequence.

fn bench_bootstrap_mixed_types(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        // DNS bootstrap for .com
        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_body(dns_bootstrap("com", &rdap_base).to_string())
            .create_async()
            .await;
        // IPv4 bootstrap for 8.0.0.0/8
        server
            .mock("GET", "/ipv4.json")
            .with_status(200)
            .with_body(ipv4_bootstrap("8.0.0.0/8", &rdap_base).to_string())
            .create_async()
            .await;
        // ASN bootstrap for AS15169
        server
            .mock("GET", "/asn.json")
            .with_status(200)
            .with_body(asn_bootstrap("15169-15169", &rdap_base).to_string())
            .create_async()
            .await;

        // RDAP endpoints
        server
            .mock("GET", "/rdap/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(domain_response("example.com").to_string())
            .create_async()
            .await;
        server
            .mock("GET", "/rdap/ip/8.8.8.8")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(ip_response().to_string())
            .create_async()
            .await;
        server
            .mock("GET", "/rdap/autnum/15169")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(asn_response().to_string())
            .create_async()
            .await;

        let client = RdapClient::with_config(base_config(&base))
            .expect("client construction failed");

        // Warm all three bootstrap caches.
        let _ = client.domain("example.com").await;
        let _ = client.ip("8.8.8.8").await;
        let _ = client.asn("AS15169").await;

        (server, client)
    });

    c.bench_function("bootstrap_mixed_types", |b| {
        b.to_async(&rt).iter(|| async {
            let _ = criterion::black_box(client.domain("example.com").await.unwrap());
            let _ = criterion::black_box(client.ip("8.8.8.8").await.unwrap());
            let _ = criterion::black_box(client.asn("AS15169").await.unwrap());
        });
    });

    drop(server);
}

criterion_group!(
    benches,
    bench_bootstrap_domain_warm,
    bench_bootstrap_domain_cold,
    bench_bootstrap_custom_server,
    bench_bootstrap_mixed_types,
);
criterion_main!(benches);
