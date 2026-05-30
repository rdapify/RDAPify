//! Normalised RDAP Autonomous System Number response type.
//!
//! Follows RFC 9083 §5.5 (Autonomous System Number Object Class).

use serde::{Deserialize, Serialize};

use crate::common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapStatus, ResponseMeta};

/// Normalised RDAP response for an ASN query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsnResponse {
    /// The original query value (numeric ASN).
    pub query: u32,

    /// Registry handle.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// First ASN in the assigned range.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_autnum: Option<u32>,

    /// Last ASN in the assigned range.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_autnum: Option<u32>,

    /// Human-readable name of the AS (e.g., "GOOGLE").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// Type of the autonomous system number assignment.
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub autnum_type: Option<String>,

    /// ISO 3166-1 alpha-2 country code of the registrant.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,

    /// Current status flags for this ASN object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<RdapStatus>,

    /// Associated entities (e.g., registrant, technical, abuse contacts).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entities: Vec<RdapEntity>,

    /// Lifecycle events for this ASN (registration, last changed, etc.).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,

    /// Hyperlinks associated with this ASN object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,

    /// Remarks and annotations from the registry.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remarks: Vec<RdapRemark>,

    /// Query metadata (source server, timestamp, cache status).
    pub meta: ResponseMeta,
}
