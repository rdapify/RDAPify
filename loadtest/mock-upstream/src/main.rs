//! Stage E — deterministic mock RDAP upstream.
//!
//! A tiny axum server that answers RDAP queries with valid-looking JSON.
//! Used as the *upstream* target for the engine in the load-test harness so
//! the test never touches a real registry. Chaos knobs (latency, failure
//! rate, rate-limit rate) are exposed as command-line flags.
//!
//! Routes mirror the RDAP path shape the engine constructs:
//!
//!   GET /domain/<name>         200 application/rdap+json
//!   GET /ip/<addr>             200
//!   GET /autnum/<asn>          200
//!   GET /nameserver/<host>     200
//!
//! Plus a `/health` endpoint for the harness's readiness probe.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use clap::Parser;
use rand::Rng;
use serde_json::json;

#[derive(Parser, Debug, Clone)]
#[command(about = "Mock RDAP upstream for Stage E load tests")]
struct Args {
    /// Bind address.
    #[arg(long, default_value = "127.0.0.1:18080")]
    bind: String,

    /// Fixed delay applied to every successful response, in milliseconds.
    /// Simulates an upstream that's healthy but slow.
    #[arg(long, default_value = "0")]
    latency_ms: u64,

    /// Fraction of requests that respond 500 instead of 200, in [0.0, 1.0].
    /// Used by E4 (upstream failure).
    #[arg(long, default_value = "0.0")]
    failure_rate: f64,

    /// Fraction of requests that respond 429 with `Retry-After` instead of
    /// 200, in [0.0, 1.0]. Used by E5 (rate limiting).
    #[arg(long, default_value = "0.0")]
    rate_limit_rate: f64,

    /// `Retry-After` value (seconds) used when a 429 is emitted.
    #[arg(long, default_value = "5")]
    retry_after_secs: u64,

    /// Cache-Control max-age the upstream advertises on success.
    /// Set to 0 to omit the header. Used by E1 cache-warm scenarios.
    #[arg(long, default_value = "3600")]
    cache_max_age: u64,
}

#[derive(Clone)]
struct AppState {
    args: Arc<Args>,
    requests: Arc<AtomicU64>,
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
    let args = Args::parse();
    let state = AppState {
        args: Arc::new(args.clone()),
        requests: Arc::new(AtomicU64::new(0)),
    };
    let app = Router::new()
        .route("/health", get(health))
        .route("/stats", get(stats))
        .route("/domain/:name", get(domain))
        .route("/ip/:addr", get(ip))
        .route("/autnum/:asn", get(autnum))
        .route("/nameserver/:host", get(nameserver))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&args.bind)
        .await
        .unwrap_or_else(|e| panic!("mock-upstream: bind {} failed: {e}", args.bind));
    eprintln!(
        "mock-upstream: listening on http://{} (latency={}ms failure={} rate_limit={})",
        args.bind, args.latency_ms, args.failure_rate, args.rate_limit_rate
    );
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
        })
        .await
        .expect("mock-upstream: serve failed");
}

async fn health() -> &'static str {
    "ok"
}

async fn stats(State(s): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({
        "requests_served": s.requests.load(Ordering::Relaxed),
    }))
}

async fn domain(State(s): State<AppState>, Path(name): Path<String>) -> impl IntoResponse {
    serve(s, "domain", &name).await
}
async fn ip(State(s): State<AppState>, Path(addr): Path<String>) -> impl IntoResponse {
    serve(s, "ip network", &addr).await
}
async fn autnum(State(s): State<AppState>, Path(asn): Path<String>) -> impl IntoResponse {
    serve(s, "autnum", &asn).await
}
async fn nameserver(State(s): State<AppState>, Path(host): Path<String>) -> impl IntoResponse {
    serve(s, "nameserver", &host).await
}

async fn serve(
    s: AppState,
    object_class: &'static str,
    handle: &str,
) -> (StatusCode, HeaderMap, String) {
    s.requests.fetch_add(1, Ordering::Relaxed);

    // ── Chaos: 429 first, 500 second, success otherwise ───────────────────
    let roll: f64 = rand::thread_rng().gen();
    if roll < s.args.rate_limit_rate {
        let mut h = HeaderMap::new();
        h.insert(
            "retry-after",
            HeaderValue::from_str(&s.args.retry_after_secs.to_string()).unwrap(),
        );
        h.insert(
            "content-type",
            HeaderValue::from_static("application/rdap+json"),
        );
        return (StatusCode::TOO_MANY_REQUESTS, h, r#"{"errorCode":429}"#.to_string());
    }
    if roll < s.args.rate_limit_rate + s.args.failure_rate {
        let mut h = HeaderMap::new();
        h.insert(
            "content-type",
            HeaderValue::from_static("application/rdap+json"),
        );
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            h,
            r#"{"errorCode":500}"#.to_string(),
        );
    }

    if s.args.latency_ms > 0 {
        tokio::time::sleep(Duration::from_millis(s.args.latency_ms)).await;
    }

    let body = json!({
        "objectClassName": object_class,
        "ldhName": handle,
        "handle": handle,
        "rdapConformance": ["rdap_level_0"],
        "events": [
            {"eventAction": "registration", "eventDate": "2020-01-01T00:00:00Z"},
        ],
    })
    .to_string();

    let mut h = HeaderMap::new();
    h.insert(
        "content-type",
        HeaderValue::from_static("application/rdap+json"),
    );
    if s.args.cache_max_age > 0 {
        let v = format!("public, max-age={}", s.args.cache_max_age);
        h.insert("cache-control", HeaderValue::from_str(&v).unwrap());
    }
    (StatusCode::OK, h, body)
}
