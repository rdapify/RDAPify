//! Batch availability check and streaming lookup example.
//!
//! Demonstrates:
//! - domain_available_batch() for concurrent availability checks
//! - stream_domain() for streaming RDAP results with back-pressure
//!
//! Run with:
//!     cargo run --example batch_lookup

use rdapify::{RdapClient, StreamConfig};
use tokio_stream::StreamExt;

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify Batch Lookup Example ===\n");

    let client = RdapClient::new()?;

    // ── Batch availability checks ───────────────────────────────────────

    println!("=== Batch Availability Check ===\n");

    let domains = vec![
        "example.com".to_string(),
        "github.com".to_string(),
        "rust-lang.org".to_string(),
        "mozilla.org".to_string(),
        "iana.org".to_string(),
    ];

    println!(
        "Checking {} domains concurrently (limit: 3)...\n",
        domains.len()
    );

    let results = client
        .domain_available_batch(domains.clone(), Some(3))
        .await;

    let mut available_count = 0;
    let mut taken_count = 0;

    for result in &results {
        match result {
            Ok(avail) => {
                let status = if avail.available {
                    "AVAILABLE"
                } else {
                    "TAKEN"
                };
                println!("  {} → {}", avail.domain, status);
                if let Some(expires) = &avail.expires_at {
                    println!("      (expires: {})", expires);
                }
                if avail.available {
                    available_count += 1;
                } else {
                    taken_count += 1;
                }
            }
            Err(e) => {
                println!("  Error: {}", e);
            }
        }
    }

    println!(
        "\n  Summary: {} available, {} taken",
        available_count, taken_count
    );
    println!("  Cache size: {} entries\n", client.cache_size());

    // ── Streaming domain lookup ────────────────────────────────────────

    println!("=== Streaming Domain Lookup ===\n");

    let names = vec![
        "github.com".to_string(),
        "google.com".to_string(),
        "amazon.com".to_string(),
    ];

    println!("Streaming {} domain queries...\n", names.len());

    let mut stream = client.stream_domain(names, StreamConfig::default());
    let mut processed_count = 0;

    while let Some(event) = stream.next().await {
        match event {
            rdapify::DomainEvent::Result(response) => {
                println!("  ✓ {}", response.query);
                if let Some(registrar) = &response.registrar {
                    if let Some(name) = &registrar.name {
                        println!("      Registrar: {}", name);
                    }
                }
                processed_count += 1;
            }
            rdapify::DomainEvent::Error { query, error } => {
                println!("  ✗ {} → {}", query, error);
                processed_count += 1;
            }
        }
    }

    println!("\n  Processed {} domains from stream", processed_count);
    println!("  Cache size: {} entries\n", client.cache_size());

    println!("Example completed successfully!");
    Ok(())
}
