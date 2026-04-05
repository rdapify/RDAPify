//! Shared RDAP data types used across all response objects.
//!
//! Follows RFC 9083 §4 (Common Data Structures).

use serde::{Deserialize, Serialize};

// ── Status values (RFC 9083 §10.2.2) ─────────────────────────────────────────

/// Registration status values defined in RFC 9083 §10.2.2.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RdapStatus {
    Validated,
    #[serde(rename = "renew prohibited")]
    RenewProhibited,
    #[serde(rename = "update prohibited")]
    UpdateProhibited,
    #[serde(rename = "transfer prohibited")]
    TransferProhibited,
    #[serde(rename = "delete prohibited")]
    DeleteProhibited,
    Proxy,
    Private,
    Removed,
    Obscured,
    Associated,
    Active,
    Inactive,
    Locked,
    #[serde(rename = "pending create")]
    PendingCreate,
    #[serde(rename = "pending renew")]
    PendingRenew,
    #[serde(rename = "pending transfer")]
    PendingTransfer,
    #[serde(rename = "pending update")]
    PendingUpdate,
    #[serde(rename = "pending delete")]
    PendingDelete,
    /// Unknown/extension status value — preserved as-is.
    #[serde(untagged)]
    Other(String),
}

// ── Role types (RFC 9083 §10.2.4) ────────────────────────────────────────────

/// Entity role values defined in RFC 9083 §10.2.4.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RdapRole {
    Registrant,
    Technical,
    Administrative,
    Abuse,
    Billing,
    Registrar,
    Reseller,
    Sponsor,
    Proxy,
    Notifications,
    Noc,
    /// Unknown/extension role — preserved as-is.
    #[serde(untagged)]
    Other(String),
}

// ── Event (RFC 9083 §4.5) ─────────────────────────────────────────────────────

/// A lifecycle event associated with a registration object.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RdapEvent {
    /// Type of event (e.g. "registration", "expiration").
    pub event_action: String,
    /// RFC 3339 timestamp.
    pub event_date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_actor: Option<String>,
}

// ── Link (RFC 9083 §4.2) ──────────────────────────────────────────────────────

/// A hyperlink associated with a registration object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdapLink {
    pub href: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rel: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

// ── Remark (RFC 9083 §4.3) ────────────────────────────────────────────────────

/// A remark (annotation) on a registration object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdapRemark {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub remark_type: Option<String>,
    pub description: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,
}

// ── Entity (RFC 9083 §5.1) ────────────────────────────────────────────────────

/// A contact / registrant / registrar embedded in a response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RdapEntity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,
    /// vCard data (RFC 7095) — kept as raw JSON value to avoid strict parsing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vcard_array: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roles: Vec<RdapRole>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remarks: Vec<RdapRemark>,
    /// Nested entities (e.g., technical contacts of a registrar).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entities: Vec<RdapEntity>,
}

// ── Response metadata ─────────────────────────────────────────────────────────

/// Metadata attached to every normalised response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMeta {
    /// The RDAP server base URL that served this response.
    pub source: String,
    /// RFC 3339 timestamp of when the query was made.
    pub queried_at: String,
    /// Whether the response was served from the local cache.
    pub cached: bool,
}
