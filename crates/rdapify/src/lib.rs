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
//! | `memory-cache` | ✓       | In-memory DashMap response cache                 |
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
pub use rdap_cache::{CacheConfig, MemoryCache};

#[cfg(feature = "stream")]
pub use rdapify_client::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};

// ── Always-available modules ──────────────────────────────────────────────────

pub mod error {
    pub use rdap_types::error::*;
}

pub mod bootstrap {
    pub use rdap_bootstrap::Bootstrap;
}

pub mod http {
    pub use rdap_core::{Fetcher, FetcherConfig, Normalizer};
}

pub mod security {
    pub use rdap_security::{SsrfConfig, SsrfGuard};
}

pub mod types {
    pub use rdap_types::*;
}

// ── Feature-gated modules ─────────────────────────────────────────────────────

#[cfg(feature = "memory-cache")]
pub mod cache {
    //! In-memory response cache.
    pub use rdap_cache::{CacheConfig, MemoryCache};
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
    pub use rdap_rate_limit::{RateLimitConfig, RateLimiter};
}

/// SQLite persistence backend (skeleton — full impl pending).
#[cfg(feature = "sqlite")]
pub mod sqlite {}

/// PostgreSQL persistence backend (skeleton — full impl pending).
#[cfg(feature = "postgres")]
pub mod postgres {}

/// MySQL / MariaDB persistence backend (skeleton — full impl pending).
#[cfg(feature = "mysql")]
pub mod mysql {}

/// HTTP API service runtime (skeleton — full impl pending).
#[cfg(feature = "service")]
pub mod service {}
