//! Validation rules for RDAPify configuration.
//!
//! | Field                    | Rule      |
//! |--------------------------|-----------|
//! | `rdap.timeout_seconds`   | 1–30  (Stage F · F1)  |
//! | `rdap.max_response_size_mb` | 1–20   |
//! | `cache.ttl_seconds`      | 60–86400  |
//! | `monitoring.workers`     | 1–32      |
//! | `webhooks.workers`       | 1–32      |
//! | `webhooks.timeout_seconds` | 1–60    |
//! | `license.grace_days`     | 0–30      |
//! | `metrics.port`           | 1–65535   |
//! | `metrics.slow_request_threshold_ms` | 1–60000 |
//! | `metrics.top_n_origins`  | 1–1024    |
//! | `metrics.histogram_buckets` | strictly increasing positive finites |
//! | `server.port`            | 1–65535   |

use crate::{config::RdapifyConfig, ConfigError, Result};

/// Validate all fields in `config`, returning the first error found.
pub fn validate_config(config: &RdapifyConfig) -> Result<()> {
    // RDAP client (Stage F · F1: timeout capped at 30 s — see
    // `rdap-core::MAX_TIMEOUT`).
    check_range("rdap.timeout_seconds", config.rdap.timeout_seconds, 1, 30)?;
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

    // Metrics observability tunables (Stage D · D1)
    check_range(
        "metrics.slow_request_threshold_ms",
        config.metrics.slow_request_threshold_ms,
        1,
        60_000,
    )?;
    check_range(
        "metrics.top_n_origins",
        u64::from(config.metrics.top_n_origins),
        1,
        1024,
    )?;
    if let Some(buckets) = &config.metrics.histogram_buckets {
        if buckets.is_empty() {
            return Err(ConfigError::ValidationError {
                field: "metrics.histogram_buckets".to_string(),
                value: "[]".to_string(),
                reason: "must contain at least one bucket boundary".to_string(),
            });
        }
        // Buckets must be strictly increasing — Prometheus requires this and
        // the exporter will reject otherwise. Catch it here with a clearer
        // error message than the exporter would produce.
        for w in buckets.windows(2) {
            if w[0] >= w[1] {
                return Err(ConfigError::ValidationError {
                    field: "metrics.histogram_buckets".to_string(),
                    value: format!("{:?}", buckets),
                    reason: "boundaries must be strictly increasing".to_string(),
                });
            }
        }
        if buckets.iter().any(|b| !b.is_finite() || *b <= 0.0) {
            return Err(ConfigError::ValidationError {
                field: "metrics.histogram_buckets".to_string(),
                value: format!("{:?}", buckets),
                reason: "all boundaries must be finite and positive".to_string(),
            });
        }
    }

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
        // Stage F · F1: tightened from 60 → 30. Anything above is rejected.
        let mut cfg = RdapifyConfig::default();
        cfg.rdap.timeout_seconds = 31;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn timeout_at_new_upper_bound_is_accepted() {
        let mut cfg = RdapifyConfig::default();
        cfg.rdap.timeout_seconds = 30;
        assert!(validate_config(&cfg).is_ok());
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

    // ── Stage D · D1 — metrics observability fields ───────────────────────

    #[test]
    fn metrics_slow_request_threshold_zero_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.slow_request_threshold_ms = 0;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_slow_request_threshold_at_limits_ok() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.slow_request_threshold_ms = 1;
        assert!(validate_config(&cfg).is_ok());
        cfg.metrics.slow_request_threshold_ms = 60_000;
        assert!(validate_config(&cfg).is_ok());
        cfg.metrics.slow_request_threshold_ms = 60_001;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_top_n_origins_zero_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.top_n_origins = 0;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_top_n_origins_above_registry_capacity_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.top_n_origins = 1025;
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_histogram_buckets_empty_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.histogram_buckets = Some(vec![]);
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_histogram_buckets_not_increasing_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.histogram_buckets = Some(vec![0.1, 0.5, 0.5, 1.0]);
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_histogram_buckets_negative_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.histogram_buckets = Some(vec![-0.1, 0.5, 1.0]);
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_histogram_buckets_nan_rejected() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.histogram_buckets = Some(vec![0.001, f64::NAN, 1.0]);
        assert!(validate_config(&cfg).is_err());
    }

    #[test]
    fn metrics_histogram_buckets_strictly_increasing_ok() {
        let mut cfg = RdapifyConfig::default();
        cfg.metrics.histogram_buckets = Some(vec![0.001, 0.01, 0.1, 1.0, 10.0]);
        assert!(validate_config(&cfg).is_ok());
    }
}
