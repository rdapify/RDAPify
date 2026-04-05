//! Normalised RDAP nameserver response type.
//!
//! Follows RFC 9083 §5.2 (Nameserver Object Class).

use serde::{Deserialize, Serialize};

use crate::common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapStatus, ResponseMeta};

/// IP addresses associated with a nameserver (glue records).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NameserverIpAddresses {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub v4: Vec<String>,
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

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<RdapStatus>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entities: Vec<RdapEntity>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remarks: Vec<RdapRemark>,

    pub meta: ResponseMeta,
}
