//! Environment variable overrides for RDAPify configuration.
//!
//! Variables listed below override any value set in the config file.
//!
//! | Variable              | Overrides              |
//! |-----------------------|------------------------|
//! | `RDAPIFY_RDAP_TIMEOUT`| `rdap.timeout_seconds` |
//! | `RDAPIFY_CACHE_TYPE`  | `cache.type`           |
//! | `RDAPIFY_SQLITE_PATH` | `sqlite.path`          |
//! | `RDAPIFY_LICENSE_PATH`| `license.path`         |
//! | `RDAPIFY_LOG_LEVEL`   | `logging.level`        |
//! | `RDAPIFY_LOG_FORMAT`  | `logging.format`       |
//! | `RDAPIFY_METRICS_PORT`| `metrics.port`         |
//! | `RDAPIFY_SERVER_PORT` | `server.port`          |

use crate::{
    config::{CacheType, LogFormat, LogLevel, RdapifyConfig},
    ConfigError, Result,
};

/// Apply environment variable overrides to an existing config.
///
/// Missing variables are silently ignored. Variables with unparseable values
/// return a [`ConfigError::EnvError`].
pub fn apply_env_overrides(config: &mut RdapifyConfig) -> Result<()> {
    // rdap.timeout_seconds
    if let Ok(val) = std::env::var("RDAPIFY_RDAP_TIMEOUT") {
        config.rdap.timeout_seconds = parse_u64("RDAPIFY_RDAP_TIMEOUT", &val)?;
    }

    // cache.type
    if let Ok(val) = std::env::var("RDAPIFY_CACHE_TYPE") {
        config.cache.backend = val
            .parse::<CacheType>()
            .map_err(|_| ConfigError::EnvError {
                var: "RDAPIFY_CACHE_TYPE".to_string(),
                reason: format!("expected memory|sqlite|postgres, got '{val}'"),
            })?;
    }

    // sqlite.path
    if let Ok(val) = std::env::var("RDAPIFY_SQLITE_PATH") {
        config.sqlite.path = val;
    }

    // license.path
    if let Ok(val) = std::env::var("RDAPIFY_LICENSE_PATH") {
        config.license.path = val;
    }

    // logging.level
    if let Ok(val) = std::env::var("RDAPIFY_LOG_LEVEL") {
        config.logging.level = val.parse::<LogLevel>().map_err(|_| ConfigError::EnvError {
            var: "RDAPIFY_LOG_LEVEL".to_string(),
            reason: format!("expected trace|debug|info|warn|error, got '{val}'"),
        })?;
    }

    // logging.format
    if let Ok(val) = std::env::var("RDAPIFY_LOG_FORMAT") {
        config.logging.format = val
            .parse::<LogFormat>()
            .map_err(|_| ConfigError::EnvError {
                var: "RDAPIFY_LOG_FORMAT".to_string(),
                reason: format!("expected json|text, got '{val}'"),
            })?;
    }

    // metrics.port
    if let Ok(val) = std::env::var("RDAPIFY_METRICS_PORT") {
        config.metrics.port = parse_port("RDAPIFY_METRICS_PORT", &val)?;
    }

    // server.port
    if let Ok(val) = std::env::var("RDAPIFY_SERVER_PORT") {
        config.server.port = parse_port("RDAPIFY_SERVER_PORT", &val)?;
    }

    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn parse_u64(var: &str, val: &str) -> Result<u64> {
    val.parse::<u64>().map_err(|_| ConfigError::EnvError {
        var: var.to_string(),
        reason: format!("expected a positive integer, got '{val}'"),
    })
}

fn parse_port(var: &str, val: &str) -> Result<u16> {
    val.parse::<u16>().map_err(|_| ConfigError::EnvError {
        var: var.to_string(),
        reason: format!("expected a port number (1–65535), got '{val}'"),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{CacheType, LogLevel, RdapifyConfig};
    use std::sync::Mutex;

    // Serialize all tests that touch env vars to avoid inter-thread races.
    // std::env::set_var / remove_var are not thread-safe across concurrent tests.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_env<F: FnOnce()>(key: &str, val: &str, f: F) {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var(key, val);
        f();
        std::env::remove_var(key);
    }

    #[test]
    fn overrides_rdap_timeout() {
        let mut cfg = RdapifyConfig::default();
        with_env("RDAPIFY_RDAP_TIMEOUT", "30", || {
            apply_env_overrides(&mut cfg).unwrap();
        });
        assert_eq!(cfg.rdap.timeout_seconds, 30);
    }

    #[test]
    fn overrides_cache_type() {
        let mut cfg = RdapifyConfig::default();
        with_env("RDAPIFY_CACHE_TYPE", "sqlite", || {
            apply_env_overrides(&mut cfg).unwrap();
        });
        assert_eq!(cfg.cache.backend, CacheType::Sqlite);
    }

    #[test]
    fn overrides_log_level() {
        let mut cfg = RdapifyConfig::default();
        with_env("RDAPIFY_LOG_LEVEL", "debug", || {
            apply_env_overrides(&mut cfg).unwrap();
        });
        assert_eq!(cfg.logging.level, LogLevel::Debug);
    }

    #[test]
    fn overrides_server_port() {
        let mut cfg = RdapifyConfig::default();
        with_env("RDAPIFY_SERVER_PORT", "9000", || {
            apply_env_overrides(&mut cfg).unwrap();
        });
        assert_eq!(cfg.server.port, 9000);
    }

    #[test]
    fn invalid_cache_type_returns_error() {
        let mut cfg = RdapifyConfig::default();
        with_env("RDAPIFY_CACHE_TYPE", "redis", || {
            assert!(apply_env_overrides(&mut cfg).is_err());
        });
    }

    #[test]
    fn invalid_timeout_returns_error() {
        let mut cfg = RdapifyConfig::default();
        with_env("RDAPIFY_RDAP_TIMEOUT", "not-a-number", || {
            assert!(apply_env_overrides(&mut cfg).is_err());
        });
    }
}
