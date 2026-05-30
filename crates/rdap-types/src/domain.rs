//! Normalised RDAP domain response type.
//!
//! Follows RFC 9083 §5.3 (Domain Object Class).

use serde::{Deserialize, Serialize};

use crate::common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapStatus, ResponseMeta};

/// Normalised RDAP response for a domain query.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainResponse {
    /// The original query string.
    pub query: String,

    /// LDH (letters, digits, hyphens) form of the domain name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ldh_name: Option<String>,

    /// Unicode (internationalised) form of the domain name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unicode_name: Option<String>,

    /// Registry handle / ROID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,

    /// Current status flags.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub status: Vec<RdapStatus>,

    /// Delegated nameservers.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub nameservers: Vec<String>,

    /// Registrar summary (extracted from entities for convenience).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registrar: Option<RegistrarSummary>,

    /// All associated entities (registrant, admin, tech, abuse, etc.).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entities: Vec<RdapEntity>,

    /// Lifecycle events (registration, expiration, last changed, …).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub events: Vec<RdapEvent>,

    /// Hyperlinks associated with this domain object.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub links: Vec<RdapLink>,

    /// Remarks and annotations from the registry.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remarks: Vec<RdapRemark>,

    /// Query metadata (source server, timestamp, cache status).
    pub meta: ResponseMeta,
}

impl DomainResponse {
    /// Returns the expiration date string from events, if present.
    pub fn expiration_date(&self) -> Option<&str> {
        self.events
            .iter()
            .find(|e| e.event_action == "expiration")
            .map(|e| e.event_date.as_str())
    }

    /// Returns the registration date string from events, if present.
    pub fn registration_date(&self) -> Option<&str> {
        self.events
            .iter()
            .find(|e| e.event_action == "registration")
            .map(|e| e.event_date.as_str())
    }

    /// Returns `true` if the domain has an "active" status.
    pub fn is_active(&self) -> bool {
        self.status.iter().any(|s| matches!(s, RdapStatus::Active))
    }
}

/// Condensed registrar information extracted from the entities list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrarSummary {
    /// Human-readable name of the registrar.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// IANA registrar ID or registry handle.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub handle: Option<String>,
    /// Registrar's RDAP or WHOIS service URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// Email address for abuse reports to the registrar.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abuse_email: Option<String>,
    /// Phone number for abuse reports to the registrar.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abuse_phone: Option<String>,
}
