//! Validation rules for RDAPify configuration.
//!
//! | Field                    | Rule      |
//! |--------------------------|-----------|
//! | `rdap.timeout_seconds`   | 1–60      |
//! | `rdap.max_response_size_mb` | 1–20   |
//! | `cache.ttl_seconds`      | 60–86400  |
//! | `monitoring.workers`     | 1–32      |
//! | `webhooks.workers`       | 1–32      |
//! | `webhooks.timeout_seconds` | 1–60    |
//! | `license.grace_days`     | 0–30      |
//! | `metrics.port`           | 1–65535   |
//! | `server.port`            | 1–65535   |

use crate::{config::RdapifyConfig, ConfigError, Result};

/// Validate all fields in `config`, returning the first error found.
pub fn validate_config(config: &RdapifyConfig) -> Result<()> {
    // RDAP client
    check_range("rdap.timeout_seconds", config.rdap.timeout_seconds, 1, 60)?;
    check_range(
        "rdap.max_response_size_mb",
        config.rdap.max_response_size_mb,
        1,
        20,
    )?;

    // Cache
    check_range("cache.ttl_seconds", config.cache.ttl_seconds, 60, 86_400)?;

    // Monitoring
    check_range(
        "monitoring.workers",
        u64::from(config.monitoring.workers),
        1,
        32,
    )?;

    // Webhooks
    check_range(
        "webhooks.workers",
        u64::from(config.webhooks.workers),
        1,
        32,
    )?;
    check_range(
        "webhooks.timeout_seconds",
        config.webhooks.timeout_seconds,
        1,
        60,
    )?;

    // License
    check_range(
        "license.grace_days",
        u64::from(config.license.grace_days),
        0,
        30,
    )?;

    // Ports (u16 already caps at 65535; only reject 0)
    check_port("metrics.port", config.metrics.port)?;
    check_port("server.port", config.server.port)?;

    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn check_range(field: &str, value: u64, min: u64, max: u64) -> Result<()> {
    if value < min || value > max {
        return Err(ConfigError::ValidationError {
            field: field.to_string(),
            value: value.to_string(),
            reason: format!("must be between {min} and {max}"),
        });
    }
    Ok(())
}

fn check_port(field: &str, port: u16) -> Result<()> {
    if port == 0 {
        return Err(ConfigError::ValidationError {
            field: field.to_string(),
            value: "0".to_string(),
            reason: "must be between 1 and 65535".to_string(),
        });
    }
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::RdapifyConfig;

    #[test]
    fn defaults_are_valid() {
        assert!(validate_config(&RdapifyConfig::default()).is_ok());
    }

    #[test]
    fn timeout_too_low() {
        let mut cfg = RdapifyConfig::default();
        cfg.rdap.timeout_seconds = 0;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn timeout_too_high() {
        let mut cfg = RdapifyConfig::default();
        cfg.rdap.timeout_seconds = 61;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn ttl_below_minimum() {
        let mut cfg = RdapifyConfig::default();
        cfg.cache.ttl_seconds = 59;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn ttl_at_minimum() {
        let mut cfg = RdapifyConfig::default();
        cfg.cache.ttl_seconds = 60;
        assert!(validate_config(&cfg).is_ok());
    }

    #[test]
    fn workers_zero() {
        let mut cfg = RdapifyConfig::default();
        cfg.monitoring.workers = 0;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn workers_too_many() {
        let mut cfg = RdapifyConfig::default();
        cfg.webhooks.workers = 33;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn port_zero_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.server.port = 0;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn grace_days_at_limit() {
        let mut cfg = RdapifyConfig::default();
        cfg.license.grace_days = 30;
        assert!(validate_config(&cfg).is_ok());
    }

    #[test]
    fn grace_days_exceeded() {
        let mut cfg = RdapifyConfig::default();
        cfg.license.grace_days = 31;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn max_response_size_too_large() {
        let mut cfg = RdapifyConfig::default();
        cfg.rdap.max_response_size_mb = 21;
        assert!(validate_config(&cfg).is_err());
    }
}
