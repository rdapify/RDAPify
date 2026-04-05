//! Normalised RDAP entity response type.
//!
//! Follows RFC 9083 §5.1 (Entity Object Class).
//!
//! Note: entities have no global bootstrap — the caller must supply
//! an explicit server URL.

use serde::{Deserialize, Serialize};

use crate::common::{
    RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapRole, RdapStatus, ResponseMeta,
};

/// Normalised RDAP response for an entity (contact/registrar) query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityResponse {
    /// The original query handle.
    pub query: String,

    /// Registry handle.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// vCard data (RFC 7095) — kept as raw JSON.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vcard_array: Option<serde_json::Value>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roles: Vec<RdapRole>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<RdapStatus>,

    /// Nested entities (e.g., technical contacts of a registrar).
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
