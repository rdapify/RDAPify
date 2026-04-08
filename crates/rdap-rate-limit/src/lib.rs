//! Production-grade rate limiting for RDAP queries.
//!
//! Uses **GCRA** (Generic Cell Rate Algorithm) via the [`governor`] crate.
//! GCRA is the most accurate algorithm for rate limiting — it tracks when the
//! next cell is allowed rather than approximating with counters, so burst
//! headroom is never wasted and wait times are exact.
//!
//! # Design
//!
//! ```text
//! RdapRateLimiter
//!   ├── GlobalLimiter       (optional)  — caps total throughput
//!   └── PerHostLimiter      (required)  — isolates each RDAP registry
//!         └── DashMap<host → Arc<DirectLimiter>>
//! ```
//!
//! Key decisions:
//! - **DashMap + Arc**: the guard is dropped before the `.await`, so there
//!   is no DashMap ref held across suspension points.
//! - **Tokio sleep**: the async `acquire()` path uses `tokio::time::sleep`
//!   so the wait integrates cleanly with the rest of the async stack.
//! - **No-op default**: default limits (10 rps / 20 burst per host, 100 rps
//!   global) are high enough to be transparent for normal usage but protect
//!   against batch abuse.
//!
//! # Usage
//!
//! ```rust,no_run
//! use rdap_rate_limit::{RdapRateLimiter, RateLimitConfig};
//!
//! #[tokio::main]
//! async fn main() {
//!     let limiter = RdapRateLimiter::default();
//!     limiter.acquire("rdap.verisign.com").await.unwrap();
//! }
//! ```

#![forbid(unsafe_code)]

use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use governor::{
    clock::{Clock, DefaultClock},
    state::{InMemoryState, NotKeyed},
    Quota, RateLimiter as GovernorLimiter,
};
use thiserror::Error;

// ── Error ─────────────────────────────────────────────────────────────────────

/// Errors returned by rate-limit checks.
#[derive(Debug, Error)]
pub enum RateLimitError {
    /// The request was rejected; the caller should wait at least this long
    /// before retrying.
    #[error("rate limited — retry after {0:?}")]
    Limited(Duration),
}

// ── Configuration ─────────────────────────────────────────────────────────────

/// Configuration for [`RdapRateLimiter`].
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Sustained requests-per-second per RDAP registry host.
    pub per_host_rps: u32,
    /// Initial burst capacity per host (the number of requests that may be
    /// served immediately before the sustained rate kicks in).
    pub per_host_burst: u32,

    /// Optional global sustained RPS across all hosts combined.
    /// `None` disables the global limiter entirely.
    pub global_rps: Option<u32>,
    /// Burst capacity for the global limiter (ignored when `global_rps` is
    /// `None`).
    pub global_burst: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            per_host_rps: 10,
            per_host_burst: 20,
            global_rps: Some(100),
            global_burst: 200,
        }
    }
}

// ── Internal type alias ───────────────────────────────────────────────────────

/// A single-key GCRA rate limiter backed by a single atomic cell.
type DirectLimiter = GovernorLimiter<NotKeyed, InMemoryState, DefaultClock>;

/// Build a `Quota` clamping `rps` and `burst` to at least 1.
fn make_quota(rps: u32, burst: u32) -> Quota {
    let rps = NonZeroU32::new(rps.max(1)).expect("rps >= 1");
    let burst = NonZeroU32::new(burst.max(1)).expect("burst >= 1");
    Quota::per_second(rps).allow_burst(burst)
}

/// Blocking check on a `DirectLimiter`, returning the exact wait time on
/// failure.
fn check(limiter: &DirectLimiter) -> Result<(), RateLimitError> {
    limiter.check().map_err(|not_until: governor::NotUntil<_>| {
        let clock = DefaultClock::default();
        RateLimitError::Limited(not_until.wait_time_from(clock.now()))
    })
}

// ── Global limiter ────────────────────────────────────────────────────────────

/// A shared rate limiter over the total outbound RDAP request rate.
struct GlobalLimiter {
    inner: Arc<DirectLimiter>,
}

impl std::fmt::Debug for GlobalLimiter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GlobalLimiter").finish_non_exhaustive()
    }
}

