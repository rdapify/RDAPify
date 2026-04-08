//! HTTP API service runtime for RDAPify.
//!
//! Exposes an Axum-based HTTP server that wraps `rdapify_client::RdapClient`
//! and provides a production-grade REST API suitable for Docker and Kubernetes.
//!
//! # Endpoints
//!
//! | Method | Path       | Description                         |
//! |--------|------------|-------------------------------------|
//! | GET    | `/health`  | Liveness probe — always 200 if alive |
//! | GET    | `/ready`   | Readiness probe — 200 when traffic-ready |
//! | GET    | `/version` | Service name + version as JSON       |
//! | GET    | `/metrics` | Prometheus text exposition format    |
//! | POST   | `/rdap`    | Single RDAP lookup (domain/ip/asn/ns)|
//! | POST   | `/batch`   | Batch domain-availability lookup     |
//!
//! # Running
//!
//! ```shell
//! cargo run --bin rdap-service
//! ```
//!
//! Configuration is loaded from `rdapify.toml` (or env overrides).
//! See [`rdap_config`] for the full configuration reference.

#![forbid(unsafe_code)]
