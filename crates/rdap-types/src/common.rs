//! Shared RDAP data types used across all response objects.
//!
//! Follows RFC 9083 §4 (Common Data Structures).

use serde::{Deserialize, Serialize};

// ── Status values (RFC 9083 §10.2.2) ─────────────────────────────────────────

/// Registration status values defined in RFC 9083 §10.2.2.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RdapStatus {
    /// The object has been validated by the registry.
    Validated,
    /// Renewal of the object is prohibited.
    #[serde(rename = "renew prohibited")]
    RenewProhibited,
    /// Updates to the object are prohibited.
    #[serde(rename = "update prohibited")]
    UpdateProhibited,
    /// Transfer of the object is prohibited.
    #[serde(rename = "transfer prohibited")]
    TransferProhibited,
    /// Deletion of the object is prohibited.
    #[serde(rename = "delete prohibited")]
    DeleteProhibited,
    /// The object is a proxy registration hiding the true registrant.
    Proxy,
    /// The registrant has requested privacy protection.
    Private,
    /// Some data has been removed from the response.
    Removed,
    /// Some data has been obscured (e.g., redacted for privacy).
    Obscured,
    /// The object is associated with another object in the registry.
    Associated,
    /// The object is active and operational.
    Active,
    /// The object is inactive (not currently delegated/used).
    Inactive,
    /// The object is locked against changes.
    Locked,
    /// A create operation is pending for this object.
    #[serde(rename = "pending create")]
    PendingCreate,
    /// A renewal operation is pending for this object.
    #[serde(rename = "pending renew")]
    PendingRenew,
    /// A transfer operation is pending for this object.
    #[serde(rename = "pending transfer")]
    PendingTransfer,
    /// An update operation is pending for this object.
    #[serde(rename = "pending update")]
    PendingUpdate,
    /// A deletion operation is pending for this object.
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
    /// The entity is the registrant (owner) of the object.
    Registrant,
    /// The entity is the technical contact.
    Technical,
    /// The entity is the administrative contact.
    Administrative,
    /// The entity handles abuse reports for the object.
    Abuse,
    /// The entity is the billing contact.
    Billing,
    /// The entity is the registrar responsible for the object.
    Registrar,
    /// The entity is a reseller of registration services.
    Reseller,
    /// The entity is a sponsoring organization for the object.
    Sponsor,
    /// The entity acts as a proxy for the true registrant.
    Proxy,
    /// The entity receives notifications about the object.
    Notifications,
    /// The entity is the Network Operations Center contact.
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
    /// Identifier of the actor that caused the event, if provided.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_actor: Option<String>,
}

// ── Link (RFC 9083 §4.2) ──────────────────────────────────────────────────────

/// A hyperlink associated with a registration object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdapLink {
    /// The URI of the link target.
    pub href: String,
    /// The link relation type (e.g., "self", "related").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rel: Option<String>,
    /// The media type of the linked resource.
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
    /// Human-readable title for the link.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

// ── Remark (RFC 9083 §4.3) ────────────────────────────────────────────────────

/// A remark (annotation) on a registration object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdapRemark {
    /// Optional title summarising the remark.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Classification of the remark (e.g., "object truncated due to authorization").
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub remark_type: Option<String>,
    /// One or more lines of descriptive text for the remark.
    pub description: Vec<String>,
    /// Links providing further context for this remark.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,
}

// ── Entity (RFC 9083 §5.1) ────────────────────────────────────────────────────

/// A contact / registrant / registrar embedded in a response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RdapEntity {
    /// Registry handle identifying this entity.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,
    /// vCard data (RFC 7095) — kept as raw JSON value to avoid strict parsing.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vcard_array: Option<serde_json::Value>,
    /// Roles this entity plays for the parent object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub roles: Vec<RdapRole>,
    /// Lifecycle events associated with this entity.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,
    /// Hyperlinks associated with this entity.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,
    /// Remarks and annotations from the registry.
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
