//! SQLite persistence backend for RDAPify.
//!
//! # Status
//!
//! **Skeleton** — architectural placeholder.  Full implementation is planned
//! for a future release.
//!
//! # Architecture (planned)
//!
//! When complete, this crate will provide:
//!
//! * Persistent query history (domain/IP/ASN lookups with timestamps)
//! * Durable response cache (survives process restarts)
//! * Analytics data store (query frequency, response times)
//!
//! The backend is based on `rusqlite` (bundled SQLite).  It does **not**
//! depend on any network or web framework — it is a pure storage layer.
//!
//! # Enabling
//!
//! Enable the `sqlite` feature in the `rdapify` facade crate:
//!
//! ```toml
//! rdapify = { version = "0.3", features = ["sqlite"] }
//! ```

#![forbid(unsafe_code)]
