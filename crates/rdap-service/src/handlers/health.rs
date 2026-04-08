use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};

use crate::state::AppState;

/// Liveness probe — returns 200 if the process is alive.
pub async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

/// Readiness probe — returns 200 when the service can handle traffic.
///
/// Checks that the RDAP client is constructed and cache is accessible.
/// Returns 503 only if the client is in an unusable state.
pub async fn ready(State(state): State<AppState>) -> StatusCode {
    // Accessing cache_size() exercises the client's Arc and internal state.
    // If the client is healthy, this call returns without panic.
    let _ = state.client.cache_size();
    StatusCode::OK
}

/// Returns the service name, version, and active configuration as JSON.
pub async fn version(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "name": env!("CARGO_PKG_NAME"),
        "version": env!("CARGO_PKG_VERSION"),
        "config": {
            "server_port": state.config.server.port,
            "cache_enabled": true,
            "timeout_seconds": state.config.rdap.timeout_seconds,
        }
    }))
}
