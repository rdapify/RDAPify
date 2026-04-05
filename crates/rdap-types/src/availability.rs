//! Domain availability result type.

use serde::{Deserialize, Serialize};

/// Result of a domain availability check.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AvailabilityResult {
    /// The domain name that was checked.
    pub domain: String,
    /// `true` if the registry returned 404 (not found), `false` if registered.
    pub available: bool,
    /// Expiration date string from the RDAP expiration event, if present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}
