//! ASN (Autonomous System Number) lookup example.
//!
//! Demonstrates:
//! - Querying ASN information
//! - Handling both "AS15169" and "15169" formats
//! - Processing multiple ASNs
//! - Error handling for invalid ASNs
//!
//! Run with:
//!     cargo run --example asn_lookup

use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify ASN Lookup Example ===\n");

    // Create client with default configuration
    let client = RdapClient::new()?;

    // Query Google's ASN (with "AS" prefix)
    println!("Querying AS15169 (Google)...");
    match client.asn("AS15169").await {
        Ok(response) => {
            println!("  Query: {}", response.query);
            println!("  Name: {:?}", response.name);
            println!("  Country: {:?}", response.country);
            println!("  Start: {:?}", response.start_autnum);
            println!("  End: {:?}", response.end_autnum);
            println!("  Type: {:?}", response.autnum_type);
            println!("  Status: {:?}", response.status);
            println!("  Source: {}", response.meta.source);
        }
        Err(e) => println!("  Error: {}", e),
    }

    println!();

    // Query the same ASN without "AS" prefix
    println!("Querying 15169 (Google, without 'AS' prefix)...");
    match client.asn("15169").await {
        Ok(response) => {
            println!("  Query: {}", response.query);
            println!("  Name: {:?}", response.name);
            println!("  Country: {:?}", response.country);
            println!("  Start: {:?}", response.start_autnum);
            println!("  End: {:?}", response.end_autnum);
            println!("  Type: {:?}", response.autnum_type);
            println!("  Source: {}", response.meta.source);
        }
        Err(e) => println!("  Error: {}", e),
    }

    println!();

    // Query Cloudflare's ASN
    println!("Querying AS13335 (Cloudflare)...");
    match client.asn("AS13335").await {
        Ok(response) => {
            println!("  Query: {}", response.query);
            println!("  Name: {:?}", response.name);
            println!("  Country: {:?}", response.country);
            println!("  Start: {:?}", response.start_autnum);
            println!("  End: {:?}", response.end_autnum);
            println!("  Type: {:?}", response.autnum_type);
            println!("  Status: {:?}", response.status);
            println!("  Source: {}", response.meta.source);
        }
        Err(e) => println!("  Error: {}", e),
    }

    println!();

    // Demonstrate error handling with an invalid ASN
    println!("Querying AS0 (invalid ASN - should error)...");
    match client.asn("AS0").await {
        Ok(response) => {
            println!("  Query: {}", response.query);
            println!("  Name: {:?}", response.name);
        }
        Err(e) => {
            println!("  Error (expected): {}", e);
        }
    }

    println!("\nCache size: {} entries\n", client.cache_size());

    println!("Example completed successfully!");
    Ok(())
}
