//! End-to-end benchmarks for the full RDAP query pipeline.
//!
//! Uses a local mock HTTP server (mockito) so all measurements are purely
//! CPU / memory / async-overhead — no network latency is included.
//!
//! What each benchmark measures:
//!
//! | Benchmark          | Bootstrap | RDAP fetch | Cache |
//! |--------------------|-----------|------------|-------|
//! | domain_no_cache    | in-memory | mock HTTP  | off   |
//! | domain_cache_hit   | in-memory | —          | on    |
//! | ip_no_cache        | in-memory | mock HTTP  | off   |
//! | asn_no_cache       | in-memory | mock HTTP  | off   |
//!
//! The Bootstrap object caches its IANA files for 24 h, so after the first
//! iteration the bootstrap lookup is free for all benchmarks.

use std::time::Duration;

use criterion::{criterion_group, criterion_main, Criterion};
use serde_json::json;
use tokio::runtime::Runtime;

use rdapify::http::FetcherConfig;
use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};

// ── Fixture builders (mirrors tests/common/mod.rs) ────────────────────────────

fn dns_bootstrap(tld: &str, server: &str) -> serde_json::Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[tld], [server]]]
    })
}

fn ipv4_bootstrap(cidr: &str, server: &str) -> serde_json::Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[cidr], [server]]]
    })
}

fn asn_bootstrap(range: &str, server: &str) -> serde_json::Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": [[[range], [server]]]
    })
}

fn domain_response(ldh: &str) -> serde_json::Value {
    json!({
        "objectClassName": "domain",
        "handle": "BENCH-1",
        "ldhName": ldh,
        "status": ["active"],
        "nameservers": [
            { "objectClassName": "nameserver", "ldhName": "ns1.example.com" },
            { "objectClassName": "nameserver", "ldhName": "ns2.example.com" }
        ],
        "entities": [{
            "objectClassName": "entity",
            "handle": "R1",
            "roles": ["registrar"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn", {}, "text", "Bench Registrar"]
            ]]
        }],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" },
            { "eventAction": "expiration",   "eventDate": "2030-01-01T00:00:00Z" }
        ]
    })
}

fn ip_response() -> serde_json::Value {
    json!({
        "objectClassName": "ip network",
        "handle": "NET-8-8-8-0-1",
        "startAddress": "8.8.8.0",
        "endAddress": "8.8.8.255",
        "ipVersion": "v4",
        "name": "BENCH-NET",
        "country": "US",
        "status": ["active"],
        "entities": [{
            "objectClassName": "entity",
            "handle": "GOOGL-ARIN",
            "roles": ["registrant"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn", {}, "text", "Google LLC"]
            ]]
        }],
        "events": [{ "eventAction": "registration", "eventDate": "1992-12-01T00:00:00Z" }]
    })
}

fn asn_response() -> serde_json::Value {
    json!({
        "objectClassName": "autnum",
        "handle": "AS15169",
        "startAutnum": 15169,
        "endAutnum": 15169,
        "name": "BENCH-ASN",
        "country": "US",
        "status": ["active"],
        "entities": [{
            "objectClassName": "entity",
            "handle": "GOOGL-ARIN",
            "roles": ["registrant"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn", {}, "text", "Google LLC"]
            ]]
        }],
        "events": [{ "eventAction": "registration", "eventDate": "2000-03-30T00:00:00Z" }]
    })
}

// ── Shared setup ──────────────────────────────────────────────────────────────

/// Builds a client pointing at the mock server.
/// SSRF is disabled because mockito listens on localhost.
fn make_client(bootstrap_url: &str, cache: bool) -> RdapClient {
    RdapClient::with_config(ClientConfig {
        bootstrap_url: Some(bootstrap_url.to_string()),
        cache,
        ssrf: SsrfConfig {
            enabled: false,
            ..Default::default()
        },
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(10),
            max_attempts: 1,
            ..Default::default()
        },
    })
    .expect("client construction failed")
}

// ── Benchmarks ────────────────────────────────────────────────────────────────

fn bench_domain_no_cache(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // Spin up the mock server once for the whole benchmark group.
    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap("com", &format!("{base}/rdap")).to_string())
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(domain_response("example.com").to_string())
            .create_async()
            .await;

        let client = make_client(&base, false);
        // Warm up bootstrap cache (one real lookup so subsequent iterations skip it).
        let _ = client.domain("example.com").await;

        (server, client)
    });

    c.bench_function("domain_no_cache", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.domain("example.com").await.unwrap()) });
    });

    drop(server);
}

fn bench_domain_cache_hit(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap("com", &format!("{base}/rdap")).to_string())
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(domain_response("example.com").to_string())
            .create_async()
            .await;

        let client = make_client(&base, true);
        // Prime the cache — subsequent calls will be pure cache hits.
        let _ = client.domain("example.com").await;

        (server, client)
    });

    c.bench_function("domain_cache_hit", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.domain("example.com").await.unwrap()) });
    });

    drop(server);
}

fn bench_ip_no_cache(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();

        server
            .mock("GET", "/ipv4.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(ipv4_bootstrap("8.0.0.0/8", &format!("{base}/rdap")).to_string())
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/ip/8.8.8.8")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(ip_response().to_string())
            .create_async()
            .await;

        let client = make_client(&base, false);
        let _ = client.ip("8.8.8.8").await;

        (server, client)
    });

    c.bench_function("ip_no_cache", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.ip("8.8.8.8").await.unwrap()) });
    });

    drop(server);
}

fn bench_asn_no_cache(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();

        server
            .mock("GET", "/asn.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(asn_bootstrap("15169-15169", &format!("{base}/rdap")).to_string())
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/autnum/15169")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(asn_response().to_string())
            .create_async()
            .await;

        let client = make_client(&base, false);
        let _ = client.asn("AS15169").await;

        (server, client)
    });

    c.bench_function("asn_no_cache", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.asn("AS15169").await.unwrap()) });
    });

    drop(server);
}

criterion_group!(
    benches,
    bench_domain_no_cache,
    bench_domain_cache_hit,
    bench_ip_no_cache,
    bench_asn_no_cache,
);
criterion_main!(benches);
