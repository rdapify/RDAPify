//! Validation error type for the RDAP response validation layer.

use thiserror::Error;

/// Errors produced when an RDAP response fails structural or content validation.
///
/// These errors indicate that the server returned a response that exceeds
/// configured safety limits or violates expected RDAP structure.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum ValidationError {
    // ── Size limits ───────────────────────────────────────────────────────────
    /// Raw JSON byte length exceeds [`RdapValidationLimits::max_json_size`].
    #[error("RDAP response body exceeds the maximum allowed size")]
    JsonTooLarge,

    /// An array in the JSON tree contains more items than
    /// [`RdapValidationLimits::max_array_length`].
    #[error("Array contains too many items")]
    TooManyArrayItems,

    /// An object in the JSON tree has more fields than
    /// [`RdapValidationLimits::max_object_fields`].
    #[error("Object has too many fields")]
    TooManyObjectFields,

    /// A JSON string value is longer than
    /// [`RdapValidationLimits::max_string_length`].
    #[error("String value is too long")]
    StringTooLong,

    /// The JSON nesting depth exceeds
    /// [`RdapValidationLimits::max_recursion_depth`].
    #[error("JSON nesting depth exceeds the maximum allowed depth")]
    RecursionTooDeep,

    // ── RDAP field limits ─────────────────────────────────────────────────────
    /// The `entities` array exceeds [`RdapValidationLimits::max_entities`].
    #[error("Too many entities in RDAP response")]
    TooManyEntities,

    /// The `links` array exceeds [`RdapValidationLimits::max_links`].
    #[error("Too many links in RDAP response")]
    TooManyLinks,

    /// The `events` array exceeds [`RdapValidationLimits::max_events`].
    #[error("Too many events in RDAP response")]
    TooManyEvents,

    // ── Structure ─────────────────────────────────────────────────────────────
    /// The response bytes are not valid JSON or have unexpected top-level
    /// structure.
    #[error("Invalid RDAP response structure")]
    InvalidStructure,
}

// ── Error conversion ──────────────────────────────────────────────────────────

impl From<ValidationError> for rdap_types::error::RdapError {
    fn from(e: ValidationError) -> Self {
        rdap_types::error::RdapError::ParseError {
            reason: e.to_string(),
        }
    }
}
