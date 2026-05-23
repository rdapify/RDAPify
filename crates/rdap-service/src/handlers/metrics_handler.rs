use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};

use crate::state::AppState;

/// Exposes all registered Prometheus metrics in the text exposition format.
///
/// Scrape with: `curl http://localhost:8080/metrics`
///
/// When the `metrics` cargo feature is enabled, the engine's canonical
/// `rdap_*` series (from `rdap-metrics`) are rendered after the local
/// service registry. The two registries register disjoint metric names
/// (see `metrics.rs` for the duplicate-name guard), so concatenation is
/// safe for Prometheus's text parser.
pub async fn metrics(State(state): State<AppState>) -> Response {
    // Sync stale/negative cache counters from the in-memory cache before encoding
    state.sync_cache_metrics();

    #[allow(unused_mut)]
    let mut body = state.metrics.encode_to_text();

    #[cfg(feature = "metrics")]
    {
        let engine_text = state.engine_metrics.render();
        if !engine_text.is_empty() {
            if !body.ends_with('\n') {
                body.push('\n');
            }
            body.push_str(&engine_text);
        }
    }

    (
        StatusCode::OK,
        [(
            header::CONTENT_TYPE,
            "text/plain; version=0.0.4; charset=utf-8",
        )],
        body,
    )
        .into_response()
}
