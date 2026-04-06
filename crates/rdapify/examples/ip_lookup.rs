//! IP address lookup example.
//!
//! Demonstrates:
//! - Querying IPv4 addresses
//! - Querying IPv6 addresses
//! - Processing multiple IP addresses in a loop
//! - Cache management
//!
//! Run with:
//!     cargo run --example ip_lookup

use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify IP Address Lookup Example ===\n");

    // Create client with default configuration
    let client = RdapClient::new()?;

    // Query IPv4 address
    println!("Querying IPv4: 8.8.8.8...");
    match client.ip("8.8.8.8").await {
        Ok(response) => {
            println!("  Query: {}", response.query);
            println!("  Name: {:?}", response.name);
            println!("  Country: {:?}", response.country);
            println!("  Start: {:?}", response.start_address);
            println!("  End: {:?}", response.end_address);
            println!("  Type: {:?}", response.allocation_type);
            println!("  Source: {}", response.meta.source);
        }
        Err(e) => println!("  Error: {}", e),
    }

    println!();

    // Query IPv6 address
    println!("Querying IPv6: 2001:4860:4860::8888...");
    match client.ip("2001:4860:4860::8888").await {
        Ok(response) => {
            println!("  Query: {}", response.query);
            println!("  Name: {:?}", response.name);
            println!("  Country: {:?}", response.country);
            println!("  Start: {:?}", response.start_address);
            println!("  End: {:?}", response.end_address);
            println!("  Type: {:?}", response.allocation_type);
            println!("  Source: {}", response.meta.source);
        }
        Err(e) => println!("  Error: {}", e),
    }

    println!("\n=== Batch IP Lookups ===\n");

    // Query multiple IP addresses
    let addresses = vec![
        "1.1.1.1".to_string(),
        "208.67.222.222".to_string(),
        "2620:119:35::35".to_string(),
    ];

    let mut success_count = 0;
    let mut error_count = 0;

    for addr in addresses {
        println!("Querying: {}", addr);
        match client.ip(&addr).await {
            Ok(response) => {
                println!("  Country: {:?}", response.country);
                println!("  Type: {:?}", response.allocation_type);
                success_count += 1;
            }
            Err(e) => {
                println!("  Error: {}", e);
                error_count += 1;
            }
        }
        println!();
    }

    println!("=== Summary ===");
    println!("Success: {}", success_count);
    println!("Errors: {}", error_count);
    println!("Cache size: {} entries\n", client.cache_size());

    println!("Example completed successfully!");
    Ok(())
}
