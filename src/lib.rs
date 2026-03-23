//! # rdapify
//!
//! A unified, secure, high-performance RDAP client library for Rust.
//!
//! ## Features
//!
//! - **5 query types**: domain, IP, ASN, nameserver, entity
//! - **SSRF protection** built-in — blocks private / loopback / link-local addresses
//! - **IANA Bootstrap** (RFC 9224) — automatically discovers the correct RDAP server
//! - **In-memory cache** — reduces redundant network calls
//! - **Exponential back-off retries** for transient failures
//! - **Normalised responses** — consistent structure regardless of the RDAP server
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
//!     println!("Expires:   {:?}", domain.expiration_date());
//!
//!     let ip = client.ip("8.8.8.8").await?;
//!     println!("Country: {:?}", ip.country);
//!
//!     let asn = client.asn("AS15169").await?;
//!     println!("AS Name: {:?}", asn.name);
//!
//!     let ns = client.nameserver("ns1.google.com").await?;
//!     println!("IPv4: {:?}", ns.ip_addresses.v4);
//!
//!     let entity = client.entity("ARIN-HN-1", "https://rdap.arin.net/registry").await?;
//!     println!("Handle: {:?}", entity.handle);
//!
//!     Ok(())
//! }
//! ```

#![forbid(unsafe_code)]
#![cfg_attr(docsrs, warn(missing_docs))]
#![cfg_attr(docsrs, feature(doc_cfg))]

// ── Internal modules ──────────────────────────────────────────────────────────

pub mod bootstrap;
pub mod cache;
pub mod error;
pub mod http;
pub mod security;
pub mod stream;
pub mod types;

mod client;

// ── Public re-exports ─────────────────────────────────────────────────────────

pub use client::{ClientConfig, RdapClient};
pub use error::{RdapError, Result};

pub use types::{
    AsnResponse, AvailabilityResult, DomainResponse, EntityResponse, IpResponse, IpVersion,
    NameserverIpAddresses, NameserverResponse, RdapEntity, RdapEvent, RdapLink, RdapRemark,
    RdapRole, RdapStatus, RegistrarSummary, ResponseMeta,
};

pub use cache::{CacheConfig, MemoryCache};
pub use http::{FetcherConfig, Normalizer};
pub use security::{SsrfConfig, SsrfGuard};
pub use stream::{AsnEvent, DomainEvent, IpEvent, NameserverEvent, StreamConfig};
