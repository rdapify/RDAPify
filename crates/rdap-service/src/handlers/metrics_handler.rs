use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};

use crate::state::AppState;

/// Exposes all registered Prometheus metrics in the text exposition format.
///
/// Scrape with: `curl http://localhost:8080/metrics`
pub async fn metrics(State(state): State<AppState>) -> Response {
    let body = state.metrics.encode_to_text();

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
