//! Domain change detection example.
//!
//! Polls a domain at a configurable interval and reports when the
//! nameservers, registrar, status flags, or expiration date change.
//!
//! Run with:
//!     cargo run --example monitoring

use rdapify::{ClientConfig, DomainResponse, FetcherConfig, RdapClient};
use std::time::Duration;
use tokio::time::sleep;

/// Snapshot of domain state for change detection.
#[derive(Debug, Clone, PartialEq)]
struct DomainSnapshot {
    nameservers: Vec<String>,
    registrar: Option<String>,
    status: Vec<String>,
    expiration: Option<String>,
}

impl From<&DomainResponse> for DomainSnapshot {
    fn from(response: &DomainResponse) -> Self {
        Self {
            nameservers: response.nameservers.clone(),
            registrar: response.registrar.as_ref().and_then(|r| r.name.clone()),
            status: response.status.iter().map(|s| format!("{s:?}")).collect(),
            expiration: response.expiration_date().map(|s| s.to_string()),
        }
    }
}

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify Domain Monitoring Example ===\n");

    // Create client with cache disabled so each poll hits the server
    let config = ClientConfig {
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(10),
            ..Default::default()
        },
        cache: false,
        ..Default::default()
    };

    let client = RdapClient::with_config(config)?;
    let domain = "example.com";

    println!(
        "Monitoring {} for changes every 2 seconds (3 iterations)...\n",
        domain
    );

    let mut previous_snapshot: Option<DomainSnapshot> = None;
    let mut _poll_count = 0;

    for iteration in 1..=3 {
        println!("Poll #{}", iteration);
        sleep(Duration::from_secs(2)).await;

        match client.domain(domain).await {
            Ok(response) => {
                let current_snapshot = DomainSnapshot::from(&response);

                if let Some(prev) = &previous_snapshot {
                    if prev != &current_snapshot {
                        println!("  ✓ Changes detected!");

                        if prev.nameservers != current_snapshot.nameservers {
                            println!(
                                "    - Nameservers changed: {:?} → {:?}",
                                prev.nameservers, current_snapshot.nameservers
                            );
                        }
                        if prev.registrar != current_snapshot.registrar {
                            println!(
                                "    - Registrar changed: {:?} → {:?}",
                                prev.registrar, current_snapshot.registrar
                            );
                        }
                        if prev.status != current_snapshot.status {
                            println!(
                                "    - Status changed: {:?} → {:?}",
                                prev.status, current_snapshot.status
                            );
                        }
                        if prev.expiration != current_snapshot.expiration {
                            println!(
                                "    - Expiration changed: {:?} → {:?}",
                                prev.expiration, current_snapshot.expiration
                            );
                        }

                        // Simulate webhook dispatch on change
                        dispatch_webhook_json(domain, &current_snapshot);
                    } else {
                        println!("  → No changes");
                    }
                } else {
                    println!("  ✓ Initial state captured");
                }

                previous_snapshot = Some(current_snapshot);
            }
            Err(e) => {
                println!("  ✗ Error: {}", e);
            }
        }
        println!();
    }

    if let Some(_prev) = previous_snapshot {
        println!("No changes detected after 3 polls\n");
    }

    println!("Example completed successfully!");
    Ok(())
}

/// Simulate webhook dispatch (would be HTTP POST in production).
fn dispatch_webhook_json(domain: &str, snapshot: &DomainSnapshot) {
    let payload = serde_json::json!({
        "event_type": "domain.changed",
        "domain": domain,
        "snapshot": {
            "nameservers": snapshot.nameservers,
            "registrar": snapshot.registrar,
            "status": snapshot.status,
            "expiration": snapshot.expiration,
        },
        // In production add: "timestamp": chrono::Utc::now().to_rfc3339()
    });

    println!("  [webhook] POST https://your-domain.example.com/webhooks/rdap");
    println!("            {payload}");
}