impl GlobalLimiter {
    fn new(rps: u32, burst: u32) -> Self {
        Self {
            inner: Arc::new(GovernorLimiter::direct(make_quota(rps, burst))),
        }
    }

    /// Async acquire: sleeps until the global budget allows the request.
    async fn acquire(&self) -> Result<(), RateLimitError> {
        loop {
            match check(&self.inner) {
                Ok(()) => return Ok(()),
                Err(RateLimitError::Limited(wait)) => {
                    tokio::time::sleep(wait).await;
                }
            }
        }
    }

    /// Non-blocking check — returns `Err(Limited(_))` immediately if over quota.
    fn try_acquire(&self) -> Result<(), RateLimitError> {
        check(&self.inner)
    }
}

// ── Per-host limiter ──────────────────────────────────────────────────────────

/// A separate GCRA limiter per RDAP registry host.
///
/// Uses `DashMap<host, Arc<DirectLimiter>>` so that:
/// - The DashMap entry guard is dropped before any `.await` point.
/// - Each host has its own independent cell budget.
/// - New hosts are created lazily on first access.
struct PerHostLimiter {
    map: DashMap<String, Arc<DirectLimiter>>,
    quota: Quota,
}

impl std::fmt::Debug for PerHostLimiter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PerHostLimiter")
            .field("host_count", &self.map.len())
            .finish_non_exhaustive()
    }
}

impl PerHostLimiter {
    fn new(rps: u32, burst: u32) -> Self {
        Self {
            map: DashMap::new(),
            quota: make_quota(rps, burst),
        }
    }

    /// Returns the `Arc`-wrapped limiter for `host`, creating it if needed.
    ///
    /// The DashMap guard is **dropped immediately** when this function returns —
    /// the caller can safely `.await` on the returned `Arc`.
    fn get_or_create(&self, host: &str) -> Arc<DirectLimiter> {
        self.map
            .entry(host.to_string())
            .or_insert_with(|| Arc::new(GovernorLimiter::direct(self.quota)))
            .clone() // clones the Arc, not the limiter; guard is dropped here
    }

    /// Async acquire: sleeps until the per-host budget allows the request.
    async fn acquire(&self, host: &str) -> Result<(), RateLimitError> {
        let limiter = self.get_or_create(host); // guard already dropped
        loop {
            match check(&limiter) {
                Ok(()) => return Ok(()),
                Err(RateLimitError::Limited(wait)) => {
                    tokio::time::sleep(wait).await;
                }
            }
        }
    }

    /// Non-blocking check — returns `Err(Limited(_))` immediately if over quota.
    fn try_acquire(&self, host: &str) -> Result<(), RateLimitError> {
        check(&self.get_or_create(host))
    }
}

// ── Public RdapRateLimiter ────────────────────────────────────────────────────

/// Production-grade rate limiter for RDAP queries.
///
/// Enforces two independent limits:
/// - **Per-host** — prevents overloading a single registry (e.g. Verisign).
/// - **Global** (optional) — caps total outbound RDAP traffic.
///
/// Both limits use GCRA, so burst headroom is never wasted.
///
/// # Thread safety
///
/// `RdapRateLimiter` is `Send + Sync` and cheap to wrap in an `Arc`.
#[derive(Debug)]
pub struct RdapRateLimiter {
    global: Option<GlobalLimiter>,
    per_host: PerHostLimiter,
}

impl RdapRateLimiter {
    /// Creates a limiter from `config`.
    pub fn new(config: RateLimitConfig) -> Self {
        let global = config
            .global_rps
            .map(|rps| GlobalLimiter::new(rps, config.global_burst));
        let per_host = PerHostLimiter::new(config.per_host_rps, config.per_host_burst);
        Self { global, per_host }
    }

    /// Async acquire — waits until **both** global and per-host budgets allow
    /// the request.
    ///
    /// Call this **after a cache miss**, before the HTTP fetch.
    pub async fn acquire(&self, host: &str) -> Result<(), RateLimitError> {
        if let Some(global) = &self.global {
            global.acquire().await?;
        }
        self.per_host.acquire(host).await
    }

