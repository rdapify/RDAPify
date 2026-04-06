//! Configuration system for RDAPify.
//!
//! Loads [`RdapifyConfig`] from a TOML file and environment variables,
//! applies safe defaults for missing fields, and validates all values
//! before returning.
//!
//! # Quick start
//!
//! ```rust,no_run
//! use rdap_config::load_config;
//!
//! let config = load_config(None).expect("valid config");
//! println!("Timeout:    {}s",   config.rdap.timeout_seconds);
//! println!("Log level:  {:?}",  config.logging.level);
//! println!("Server:     {}:{}", config.server.host, config.server.port);
//! ```
//!
//! # Config file search order
//!
//! | Priority | Source                        |
//! |----------|-------------------------------|
//! | 1        | `--config <path>` CLI flag    |
//! | 2        | `$RDAPIFY_CONFIG`             |
//! | 3        | `./rdapify.toml`              |
//! | 4        | `~/.rdapify/rdapify.toml`     |
//! | 5        | `/etc/rdapify/rdapify.toml`   |
//!
//! If no file is found, all-default configuration is used without error.
//!
//! # Environment variable overrides
//!
//! | Variable               | Config field           |
//! |------------------------|------------------------|
//! | `RDAPIFY_RDAP_TIMEOUT` | `rdap.timeout_seconds` |
//! | `RDAPIFY_CACHE_TYPE`   | `cache.type`           |
//! | `RDAPIFY_SQLITE_PATH`  | `sqlite.path`          |
//! | `RDAPIFY_LICENSE_PATH` | `license.path`         |
//! | `RDAPIFY_LOG_LEVEL`    | `logging.level`        |
//! | `RDAPIFY_LOG_FORMAT`   | `logging.format`       |
//! | `RDAPIFY_METRICS_PORT` | `metrics.port`         |
//! | `RDAPIFY_SERVER_PORT`  | `server.port`          |

#![forbid(unsafe_code)]

mod config;
mod env;
mod loader;
mod validate;

pub use config::{
    CacheConfig, CacheType, LicenseConfig, LogFormat, LogLevel, LoggingConfig, MetricsConfig,
    MonitoringConfig, RdapConfig, RdapifyConfig, ServerConfig, SqliteConfig, WebhookConfig,
};
pub use loader::{expand_tilde, load_config};

use thiserror::Error;

/// Errors produced by the configuration system.
#[derive(Debug, Error)]
pub enum ConfigError {
    /// An explicit config path (from `--config` or `$RDAPIFY_CONFIG`) does not
    /// exist on disk.
    #[error("Config file not found: {0}")]
    FileNotFound(String),

    /// A config file exists but could not be read (permissions, I/O error, etc.).
    #[error("Failed to read config file '{path}': {source}")]
    ReadError {
        path: String,
        #[source]
        source: std::io::Error,
    },

    /// A config file exists and was read, but is not valid TOML or does not
    /// match the expected schema.
    #[error("Failed to parse config file '{path}': {source}")]
    ParseError {
        path: String,
        #[source]
        source: toml::de::Error,
    },

    /// A field value is outside the allowed range or fails a business rule.
    #[error("Invalid config value for '{field}' = {value}: {reason}")]
    ValidationError {
        field: String,
        value: String,
        reason: String,
    },

    /// An environment variable override contains an unparseable value.
    #[error("Invalid environment variable {var}: {reason}")]
    EnvError { var: String, reason: String },
}

/// Convenience `Result` alias for this crate.
pub type Result<T> = std::result::Result<T, ConfigError>;
