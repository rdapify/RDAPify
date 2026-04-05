//! RDAP protocol types and error definitions.
//!
//! Implements RFC 9083 data structures used across the RDAPify workspace.

#![forbid(unsafe_code)]

pub mod availability;
pub mod asn;
pub mod common;
pub mod domain;
pub mod entity;
pub mod error;
pub mod ip;
pub mod nameserver;

// ── Public re-exports ──────────────────────────────────────────────────────────
pub use asn::AsnResponse;
pub use availability::AvailabilityResult;
pub use common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapRole, RdapStatus, ResponseMeta};
pub use domain::{DomainResponse, RegistrarSummary};
pub use entity::EntityResponse;
pub use error::{RdapError, Result};
pub use ip::{IpResponse, IpVersion};
pub use nameserver::{NameserverIpAddresses, NameserverResponse};
