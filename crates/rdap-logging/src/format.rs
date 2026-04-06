//! Formatter builders for the two supported log output styles.
//!
//! * [`install_json`] — machine-readable JSON, one object per line.
//!   Used in production, Docker, and service mode.
//! * [`install_text`] — human-readable ANSI-coloured text.
//!   Used in CLI mode.
//!
//! Both include: timestamp (UTC ISO 8601) · level · target · thread-id.

use std::io::IsTerminal as _;

use tracing_subscriber::{fmt::time::UtcTime, EnvFilter};

// ISO 8601 / RFC 3339 with millisecond precision, e.g. "2026-04-05T12:34:56.789Z"
const TIME_FORMAT: &[time::format_description::BorrowedFormatItem<'static>] = time::macros::format_description!(
    "[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:3]Z"
);

// ── Public helpers ────────────────────────────────────────────────────────────

/// Build a [`EnvFilter`] from a [`rdap_config::LogLevel`].
pub(crate) fn level_filter(level: &rdap_config::LogLevel) -> EnvFilter {
    let directive = match level {
        rdap_config::LogLevel::Trace => "trace",
        rdap_config::LogLevel::Debug => "debug",
        rdap_config::LogLevel::Info => "info",
        rdap_config::LogLevel::Warn => "warn",
        rdap_config::LogLevel::Error => "error",
    };
    EnvFilter::try_new(directive).unwrap_or_else(|_| EnvFilter::new("info"))
}

/// Install a **JSON** subscriber as the global default.
///
/// Each event is written as a single compact JSON object to `stdout`:
/// ```text
/// {"timestamp":"2026-04-05T12:00:00.000Z","level":"INFO","target":"rdap_core",
///  "fields":{"event":"rdap_query","domain":"example.com","latency_ms":42}}
/// ```
///
/// # Panics
///
/// Panics if a global subscriber has already been set (i.e. `init_logging`
/// was called twice).
pub(crate) fn install_json(filter: EnvFilter) {
    let subscriber = tracing_subscriber::fmt()
        .json()
        .with_timer(UtcTime::new(TIME_FORMAT))
        .with_target(true)
        .with_thread_ids(true)
        .with_current_span(false)
        .with_span_list(false)
        .with_env_filter(filter)
        .with_writer(std::io::stdout)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .expect("init_logging must be called only once");
}

/// Install a **text** subscriber as the global default.
///
/// Writes human-readable lines to `stdout`.  ANSI colours are enabled only
/// when stdout is connected to a real TTY; they are suppressed when output is
/// piped or redirected.
///
/// ```text
/// 2026-04-05T12:00:00.000Z  INFO rdap_core: rdap_query domain=example.com latency_ms=42
/// ```
///
/// # Panics
///
/// Panics if a global subscriber has already been set.
pub(crate) fn install_text(filter: EnvFilter) {
    let ansi = std::io::stdout().is_terminal();

    let subscriber = tracing_subscriber::fmt()
        .with_timer(UtcTime::new(TIME_FORMAT))
        .with_target(true)
        .with_thread_ids(true)
        .with_ansi(ansi)
        .with_env_filter(filter)
        .with_writer(std::io::stdout)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .expect("init_logging must be called only once");
}
