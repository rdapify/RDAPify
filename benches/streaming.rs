//! Benchmarks for the async streaming API.
//!
//! These benchmarks measure throughput of `stream_domain()` and `stream_ip()`
//! using a mock HTTP server so no real network calls are made.

use criterion::{criterion_group, criterion_main, Criterion};

use rdapify::stream::DomainEvent;
use rdapify::{RdapClient, StreamConfig};
use tokio_stream::StreamExt;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Minimal mock domain RDAP response JSON.
fn mock_domain_json(name: &str) -> String {
    format!(
        r#"{{
            "objectClassName": "domain",
            "ldhName": "{name}",
            "handle": "HANDLE-001",
            "status": ["active"],
            "events": [],
            "entities": [],
            "links": [],
            "nameservers": [],
            "rdapConformance": ["rdap_level_0"]
        }}"#
    )
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

fn bench_stream_domain_10(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("stream_domain/10_queries_mocked", |b| {
        b.iter(|| {
            rt.block_on(async {
                let mut server = mockito::Server::new_async().await;

                // Register mock endpoints for 10 domains
                let domains: Vec<String> = (1..=10).map(|i| format!("bench{i}.com")).collect();

                let bootstrap_body = {
                    let services: Vec<serde_json::Value> = domains
                        .iter()
                        .map(|_| serde_json::json!([["com"], [format!("{}/", server.url())]]))
                        .collect();
                    serde_json::json!({
                        "version": "1.0",
                        "publication": "2024-01-01T00:00:00Z",
                        "description": "bench",
                        "services": services
                    })
                    .to_string()
                };

                let _m_boot = server
                    .mock("GET", "/domain.json")
                    .with_status(200)
                    .with_header("content-type", "application/json")
                    .with_body(&bootstrap_body)
                    .expect_at_least(0)
                    .create_async()
                    .await;

                for d in &domains {
                    let body = mock_domain_json(d);
                    let _m = server
                        .mock("GET", format!("/domain/{d}").as_str())
                        .with_status(200)
                        .with_header("content-type", "application/json")
                        .with_body(&body)
                        .create_async()
                        .await;
                }

                let client = RdapClient::with_config(rdapify::ClientConfig {
                    bootstrap_url: Some(server.url()),
                    cache: false,
                    ..Default::default()
                })
                .unwrap();

                let mut stream = client.stream_domain(domains, StreamConfig::default());
                let mut count = 0usize;
                while let Some(event) = stream.next().await {
                    if let DomainEvent::Result(_) = event {
                        count += 1;
                    }
                }
                count
            })
        })
    });
}

criterion_group!(benches, bench_stream_domain_10);
criterion_main!(benches);
