//! HTTP API service runtime for RDAPify.
//!
//! # Status
//!
//! **Skeleton** — architectural placeholder.  Full implementation is planned
//! for a future release.
//!
//! # Architecture (planned)
//!
//! When complete, this crate will provide an Axum-based HTTP server that
//! exposes the RDAP query API over a REST interface:
//!
//! ```text
//! GET /domain/{name}
//! GET /ip/{address}
//! GET /autnum/{asn}
//! GET /nameserver/{hostname}
//! GET /entity/{handle}
//! ```
//!
//! The service is **stateless**: it delegates every request to
//! `rdapify_client::RdapClient` and does not require a database.
//! Optional persistence (history, caching) can be layered in via
//! `rdap-sqlite` or `rdap-postgres`.
//!
//! # Enabling
//!
//! Enable the `service` feature in the `rdapify` facade crate:
//!
//! ```toml
//! rdapify = { version = "0.3", features = ["service"] }
//! ```

#![forbid(unsafe_code)]
