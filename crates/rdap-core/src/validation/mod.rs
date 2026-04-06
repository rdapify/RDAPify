//! RDAP response validation layer.
//!
//! This module is the mandatory gate between raw HTTP bytes and deserialized
//! RDAP structs.  Every response **must** pass through [`validate_rdap_response`]
//! before any `serde` deserialization occurs.
//!
//! # Protection goals
//!
//! | Threat                        | Defence                                       |
//! |-------------------------------|-----------------------------------------------|
//! | Memory exhaustion             | [`RdapValidationLimits::max_json_size`] cap before allocation |
//! | JSON bomb (deeply nested)     | [`RdapValidationLimits::max_recursion_depth`] |
//! | Huge arrays                   | [`RdapValidationLimits::max_array_length`]    |
//! | Huge objects                  | [`RdapValidationLimits::max_object_fields`]   |
//! | Huge strings                  | [`RdapValidationLimits::max_string_length`]   |
//! | RDAP-level amplification      | Per-field limits (`entities`, `links`, …)     |
//!
//! # Integration
//!
//! ```text
//! HTTP fetch (rdap-security)
//!         ↓
//! read_limited()            ← enforces max_json_size at the transport layer
//!         ↓
//! validate_rdap_response()  ← structural + RDAP-specific validation
//!         ↓
//! serde_json::from_value()  ← safe: only validated Values reach deserializer
//! ```

pub mod error;
pub mod json;
pub mod limits;
pub mod rdap;

pub use error::ValidationError;
pub use limits::RdapValidationLimits;

/// Validates raw RDAP response bytes and returns a parsed, bounds-checked
/// [`serde_json::Value`].
///
/// # Steps
///
/// 1. Reject immediately if `json_bytes.len() > limits.max_json_size`.
/// 2. Parse bytes into a `serde_json::Value`.
/// 3. Walk the JSON tree and enforce structural limits (depth, array length,
///    object field count, string length) via [`json::validate_json_structure`].
/// 4. Apply RDAP-specific field limits (`entities`, `links`, …) via
///    [`rdap::validate_rdap_object`].
/// 5. Return the validated `Value` — ready for `serde` deserialization.
///
/// # Errors
///
/// Returns a [`ValidationError`] as soon as the first violation is found.
/// Validation stops immediately on failure to minimise wasted work.
pub fn validate_rdap_response(
    json_bytes: &[u8],
    limits: &RdapValidationLimits,
) -> Result<serde_json::Value, ValidationError> {
    // Step 1 — raw size guard (defence-in-depth; read_limited already enforces
    //           this at transport, but callers may invoke this function directly).
    if json_bytes.len() > limits.max_json_size {
        return Err(ValidationError::JsonTooLarge);
    }

    // Step 2 — parse into an untyped JSON tree.
    let value: serde_json::Value =
        serde_json::from_slice(json_bytes).map_err(|_| ValidationError::InvalidStructure)?;

    // Step 3 — enforce structural limits.
    json::validate_json_structure(&value, limits)?;

    // Step 4 — enforce RDAP field-level limits.
    rdap::validate_rdap_object(&value, limits)?;

    // Step 5 — return validated Value; only this Value may be fed to serde.
    Ok(value)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::{validate_rdap_response, RdapValidationLimits, ValidationError};

    fn default_limits() -> RdapValidationLimits {
        RdapValidationLimits::default()
    }

    #[test]
    fn valid_domain_response_passes() {
        let json = br#"{
            "objectClassName": "domain",
            "ldhName": "EXAMPLE.COM",
            "links": [{"href": "https://rdap.verisign.com/com/v1/domain/EXAMPLE.COM"}],
            "events": [{"eventAction": "registration", "eventDate": "1995-08-14T04:00:00Z"}]
        }"#;
        let value = validate_rdap_response(json, &default_limits()).unwrap();
        assert_eq!(value["ldhName"], "EXAMPLE.COM");
    }

    #[test]
    fn rejects_body_exceeding_size_limit() {
        let limits = RdapValidationLimits {
            max_json_size: 10,
            ..Default::default()
        };
        // {"a":12345} is 11 bytes > 10 → must be rejected
        let err = validate_rdap_response(b"{\"a\":12345}", &limits).unwrap_err();
        assert_eq!(err, ValidationError::JsonTooLarge);
    }

    #[test]
    fn rejects_invalid_json() {
        let err = validate_rdap_response(b"not json at all", &default_limits()).unwrap_err();
        assert_eq!(err, ValidationError::InvalidStructure);
    }

    #[test]
    fn rejects_json_bomb_nesting() {
        let limits = RdapValidationLimits {
            max_recursion_depth: 2,
            ..Default::default()
        };
        // [[[ 1 ]]] → depth 0: arr, 1: arr, 2: arr, 3: scalar → depth 3 > 2
        let err = validate_rdap_response(b"[[[1]]]", &limits).unwrap_err();
        assert_eq!(err, ValidationError::RecursionTooDeep);
    }

    #[test]
    fn rejects_too_many_entities() {
        let limits = RdapValidationLimits {
            max_entities: 1,
            ..Default::default()
        };
        let json = br#"{"entities": [{}, {}]}"#;
        let err = validate_rdap_response(json, &limits).unwrap_err();
        assert_eq!(err, ValidationError::TooManyEntities);
    }

    #[test]
    fn validation_error_converts_to_rdap_error() {
        use rdap_types::error::RdapError;
        let rdap_err: RdapError = ValidationError::JsonTooLarge.into();
        assert!(matches!(rdap_err, RdapError::ParseError { .. }));
    }
}