    /// Non-blocking check — returns `Err(Limited(wait))` immediately if
    /// either the global or per-host budget is exhausted.
    ///
    /// Useful for testing and for contexts where blocking is not acceptable.
    pub fn try_acquire(&self, host: &str) -> Result<(), RateLimitError> {
        if let Some(global) = &self.global {
            global.try_acquire()?;
        }
        self.per_host.try_acquire(host)
    }
}

impl Default for RdapRateLimiter {
    fn default() -> Self {
        Self::new(RateLimitConfig::default())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn per_host_only(rps: u32, burst: u32) -> RdapRateLimiter {
        RdapRateLimiter::new(RateLimitConfig {
            per_host_rps: rps,
            per_host_burst: burst,
            global_rps: None,
            global_burst: 0,
        })
    }

    #[test]
    fn burst_allows_initial_requests() {
        let limiter = per_host_only(5, 5);
        for _ in 0..5 {
            assert!(
                limiter.try_acquire("rdap.verisign.com").is_ok(),
                "burst should allow 5 immediate requests"
            );
        }
    }

    #[test]
    fn rate_limit_triggers_after_burst() {
        let limiter = per_host_only(5, 5);
        for _ in 0..5 {
            let _ = limiter.try_acquire("rdap.verisign.com");
        }
        assert!(
            matches!(
                limiter.try_acquire("rdap.verisign.com"),
                Err(RateLimitError::Limited(_))
            ),
            "6th request should be rate limited"
        );
    }

    #[test]
    fn per_host_isolation() {
        // Strict limit: burst of 1 so the second call to the same host fails
        let limiter = per_host_only(1, 1);

        assert!(limiter.try_acquire("rdap.verisign.com").is_ok());
        assert!(limiter.try_acquire("rdap.verisign.com").is_err());

        // Other hosts have their own independent budgets
        assert!(
            limiter.try_acquire("rdap.arin.net").is_ok(),
            "arin.net should have its own budget"
        );
        assert!(
            limiter.try_acquire("rdap.ripe.net").is_ok(),
            "ripe.net should have its own budget"
        );
    }

    #[test]
    fn limited_error_includes_wait_time() {
        let limiter = per_host_only(1, 1);
        let _ = limiter.try_acquire("rdap.verisign.com");

        match limiter.try_acquire("rdap.verisign.com") {
            Err(RateLimitError::Limited(wait)) => {
                assert!(wait > Duration::ZERO, "wait time must be positive");
                assert!(
                    wait <= Duration::from_secs(2),
                    "wait time should be at most 1 second for 1 rps"
                );
            }
            Ok(()) => panic!("expected a Limited error"),
        }
    }

    #[test]
    fn global_limiter_blocks_all_hosts() {
        let limiter = RdapRateLimiter::new(RateLimitConfig {
            per_host_rps: 100,
            per_host_burst: 100,
            global_rps: Some(3),
            global_burst: 3,
        });

        for _ in 0..3 {
            assert!(limiter.try_acquire("rdap.verisign.com").is_ok());
        }
        // Global exhausted — even a different host is blocked
        assert!(
            limiter.try_acquire("rdap.verisign.com").is_err(),
            "global limit blocks same host"
        );
        assert!(
            limiter.try_acquire("rdap.arin.net").is_err(),
            "global limit blocks different host too"
        );
    }

    #[tokio::test]
    async fn async_acquire_succeeds_within_budget() {
        // Default limits are high enough that a single call never blocks
        let limiter = RdapRateLimiter::default();
        limiter
            .acquire("rdap.verisign.com")
            .await
            .expect("first acquire should succeed immediately");
    }

    #[test]
    fn default_config_allows_reasonable_load() {
        let limiter = RdapRateLimiter::default(); // 10 rps / 20 burst
                                                  // 20 immediate requests should all succeed (burst window)
        for i in 0..20 {
            assert!(
                limiter.try_acquire("rdap.verisign.com").is_ok(),
                "request {i} should be within burst window"
            );
        }
        // 21st exceeds burst
        assert!(limiter.try_acquire("rdap.verisign.com").is_err());
    }
}
