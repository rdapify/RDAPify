//! Webhook delivery example.
//!
//! Shows how to build a simple webhook dispatcher on top of rdapify
//! query results. In production, replace the HTTP client with your
//! own delivery layer (reqwest, hyper, etc.).
//!
//! Run with:
//!     cargo run --example webhooks

use rdapify::RdapClient;

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify Webhook Dispatch Example ===\n");

    let client = RdapClient::new()?;

    let domains = vec!["github.com", "google.com", "amazon.com"];

    println!("Querying {} domains and dispatching webhooks...\n", domains.len());

    for domain in domains {
        match client.domain(domain).await {
            Ok(response) => {
                let registrar = response.registrar.as_ref().and_then(|r| r.name.as_deref());
                let expires_at = response.expiration_date();

                // Build event JSON with serde_json::json! (no serde derive needed)
                let payload = serde_json::json!({
                    "event_type": "domain.queried",
                    "domain": domain,
                    "registrar": registrar,
                    "expires_at": expires_at,
                    "cached": response.meta.cached,
                    "source": response.meta.source,
                });

                dispatch_webhook("domain.queried", &payload);

                // Dispatch "domain.expiring_soon" if expiry is within our threshold
                if let Some(expires) = expires_at {
                    if is_expiring_soon(expires) {
                        let expiry_payload = serde_json::json!({
                            "event_type": "domain.expiring_soon",
                            "domain": domain,
                            "registrar": registrar,
                            "expires_at": expires_at,
                            "cached": response.meta.cached,
                            "source": response.meta.source,
                        });
                        dispatch_webhook("domain.expiring_soon", &expiry_payload);
                    }
                }
            }
            Err(e) => {
                println!("[webhook] query failed for {domain}: {e}\n");
            }
        }
    }

    println!("Example completed successfully!");
    Ok(())
}

/// Dispatch a webhook event (in production, this would be an HTTP POST).
fn dispatch_webhook(event_type: &str, payload: &serde_json::Value) {
    let json_body = serde_json::to_string(payload).expect("json serialization is infallible here");
    let signature = sign_payload(&json_body, "your-webhook-secret");
    println!("[webhook] POST https://your-domain.example.com/webhooks/rdap  ({event_type})");
    println!("          X-RDAPify-Signature: {signature}");
    println!("          {json_body}\n");
}

/// Compute HMAC signature for webhook payload.
///
/// In production, use the `hmac` + `sha2` crates:
/// ```ignore
/// use hmac::{Hmac, Mac};
/// use sha2::Sha256;
///
/// let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
///     .expect("HMAC can take key of any size");
/// mac.update(payload.as_bytes());
/// let result = mac.finalize();
/// format!("sha256={}", hex::encode(result.into_bytes()))
/// ```
fn sign_payload(payload: &str, _secret: &str) -> String {
    // Placeholder for demonstration — in production use proper HMAC-SHA256.
    let preview = &payload[..30.min(payload.len())];
    format!("sha256=<hmac_sha256({preview}...)>")
}

/// Returns `true` when the expiration date string indicates expiry within ~1 year.
///
/// In production, parse the ISO 8601 date with `chrono` and compare against `Utc::now()`.
fn is_expiring_soon(expires_at: &str) -> bool {
    expires_at.contains("2024") || expires_at.contains("2025") || expires_at.contains("2026")
}
