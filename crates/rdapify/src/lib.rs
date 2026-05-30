//! # rdapify
//!
//! A unified, secure, high-performance RDAP client library for Rust.
//!
//! This crate is the public API facade that re-exports workspace crates
//! with configurable feature flags for minimal binary sizes.
//!
//! ## Feature flags
//!
//! | Feature        | Default | Description                                      |
//! |----------------|---------|--------------------------------------------------|
//! | `memory-cache` | ✓       | In-memory moka response cache (TinyLFU eviction) |
//! | `stream`       | ✓       | Async streaming query API (`tokio-stream`)       |
//! | `batch`        |         | Batch query execution with concurrency control   |
//! | `rate-limit`   |         | Per-registry and global rate limiting            |
//! | `sqlite`       |         | SQLite persistence backend                       |
//! | `postgres`     |         | PostgreSQL persistence backend                   |
//! | `mysql`        |         | MySQL / MariaDB persistence backend              |
//! | `service`      |         | HTTP API service runtime (Axum-based)            |
//! | `full`         |         | Enables: `memory-cache`, `stream`, `batch`, `rate-limit` |
//!
//! ## Quick start
//!
//! ```rust,no_run
//! use rdapify::RdapClient;
//!
//! #[tokio::main]
//! async fn main() -> rdapify::error::Result<()> {
//!     let client = RdapClient::new()?;
//!
//!     let domain = client.domain("example.com").await?;
//!     println!("Registrar: {:?}", domain.registrar);
//!
//!     let ip = client.ip("8.8.8.8").await?;
//!     println!("Country: {:?}", ip.country);
//!
//!     Ok(())
//! }
//! ```

#![forbid(unsafe_code)]
#![deny(missing_docs)]

// ── Core re-exports (always available) ───────────────────────────────────────

pub use rdap_types::error::{RdapError, Result};
pub use rdapify_client::{ClientConfig, RdapClient};

pub use rdap_types::{
    AsnResponse, AvailabilityResult, DomainResponse, EntityResponse, IpResponse, IpVersion,
    NameserverIpAddresses, NameserverResponse, RdapEntity, RdapEvent, RdapLink, RdapRemark,
    RdapRole, RdapStatus, RegistrarSummary, ResponseMeta,
};

pub use rdap_core::{FetcherConfig, Normalizer};
pub use rdap_security::{SsrfConfig, SsrfGuard};

// ── Feature-gated flat re-exports ────────────────────────────────────────────

#[cfg(feature = "memory-cache")]
pub use rdap_cache::{CacheConfig, CachePolicy, CacheStats, CacheStatus, MemoryCache};

#[cfg(feature = "stream")]
pub use rdapify_client::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};

// ── Always-available modules ──────────────────────────────────────────────────

/// Error types for all rdapify operations.
pub mod error {
    pub use rdap_types::error::*;
}

/// IANA bootstrap server discovery (RFC 9224).
pub mod bootstrap {
    pub use rdap_bootstrap::Bootstrap;
}

/// Low-level HTTP fetcher and response normalizer.
pub mod http {
    pub use rdap_core::{Fetcher, FetcherConfig, Normalizer};
}

/// SSRF protection and secure fetch utilities.
pub mod security {
    pub use rdap_security::{SsrfConfig, SsrfGuard};
}

/// RDAP response types (RFC 9083).
pub mod types {
    pub use rdap_types::*;
}

// ── Feature-gated modules ─────────────────────────────────────────────────────

#[cfg(feature = "memory-cache")]
pub mod cache {
    //! In-memory response cache.
    pub use rdap_cache::{CacheConfig, CachePolicy, MemoryCache};
}

#[cfg(feature = "stream")]
pub mod stream {
    //! Async streaming query events.
    pub use rdapify_client::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};
}

#[cfg(feature = "batch")]
pub mod batch {
    //! Batch query execution with concurrency control.
    pub use rdap_batch::BatchExecutor;
}

#[cfg(feature = "rate-limit")]
pub mod rate_limit {
    //! Per-registry and global rate limiting.
    //!
    //! [`RdapRateLimiter`] is the engine's outbound rate-limit gate; wire
    //! it into [`crate::ClientConfig::rate_limit`] via [`RateLimitConfig`].
    pub use rdap_rate_limit::{RateLimitConfig, RdapRateLimiter};
}

/// Prometheus-compatible metrics surface (Stage D · D1).
///
/// Off by default; enable the `metrics` feature to install a process-wide
/// Prometheus recorder and instrument the engine's hot paths. With the
/// feature off the engine pays zero overhead — every hook compiles to an
/// inline no-op.
#[cfg(feature = "metrics")]
pub mod metrics {
    pub use rdap_metrics::{
        default_buckets, fresh_request_id, hooks, install_recorder, redact, render,
        resolve_verbose, sampling, should_sample, types, CacheOutcome, CircuitGaugeValue,
        MetricsError, MetricsHandle, QueryType, RecorderConfig, RequestStatus,
    };
}

// The four backend modules below are namespace placeholders reserved for
// the persistence and service runtimes shipped in separate crates
// (`rdap-sqlite`, `rdap-postgres`, `rdap-mysql`, `rdap-service`). The
// public path is stable from v1.0 onward; the contents will land in a
// future minor release without changing these module paths.

/// SQLite persistence backend — reserved namespace (impl in `rdap-sqlite`).
#[cfg(feature = "sqlite")]
pub mod sqlite {}

/// PostgreSQL persistence backend — reserved namespace (impl in `rdap-postgres`).
#[cfg(feature = "postgres")]
pub mod postgres {}

/// MySQL / MariaDB persistence backend — reserved namespace (impl in `rdap-mysql`).
#[cfg(feature = "mysql")]
pub mod mysql {}

/// HTTP API service runtime — reserved namespace (impl in `rdap-service`).
#[cfg(feature = "service")]
pub mod service {}
