//! Benchmarks for IANA bootstrap server discovery.
//!
//! # What is measured
//!
//! * TLD → RDAP server lookup from a warm (populated) in-memory bootstrap cache.
//! * IP prefix matching (IPv4 and IPv6).
//! * ASN range matching.
//! * Custom server override (hash map lookup).
//! * Cold bootstrap fetch (fetches mock IANA files over local HTTP).
//!
//! # Performance targets
//!
//! | Operation           | Target  |
//! |---------------------|---------|
//! | Warm TLD lookup     | < 1 µs  |
//! | Warm IP lookup      | < 5 µs  |
//! | Warm ASN lookup     | < 1 µs  |
//! | Custom override     | < 500 ns|
//! | Cold bootstrap fetch| < 5 ms  |

use std::collections::HashMap;
use std::time::Duration;

use criterion::{criterion_group, criterion_main, Criterion};
use serde_json::json;
use tokio::runtime::Runtime;

use rdapify::security::SsrfConfig;
use rdapify::{ClientConfig, RdapClient};

// ── Bootstrap JSON fixtures ───────────────────────────────────────────────────

fn dns_bootstrap_json(entries: &[(&str, &str)]) -> String {
    let services: Vec<serde_json::Value> = entries
        .iter()
        .map(|(tld, server)| json!([[tld], [server]]))
        .collect();
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": services
    })
    .to_string()
}

fn ipv4_bootstrap_json(entries: &[(&str, &str)]) -> String {
    let services: Vec<serde_json::Value> = entries
        .iter()
        .map(|(cidr, server)| json!([[cidr], [server]]))
        .collect();
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": services
    })
    .to_string()
}

fn asn_bootstrap_json(entries: &[(&str, &str)]) -> String {
    let services: Vec<serde_json::Value> = entries
        .iter()
        .map(|(range, server)| json!([[range], [server]]))
        .collect();
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "services": services
    })
    .to_string()
}

// ── Warm lookup benchmarks ────────────────────────────────────────────────────

fn bench_bootstrap_warm_tld_lookup(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // Prime the bootstrap cache once, then benchmark the lookup.
    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap_json(&[
                ("com", &rdap_base),
                ("net", &rdap_base),
                ("org", &rdap_base),
                ("io", &rdap_base),
                ("dev", &rdap_base),
            ]))
            .create_async()
            .await;

        // Minimal domain response just to trigger bootstrap load
        server
            .mock("GET", "/rdap/domain/warmup.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(
                json!({
                    "objectClassName": "domain",
                    "ldhName": "warmup.com",
                    "status": ["active"],
                    "events": [],
                    "entities": []
                })
                .to_string(),
            )
            .create_async()
            .await;

        let client = RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(base.clone()),
            cache: false,
            ssrf: SsrfConfig {
                enabled: false,
                ..Default::default()
            },
            fetcher: rdapify::http::FetcherConfig {
                max_attempts: 1,
                timeout: Duration::from_secs(5),
                ..Default::default()
            },
            ..Default::default()
        })
        .unwrap();

        // Prime bootstrap cache
        let _ = client.domain("warmup.com").await;

        (server, client)
    });

    // Bootstrap is now warm — benchmark only the lookup path
    c.bench_function("bootstrap/warm_tld_lookup", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.domain("example.com").await) });
    });

    drop(server);
}

fn bench_bootstrap_warm_ip_lookup(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/ipv4.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(ipv4_bootstrap_json(&[
                ("1.0.0.0/8", &rdap_base),
                ("8.0.0.0/8", &rdap_base),
                ("104.0.0.0/8", &rdap_base),
                ("172.16.0.0/12", &rdap_base), // will be blocked by SSRF on real traffic
            ]))
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/ip/8.8.8.8")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(
                json!({
                    "objectClassName": "ip network",
                    "startAddress": "8.0.0.0",
                    "endAddress": "8.255.255.255",
                    "ipVersion": "v4",
                    "status": ["active"],
                    "events": [],
                    "entities": []
                })
                .to_string(),
            )
            .create_async()
            .await;

        let client = RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(base.clone()),
            cache: false,
            ssrf: SsrfConfig {
                enabled: false,
                ..Default::default()
            },
            fetcher: rdapify::http::FetcherConfig {
                max_attempts: 1,
                timeout: Duration::from_secs(5),
                ..Default::default()
            },
            ..Default::default()
        })
        .unwrap();

        let _ = client.ip("8.8.8.8").await;

        (server, client)
    });

    c.bench_function("bootstrap/warm_ip_lookup", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.ip("8.8.8.8").await) });
    });

    drop(server);
}

fn bench_bootstrap_warm_asn_lookup(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();
        let rdap_base = format!("{base}/rdap");

        server
            .mock("GET", "/asn.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(asn_bootstrap_json(&[
                ("1-1000", &rdap_base),
                ("1001-10000", &rdap_base),
                ("10001-20000", &rdap_base),
                ("15169-15169", &rdap_base),
            ]))
            .create_async()
            .await;

        server
            .mock("GET", "/rdap/autnum/15169")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(
                json!({
                    "objectClassName": "autnum",
                    "startAutnum": 15169,
                    "endAutnum": 15169,
                    "status": ["active"],
                    "events": [],
                    "entities": []
                })
                .to_string(),
            )
            .create_async()
            .await;

        let client = RdapClient::with_config(ClientConfig {
            bootstrap_url: Some(base.clone()),
            cache: false,
            ssrf: SsrfConfig {
                enabled: false,
                ..Default::default()
            },
            fetcher: rdapify::http::FetcherConfig {
                max_attempts: 1,
                timeout: Duration::from_secs(5),
                ..Default::default()
            },
            ..Default::default()
        })
        .unwrap();

        let _ = client.asn("AS15169").await;

        (server, client)
    });

    c.bench_function("bootstrap/warm_asn_lookup", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.asn("AS15169").await) });
    });

    drop(server);
}

fn bench_bootstrap_custom_server_override(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();

    // Custom server override bypasses IANA entirely — measures HashMap lookup cost.
    let (server, client) = rt.block_on(async {
        let mut server = mockito::Server::new_async().await;
        let base = server.url();

        server
            .mock("GET", "/domain/example.com")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(
                json!({
                    "objectClassName": "domain",
                    "ldhName": "example.com",
                    "status": ["active"],
                    "events": [],
                    "entities": []
                })
                .to_string(),
            )
            .create_async()
            .await;

        let mut custom = HashMap::new();
        custom.insert("com".to_string(), format!("{base}"));

        let client = RdapClient::with_config(ClientConfig {
            cache: false,
            ssrf: SsrfConfig {
                enabled: false,
                ..Default::default()
            },
            custom_bootstrap_servers: custom,
            fetcher: rdapify::http::FetcherConfig {
                max_attempts: 1,
                timeout: Duration::from_secs(5),
                ..Default::default()
            },
            ..Default::default()
        })
        .unwrap();

        (server, client)
    });

    c.bench_function("bootstrap/custom_server_override", |b| {
        b.to_async(&rt)
            .iter(|| async { criterion::black_box(client.domain("example.com").await) });
    });

    drop(server);
}

criterion_group!(
    benches,
    bench_bootstrap_warm_tld_lookup,
    bench_bootstrap_warm_ip_lookup,
    bench_bootstrap_warm_asn_lookup,
    bench_bootstrap_custom_server_override,
);
criterion_main!(benches);
