//! Normalised RDAP IP network response type.
//!
//! Follows RFC 9083 §5.4 (IP Network Object Class).

use serde::{Deserialize, Serialize};

use crate::common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapStatus, ResponseMeta};

/// IP protocol version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum IpVersion {
    /// Internet Protocol version 4.
    #[serde(rename = "v4")]
    V4,
    /// Internet Protocol version 6.
    #[serde(rename = "v6")]
    V6,
}

/// Normalised RDAP response for an IP address query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpResponse {
    /// The original query string (IP address).
    pub query: String,

    /// Registry handle.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// First address in the CIDR block.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_address: Option<String>,

    /// Last address in the CIDR block.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_address: Option<String>,

    /// IP version of the network block.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_version: Option<IpVersion>,

    /// Human-readable name of the allocation (e.g., "GOOGLE").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Allocation type (e.g., "DIRECT ALLOCATION").
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub allocation_type: Option<String>,

    /// ISO 3166-1 alpha-2 country code.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,

    /// Parent network handle (for sub-allocations).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_handle: Option<String>,

    /// Current status flags for this IP network object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<RdapStatus>,

    /// Associated entities (e.g., registrant, technical, abuse contacts).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entities: Vec<RdapEntity>,

    /// Lifecycle events for this IP network (registration, last changed, etc.).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,

    /// Hyperlinks associated with this IP network object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,

    /// Remarks and annotations from the registry.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remarks: Vec<RdapRemark>,

    /// Query metadata (source server, timestamp, cache status).
    pub meta: ResponseMeta,
}
