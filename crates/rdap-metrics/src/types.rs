//! Bounded enums used as metric labels.
//!
//! Each variant carries a `&'static str` label suitable for direct use as a
//! Prometheus label value. Keeping the set bounded is what protects the
//! exporter from cardinality blow-up.

/// The kind of RDAP query that produced an event.
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum QueryType {
    Domain,
    Ip,
    Asn,
    Nameserver,
    Entity,
}

impl QueryType {
    pub const fn as_label(self) -> &'static str {
        match self {
            Self::Domain => "domain",
            Self::Ip => "ip",
            Self::Asn => "asn",
            Self::Nameserver => "nameserver",
            Self::Entity => "entity",
        }
    }
}

/// Outcome of a logical request from the user's perspective.
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum RequestStatus {
    Success,
    Error,
}

impl RequestStatus {
    pub const fn as_label(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Error => "error",
        }
    }
}

/// Outcome of a cache lookup.
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum CacheOutcome {
    Fresh,
    Stale,
    Miss,
    Negative,
}

impl CacheOutcome {
    pub const fn as_label(self) -> &'static str {
        match self {
            Self::Fresh => "fresh",
            Self::Stale => "stale",
            Self::Miss => "miss",
            Self::Negative => "negative",
        }
    }
}

/// Numeric circuit-breaker state matching the engine's representation.
///
/// `0=Closed, 1=Open, 2=HalfOpen`. The on-the-wire encoding is also `u8`,
/// so the gauge value reads as the same number a developer would see in
/// the engine's logs.
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
#[repr(u8)]
pub enum CircuitGaugeValue {
    Closed = 0,
    Open = 1,
    HalfOpen = 2,
}

impl CircuitGaugeValue {
    pub const fn as_f64(self) -> f64 {
        self as u8 as f64
    }
}
