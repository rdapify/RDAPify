//! Prometheus-compatible metrics surface for the rdapify engine (Stage D, D1).
//!
//! This crate provides:
//!
//! - [`hooks`]: typed instrumentation entry points called from the engine's
//!   hot paths. Functions are no-ops when the `enabled` cargo feature is off,
//!   so consumer crates (`rdap-core`, `rdap-cache`, `rdapify-client`) can
//!   depend on `rdap-metrics` unconditionally and still ship a zero-overhead
//!   default build.
//! - [`redact`]: domain / IP / URL redaction helpers used by the structured
//!   logging layer to avoid PII leaks in dashboards and traces.
//! - [`types`]: bounded enum types (query type, request status, error class,
//!   cache outcome, retry class, circuit-state gauge value) used as metric
//!   labels. Cardinality is bounded by construction.
//!
//! When the `enabled` feature is on, this crate also provides:
//!
//! - [`install_recorder`]: install a process-global Prometheus recorder.
//! - [`render`]: render the current registry to Prometheus text format.
//!
//! ## Why feature-gated, not unconditional?
//!
//! The `metrics` facade has a global recorder that, even with a `NoopRecorder`
//! installed, performs an atomic load and a function-pointer dispatch on every
//! call. For an RDAP engine that may serve a few hundred thousand requests per
//! second under bulk-monitoring workloads, that's measurable. The `enabled`
//! feature lets us cleanly compile out every call site in benchmarks and in
//! deployments that don't want the dependency.
//!
//! ## Naming
//!
//! Metric names use the `rdap_*` prefix per Stage D. See
//! `RDAPify-Internal/DECISIONS.md` for the rationale.

#![forbid(unsafe_code)]

pub mod hooks;
pub mod redact;
pub mod sampling;
pub mod types;

pub use sampling::{fresh_request_id, resolve_verbose, should_sample};
pub use types::{CacheOutcome, CircuitGaugeValue, QueryType, RequestStatus};

#[cfg(feature = "enabled")]
mod exporter;

#[cfg(feature = "enabled")]
pub use exporter::{
    default_buckets, install_recorder, render, MetricsError, MetricsHandle, RecorderConfig,
};
