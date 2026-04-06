//! Basic domain lookup example.
//!
//! Demonstrates:
//! - Creating an RdapClient
//! - Querying domain information
//! - Inspecting response metadata and caching
//! - Checking domain availability
//!
//! Run with:
//!     cargo run --example basic_lookup

use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify Basic Domain Lookup Example ===\n");

    // Create client with default configuration
    let client = RdapClient::new()?;

    // Query a domain (requires network access)
    println!("Querying example.com...");
    let response = client.domain("example.com").await?;

    println!("  Query: {}", response.query);
    if let Some(registrar) = &response.registrar {
        println!("  Registrar: {:?}", registrar.name);
    }
    if let Some(handle) = &response.handle {
        println!("  Handle: {}", handle);
    }
    println!("  Nameservers: {}", response.nameservers.join(", "));
    println!("  Is active: {}", response.is_active());
    println!("  Registration date: {:?}", response.registration_date());
    println!("  Expiration date: {:?}", response.expiration_date());
    println!("  Status count: {}", response.status.len());
    println!("  Source: {}", response.meta.source);
    println!("  Cached: {}", response.meta.cached);
    println!("  Cache size: {} entries\n", client.cache_size());

    // Second query to demonstrate cache hit
    println!("Querying iana.org (should be cached if queried recently)...");
    let response2 = client.domain("iana.org").await?;
    println!("  Query: {}", response2.query);
    println!("  Cached: {} (if true, this was served from the in-memory cache)", response2.meta.cached);
    println!("  Cache size: {} entries\n", client.cache_size());

    // Check domain availability
    println!("Checking domain availability...");
    match client.domain_available("example.com").await? {
        avail => {
            println!("  Domain: {}", avail.domain);
            println!("  Available: {}", avail.available);
            if let Some(expires) = avail.expires_at {
                println!("  Expires: {}", expires);
            }
        }
    }

    println!("\nExample completed successfully!");
    Ok(())
}
