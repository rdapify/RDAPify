//! # rdapify
//!
//! A unified, secure, high-performance RDAP client library for Rust.
//!
//! This crate is the public API facade that re-exports all workspace crates
//! in a single, backward-compatible surface.
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

// ── Public re-exports from workspace crates ───────────────────────────────────

pub use rdap_types::error::{RdapError, Result};
pub use rdapify_client::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};
pub use rdapify_client::{ClientConfig, RdapClient};

pub use rdap_types::{
    AsnResponse, AvailabilityResult, DomainResponse, EntityResponse, IpResponse, IpVersion,
    NameserverIpAddresses, NameserverResponse, RdapEntity, RdapEvent, RdapLink, RdapRemark,
    RdapRole, RdapStatus, RegistrarSummary, ResponseMeta,
};

pub use rdap_cache::{CacheConfig, MemoryCache};
pub use rdap_core::{FetcherConfig, Normalizer};
pub use rdap_security::{SsrfConfig, SsrfGuard};

// ── Module-level re-exports ───────────────────────────────────────────────────

pub mod error {
    pub use rdap_types::error::*;
}

pub mod bootstrap {
    pub use rdap_bootstrap::Bootstrap;
}

pub mod cache {
    pub use rdap_cache::{CacheConfig, MemoryCache};
}

pub mod http {
    pub use rdap_core::{Fetcher, FetcherConfig, Normalizer};
}

pub mod security {
    pub use rdap_security::{SsrfConfig, SsrfGuard};
}

pub mod stream {
    pub use rdap_stream::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};
}

pub mod types {
    pub use rdap_types::*;
}
