use std::sync::Arc;
use std::time::Duration;

use rdap_config::load_config;
use rdap_core::FetcherConfig;
use rdap_logging::init_logging;
use rdapify_client::{ClientConfig, RdapClient};
use tokio::net::TcpListener;

mod error;
mod handlers;
mod metrics;
mod router;
mod state;

use metrics::Metrics;
use state::AppState;

#[tokio::main]
async fn main() {
    // ── 1. Load configuration ──────────────────────────────────────────────────
    let config = match load_config(None) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("rdap-service: failed to load config: {e}");
            std::process::exit(1);
        }
    };

    // ── 2. Init structured logging ─────────────────────────────────────────────
    init_logging(&config.logging);

    tracing::info!(
        event = "startup",
        version = env!("CARGO_PKG_VERSION"),
        log_level = ?config.logging.level,
        log_format = ?config.logging.format,
    );

    // ── 2b. Install the engine metrics recorder BEFORE constructing the client.
    //        Engine hooks are wired through `metrics::counter!` etc., which
    //        require the global recorder to be present at the first call.
    #[cfg(feature = "metrics")]
    let engine_metrics = match rdap_metrics::install_recorder(
        &rdap_metrics::RecorderConfig::default(),
    ) {
        Ok(handle) => Arc::new(handle),
        Err(e) => {
            tracing::error!(
                event = "startup_failed",
                error = %e,
                reason = "rdap_metrics::install_recorder failed",
            );
            std::process::exit(1);
        }
    };

    // ── 3. Build RDAP client ───────────────────────────────────────────────────
    let client_config = ClientConfig {
        fetcher: FetcherConfig {
            timeout: Duration::from_secs(config.rdap.timeout_seconds),
            ..Default::default()
        },
        cache: true,
        reuse_connections: true,
        max_connections_per_host: 20,
        ..Default::default()
    };

    let client = match RdapClient::with_config(client_config) {
        Ok(c) => Arc::new(c),
        Err(e) => {
            tracing::error!(event = "startup_failed", error = %e, reason = "RdapClient construction failed");
            std::process::exit(1);
        }
    };

    // ── 4. Assemble application state ─────────────────────────────────────────
    let app_state = AppState {
        client,
        config: Arc::new(config.clone()),
        metrics: Arc::new(Metrics::new()),
        last_cache_stale: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        last_cache_negative: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        #[cfg(feature = "metrics")]
        engine_metrics,
    };

    // ── 5. Build router + middleware ───────────────────────────────────────────
    let app = router::build_router(app_state);

    // ── 6. Bind TCP listener ───────────────────────────────────────────────────
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!(event = "bind_failed", addr = %addr, error = %e);
            std::process::exit(1);
        }
    };

    tracing::info!(
        event = "listening",
        addr = %addr,
        cache_enabled = true,
        timeout_secs = config.rdap.timeout_seconds,
    );

    // ── 7. Serve with graceful shutdown ────────────────────────────────────────
    if let Err(e) = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
    {
        tracing::error!(event = "server_error", error = %e);
    }

    tracing::info!(event = "shutdown_complete");
}

/// Waits for either `SIGTERM` (Unix) or `Ctrl-C`.
///
/// Axum's graceful-shutdown wrapper stops accepting new connections and waits
/// for all in-flight requests to complete before the process exits.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c   => tracing::info!(event = "shutdown_signal", signal = "SIGINT"),
        _ = terminate => tracing::info!(event = "shutdown_signal", signal = "SIGTERM"),
    }
}
