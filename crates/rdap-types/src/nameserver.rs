//! Normalised RDAP nameserver response type.
//!
//! Follows RFC 9083 §5.2 (Nameserver Object Class).

use serde::{Deserialize, Serialize};

use crate::common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapStatus, ResponseMeta};

/// IP addresses associated with a nameserver (glue records).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NameserverIpAddresses {
    /// IPv4 glue addresses for this nameserver.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub v4: Vec<String>,
    /// IPv6 glue addresses for this nameserver.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub v6: Vec<String>,
}

/// Normalised RDAP response for a nameserver query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameserverResponse {
    /// The original query string (nameserver hostname).
    pub query: String,

    /// Registry handle.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// LDH (letters, digits, hyphens) form of the nameserver hostname.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ldh_name: Option<String>,

    /// Unicode form of the nameserver hostname.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unicode_name: Option<String>,

    /// Glue records (IPv4 and IPv6 addresses).
    #[serde(default)]
    pub ip_addresses: NameserverIpAddresses,

    /// Current status flags for this nameserver object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<RdapStatus>,

    /// Associated entities (e.g., technical, abuse contacts).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entities: Vec<RdapEntity>,

    /// Lifecycle events for this nameserver (registration, last changed, etc.).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,

    /// Hyperlinks associated with this nameserver object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,

    /// Remarks and annotations from the registry.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remarks: Vec<RdapRemark>,

    /// Query metadata (source server, timestamp, cache status).
    pub meta: ResponseMeta,
}
