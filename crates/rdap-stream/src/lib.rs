//! Async streaming API for batch RDAP queries.
//!
//! The streaming methods on `RdapClient` return `ReceiverStream` values
//! that yield events as results arrive.

#![forbid(unsafe_code)]

use rdap_types::{error::RdapError, AsnResponse, DomainResponse, IpResponse, NameserverResponse};

// ── Events ────────────────────────────────────────────────────────────────────

/// Emitted by `stream_domain` for each queried domain.
#[derive(Debug)]
pub enum DomainEvent {
    Result(Box<DomainResponse>),
    Error { query: String, error: RdapError },
}

/// Emitted by `stream_ip` for each queried IP address.
#[derive(Debug)]
pub enum IpEvent {
    Result(Box<IpResponse>),
    Error { query: String, error: RdapError },
}

/// Emitted by `stream_asn` for each queried ASN.
#[derive(Debug)]
pub enum AsnEvent {
    Result(Box<AsnResponse>),
    Error { query: String, error: RdapError },
}

/// Emitted by `stream_nameserver` for each queried nameserver.
#[derive(Debug)]
pub enum NameserverEvent {
    Result(Box<NameserverResponse>),
    Error { query: String, error: RdapError },
}

// ── Configuration ─────────────────────────────────────────────────────────────

/// Configuration for streaming queries.
#[derive(Debug, Clone)]
pub struct StreamConfig {
    /// Channel buffer size (controls back-pressure). Default: 32.
    pub buffer_size: usize,
}

impl Default for StreamConfig {
    fn default() -> Self {
        Self { buffer_size: 32 }
    }
}
