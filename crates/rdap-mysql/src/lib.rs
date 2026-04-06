//! MySQL / MariaDB persistence backend for RDAPify.
//!
//! # Status
//!
//! **Skeleton** — architectural placeholder.  Full implementation is planned
//! for a future release.
//!
//! # Architecture (planned)
//!
//! When complete, this crate will provide the same storage interface as
//! `rdap-sqlite` but backed by MySQL / MariaDB via `sqlx`.
//!
//! # Enabling
//!
//! Enable the `mysql` feature in the `rdapify` facade crate:
//!
//! ```toml
//! rdapify = { version = "0.3", features = ["mysql"] }
//! ```

#![forbid(unsafe_code)]
