//! Service-mode example.
//!
//! Demonstrates building a minimal HTTP API around RdapClient.
//! This illustrates the pattern used by `rdapify-service`.
//!
//! In production, add `axum = "0.8"` as a dependency and uncomment
//! the Axum route handlers shown at the bottom of this file.
//!
//! Run with:
//!     cargo run --example service_mode

use rdapify::{ClientConfig, FetcherConfig, RdapClient};
use std::sync::Arc;
use std::time::Duration;

/// Application state passed into every Axum handler via `State<AppState>`.
#[derive(Clone)]
struct AppState {
    rdap_client: Arc<RdapClient>,
}

#[tokio::main]
async fn main() -> rdapify::error::Result<()> {
    println!("=== RDAPify Service Mode Example ===\n");

    // Build an RdapClient optimised for a long-running service:
    // - large connection pool (20 per host)
    // - response cache enabled (serves repeated lookups from memory)
    // - 15s timeout per RDAP request
    let config = ClientConfig {
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(15),
            ..Default::default()
        },
        cache: true,
        reuse_connections: true,
        max_connections_per_host: 20,
        ..Default::default()
    };

    let rdap_client = Arc::new(RdapClient::with_config(config)?);
    let state = AppState {
        rdap_client: rdap_client.clone(),
    };

    println!("Service configuration:");
    println!("  Listen: 0.0.0.0:8080");
    println!("  Cache:  enabled");
    println!("  Max connections per host: 20");
    println!("  Request timeout: 15 s\n");

    println!("HTTP routes (add axum = \"0.8\" to enable):");
    println!("  GET /domain/:name     → DomainResponse (JSON)");
    println!("  GET /ip/:address      → IpResponse (JSON)");
    println!("  GET /asn/:asn         → AsnResponse (JSON)");
    println!("  GET /health           → {{\"status\":\"ok\"}}");
    println!("  GET /metrics          → {{\"cache_size\": N}}\n");

    // Verify the client is working with a live query. requires network access
    println!("Testing live query (example.com)...");
    match state.rdap_client.domain("example.com").await {
        Ok(response) => {
            println!("  ✓ Query successful");
            println!("    Domain:    {}", response.query);
            println!(
                "    Registrar: {:?}",
                response.registrar.as_ref().and_then(|r| r.name.as_deref())
            );
            println!("    Source:    {}", response.meta.source);
            println!("    Cached:    {}", response.meta.cached);
        }
        Err(e) => println!("  ✗ Error: {e}"),
    }

    println!("\nCache after first query: {} entries", state.rdap_client.cache_size());

    println!("\nTo build a real HTTP service with Axum:");
    println!("  1. Add  axum = \"0.8\"  to dev-dependencies in crates/rdapify/Cargo.toml");
    println!("  2. See the commented handler stubs at the end of this source file");
    println!("  3. cargo run --example service_mode");

    Ok(())
}

// ── Example Axum route handlers ──────────────────────────────────────────────
//
// Uncomment these and add `axum = "0.8"` to Cargo.toml to run a real service.
//
// use axum::{extract::{Path, State}, Json, Router, routing::get};
// use std::net::SocketAddr;
//
// async fn domain_handler(
//     State(state): State<AppState>,
//     Path(name): Path<String>,
// ) -> Result<Json<rdapify::DomainResponse>, String> {
//     state.rdap_client.domain(&name).await
//         .map(Json)
//         .map_err(|e| e.to_string())
// }
//
// async fn ip_handler(
//     State(state): State<AppState>,
//     Path(addr): Path<String>,
// ) -> Result<Json<rdapify::IpResponse>, String> {
//     state.rdap_client.ip(&addr).await
//         .map(Json)
//         .map_err(|e| e.to_string())
// }
//
// async fn asn_handler(
//     State(state): State<AppState>,
//     Path(asn): Path<String>,
// ) -> Result<Json<rdapify::AsnResponse>, String> {
//     state.rdap_client.asn(&asn).await
//         .map(Json)
//         .map_err(|e| e.to_string())
// }
//
// async fn health_handler() -> &'static str { r#"{"status":"ok"}"# }
//
// async fn metrics_handler(State(state): State<AppState>) -> String {
//     format!(r#"{{"cache_size":{}}}"#, state.rdap_client.cache_size())
// }
//
// fn build_router(state: AppState) -> Router {
//     Router::new()
//         .route("/domain/:name",  get(domain_handler))
//         .route("/ip/:address",   get(ip_handler))
//         .route("/asn/:asn",      get(asn_handler))
//         .route("/health",        get(health_handler))
//         .route("/metrics",       get(metrics_handler))
//         .with_state(state)
// }
//
// To start the listener:
//   let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
//   let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
//   axum::serve(listener, build_router(state)).await.unwrap();
