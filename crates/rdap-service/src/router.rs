use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use axum::http::StatusCode;
use axum::{
    extract::DefaultBodyLimit,
    http::{HeaderValue, Request},
    routing::{get, post},
    Router,
};
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    request_id::{MakeRequestId, PropagateRequestIdLayer, RequestId, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

use crate::{handlers, state::AppState};

/// Generates monotonically increasing integer request IDs.
///
/// Avoids a `uuid` dependency while still giving every request a unique,
/// ordered identifier that is useful in logs and distributed traces.
#[derive(Clone, Default)]
struct SequentialRequestId;

impl MakeRequestId for SequentialRequestId {
    fn make_request_id<B>(&mut self, _: &Request<B>) -> Option<RequestId> {
        static COUNTER: AtomicU64 = AtomicU64::new(1);
        let id = COUNTER.fetch_add(1, Ordering::Relaxed);
        HeaderValue::from_str(&id.to_string())
            .ok()
            .map(RequestId::new)
    }
}

/// Builds the fully-configured Axum router.
///
/// Middleware stack (outermost → innermost, i.e. first-to-run for requests):
/// 1. `SetRequestIdLayer`      — stamps `x-request-id` on every request
/// 2. `TraceLayer`             — opens a tracing span per request
/// 3. `TimeoutLayer`           — enforces a 30-second per-request deadline
/// 4. `CompressionLayer`       — gzip-compresses responses when accepted
/// 5. `PropagateRequestIdLayer`— echoes `x-request-id` in the response header
/// 6. `DefaultBodyLimit`       — rejects request bodies larger than 1 MiB
pub fn build_router(state: AppState) -> Router {
    Router::new()
        // ── Operational endpoints ──────────────────────────────────────────────
        .route("/health", get(handlers::health::health))
        .route("/ready", get(handlers::health::ready))
        .route("/version", get(handlers::health::version))
        .route("/metrics", get(handlers::metrics_handler::metrics))
        // ── RDAP API endpoints ────────────────────────────────────────────────
        .route("/rdap", post(handlers::rdap::rdap_lookup))
        .route("/batch", post(handlers::batch::batch_lookup))
        // ── Body size guard (applied per route, before other middleware) ───────
        .layer(DefaultBodyLimit::max(1024 * 1024)) // 1 MiB
        // ── Middleware stack ───────────────────────────────────────────────────
        .layer(
            ServiceBuilder::new()
                .layer(SetRequestIdLayer::x_request_id(SequentialRequestId))
                .layer(TraceLayer::new_for_http())
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::GATEWAY_TIMEOUT,
                    Duration::from_secs(30),
                ))
                .layer(CompressionLayer::new())
                .layer(PropagateRequestIdLayer::x_request_id()),
        )
        .with_state(state)
}
