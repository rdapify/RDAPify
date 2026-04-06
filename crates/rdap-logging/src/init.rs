//! Logging initialisation entry point.

use rdap_config::LoggingConfig;

use crate::format::{install_json, install_text, level_filter};
use rdap_config::LogFormat;

/// Initialise the global `tracing` subscriber from a [`LoggingConfig`].
///
/// Must be called **once** at process start, before any log events are emitted.
/// Calling it a second time will panic (same as calling
/// [`tracing::subscriber::set_global_default`] twice).
///
/// # Format
///
/// | `config.format` | Behaviour                                    |
/// |-----------------|----------------------------------------------|
/// | `json`          | One JSON object per line, UTC timestamps     |
/// | `text`          | ANSI-coloured text, ANSI disabled for pipes  |
///
/// # Level
///
/// The minimum severity is taken from `config.level`.  The `RUST_LOG`
/// environment variable is **not** consulted; use `rdapify.toml` or the
/// `RDAPIFY_LOG_LEVEL` env override instead.
///
/// # Example
///
/// ```rust,no_run
/// use rdap_config::{LoggingConfig, LogLevel, LogFormat};
/// use rdap_logging::init_logging;
///
/// let cfg = LoggingConfig::default(); // Info + JSON
/// init_logging(&cfg);
///
/// tracing::info!(event = "startup", version = env!("CARGO_PKG_VERSION"));
/// ```
pub fn init_logging(config: &LoggingConfig) {
    let filter = level_filter(&config.level);

    match &config.format {
        LogFormat::Json => install_json(filter),
        LogFormat::Text => install_text(filter),
    }
}
