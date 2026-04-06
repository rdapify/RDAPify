//! Structured logging initialisation for RDAPify.
//!
//! Wraps [`tracing`] + [`tracing_subscriber`] with two-format output
//! (JSON for production, text for CLI) configured from [`rdap_config`].
//!
//! # Quick start
//!
//! ```rust,no_run
//! use rdap_config::LoggingConfig;
//! use rdap_logging::init_logging;
//!
//! // Initialise once at process start
//! init_logging(&LoggingConfig::default()); // Info level, JSON format
//!
//! // Use tracing macros anywhere in the codebase
//! tracing::info!(event = "startup", version = env!("CARGO_PKG_VERSION"));
//! ```
//!
//! # Structured fields
//!
//! Use tracing's key-value syntax to attach structured fields to log events.
//! The standard field names below are recognised by log aggregators and
//! dashboards:
//!
//! | Field         | Type    | Example                      |
//! |---------------|---------|------------------------------|
//! | `event`       | &str    | `"rdap_query"`               |
//! | `domain`      | display | `"example.com"`              |
//! | `rdap_server` | display | `"rdap.verisign.com"`        |
//! | `latency_ms`  | u64     | `42`                         |
//! | `cache`       | display | `"memory"`                   |
//! | `webhook_url` | display | `"https://hooks.slack.com/"` |
//! | `attempt`     | u32     | `3`                          |
//! | `error`       | display | `"connection refused"`       |
//! | `license_id`  | display | `"RDAP-PRO-…"`               |
//!
//! ## Examples
//!
//! RDAP query:
//! ```rust
//! # let domain = "example.com";
//! # let server = "rdap.verisign.com";
//! # let latency: u64 = 42;
//! # let cache_type = "memory";
//! tracing::info!(
//!     event = "rdap_query",
//!     domain = %domain,
//!     rdap_server = %server,
//!     latency_ms = latency,
//!     cache = %cache_type,
//! );
//! ```
//!
//! Webhook retry:
//! ```rust
//! # let url = "https://hooks.slack.com/T123/B456/abc";
//! # let attempt: u32 = 2;
//! # let delay = "5s";
//! tracing::warn!(
//!     event = "webhook_retry",
//!     webhook_url = %url,
//!     attempt = attempt,
//!     next_retry_in = %delay,
//! );
//! ```
//!
//! License revoked:
//! ```rust
//! # let license_id = "RDAP-PRO-abc123";
//! tracing::error!(
//!     event = "license_revoked",
//!     license_id = %license_id,
//! );
//! ```

#![forbid(unsafe_code)]

mod format;
mod init;

pub use init::init_logging;

// Re-export tracing so callers can use `rdap_logging::tracing::info!(...)` if
// they prefer not to take a direct dep on the tracing crate.
pub use tracing;
