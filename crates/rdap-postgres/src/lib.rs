//! PostgreSQL persistence backend for RDAPify.
//!
//! # Status
//!
//! **Skeleton** — architectural placeholder.  Full implementation is planned
//! for a future release.
//!
//! # Architecture (planned)
//!
//! When complete, this crate will provide the same storage interface as
//! `rdap-sqlite` but backed by PostgreSQL via `sqlx` (async, no ORM).
//! Suitable for production deployments requiring multi-process concurrency
//! or horizontal scaling.
//!
//! # Enabling
//!
//! Enable the `postgres` feature in the `rdapify` facade crate:
//!
//! ```toml
//! rdapify = { version = "0.3", features = ["postgres"] }
//! ```

#![forbid(unsafe_code)]
