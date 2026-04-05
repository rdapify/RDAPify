//! Rate limiting for RDAP client queries.
//!
//! Provides per-registry and global rate limiters with configurable
//! windows and limits. Full implementation is Phase 1+.

#![forbid(unsafe_code)]

use std::time::Duration;

/// Configuration for a rate limiter.
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Maximum requests per window per registry host.
    pub max_per_host: u32,
    /// Maximum total requests per window across all registries.
    pub max_global: Option<u32>,
    /// The measurement window.
    pub window: Duration,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            max_per_host: 100,
            max_global: None,
            window: Duration::from_secs(60),
        }
    }
}

/// A rate limiter that can be shared across query tasks.
///
/// Phase 0: pass-through (always returns `Ok(())`).
/// Phase 1+: token-bucket or sliding-window implementation.
#[derive(Debug, Clone)]
pub struct RateLimiter {
    config: RateLimitConfig,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self { config }
    }

    /// Returns `Ok(())` if within rate limits, or `Err(Duration)` indicating
    /// how long to wait before retrying.
    ///
    /// Phase 0 always returns `Ok(())`.
    pub async fn check(&self, _host: &str) -> Result<(), Duration> {
        let _ = &self.config; // suppress unused warning
        Ok(())
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new(RateLimitConfig::default())
    }
}
