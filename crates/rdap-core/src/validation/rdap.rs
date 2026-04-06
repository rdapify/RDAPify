//! RDAP-specific field validation.
//!
//! Applies per-field limits to well-known RDAP arrays (`entities`, `links`,
//! `events`, `remarks`, `notices`, `nameservers`) that carry elevated risk
//! because they are frequently large, deeply nested, or entity-recursive.

use serde_json::{Map, Value};

use super::error::ValidationError;
use super::limits::RdapValidationLimits;

/// Validates RDAP-specific field lengths in a top-level RDAP object.
///
/// If `value` is not a JSON object the function returns `Ok(())` immediately
/// (structural validity is the responsibility of [`super::json`]).
///
/// # Limits enforced
///
/// | Field         | Limit                                     | Error                         |
/// |---------------|-------------------------------------------|-------------------------------|
/// | `entities`    | [`RdapValidationLimits::max_entities`]    | [`ValidationError::TooManyEntities`] |
/// | `links`       | [`RdapValidationLimits::max_links`]       | [`ValidationError::TooManyLinks`]    |
/// | `events`      | [`RdapValidationLimits::max_events`]      | [`ValidationError::TooManyEvents`]   |
/// | `remarks`     | [`RdapValidationLimits::max_array_length`]| [`ValidationError::TooManyArrayItems`] |
/// | `notices`     | [`RdapValidationLimits::max_array_length`]| [`ValidationError::TooManyArrayItems`] |
/// | `nameservers` | [`RdapValidationLimits::max_array_length`]| [`ValidationError::TooManyArrayItems`] |
pub fn validate_rdap_object(
    value: &Value,
    limits: &RdapValidationLimits,
) -> Result<(), ValidationError> {
    let obj = match value.as_object() {
        Some(o) => o,
        None => return Ok(()),
    };

    if array_len(obj, "entities") > limits.max_entities {
        return Err(ValidationError::TooManyEntities);
    }
    if array_len(obj, "links") > limits.max_links {
        return Err(ValidationError::TooManyLinks);
    }
    if array_len(obj, "events") > limits.max_events {
        return Err(ValidationError::TooManyEvents);
    }
    if array_len(obj, "remarks") > limits.max_array_length {
        return Err(ValidationError::TooManyArrayItems);
    }
    if array_len(obj, "notices") > limits.max_array_length {
        return Err(ValidationError::TooManyArrayItems);
    }
    if array_len(obj, "nameservers") > limits.max_array_length {
        return Err(ValidationError::TooManyArrayItems);
    }

    Ok(())
}

/// Returns the length of `key` as a JSON array, or 0 if absent or not an array.
fn array_len(obj: &Map<String, Value>, key: &str) -> usize {
    obj.get(key).and_then(Value::as_array).map_or(0, Vec::len)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::super::limits::RdapValidationLimits;
    use super::validate_rdap_object;
    use crate::validation::error::ValidationError;

    fn tight() -> RdapValidationLimits {
        RdapValidationLimits {
            max_entities: 2,
            max_links: 2,
            max_events: 2,
            max_array_length: 3,
            ..Default::default()
        }
    }

    #[test]
    fn valid_rdap_object() {
        let v = json!({
            "objectClassName": "domain",
            "ldhName": "EXAMPLE.COM",
            "entities": [{"handle": "A"}, {"handle": "B"}],
            "links": [{"href": "https://example.com"}],
            "events": [{"eventAction": "registration"}]
        });
        assert!(validate_rdap_object(&v, &tight()).is_ok());
    }

    #[test]
    fn rejects_too_many_entities() {
        let v = json!({
            "entities": [{"handle": "A"}, {"handle": "B"}, {"handle": "C"}]
        });
        assert_eq!(
            validate_rdap_object(&v, &tight()),
            Err(ValidationError::TooManyEntities)
        );
    }

    #[test]
    fn rejects_too_many_links() {
        let v = json!({
            "links": [{"href": "a"}, {"href": "b"}, {"href": "c"}]
        });
        assert_eq!(
            validate_rdap_object(&v, &tight()),
            Err(ValidationError::TooManyLinks)
        );
    }

    #[test]
    fn rejects_too_many_events() {
        let v = json!({
            "events": [{"eventAction": "a"}, {"eventAction": "b"}, {"eventAction": "c"}]
        });
        assert_eq!(
            validate_rdap_object(&v, &tight()),
            Err(ValidationError::TooManyEvents)
        );
    }

    #[test]
    fn rejects_too_many_remarks() {
        let v = json!({ "remarks": [1, 2, 3, 4] }); // 4 > max_array_length=3
        assert_eq!(
            validate_rdap_object(&v, &tight()),
            Err(ValidationError::TooManyArrayItems)
        );
    }

    #[test]
    fn rejects_too_many_notices() {
        let v = json!({ "notices": [1, 2, 3, 4] });
        assert_eq!(
            validate_rdap_object(&v, &tight()),
            Err(ValidationError::TooManyArrayItems)
        );
    }

    #[test]
    fn rejects_too_many_nameservers() {
        let v = json!({ "nameservers": [1, 2, 3, 4] });
        assert_eq!(
            validate_rdap_object(&v, &tight()),
            Err(ValidationError::TooManyArrayItems)
        );
    }

    #[test]
    fn non_object_is_accepted() {
        // Structural checks are handled by validate_json_structure; this
        // function should not reject non-objects.
        assert!(validate_rdap_object(&serde_json::Value::Null, &tight()).is_ok());
        assert!(validate_rdap_object(&serde_json::json!([1, 2]), &tight()).is_ok());
    }

    #[test]
    fn missing_fields_are_not_errors() {
        let v = json!({ "objectClassName": "domain" });
        assert!(validate_rdap_object(&v, &tight()).is_ok());
    }

    #[test]
    fn non_array_fields_count_as_zero() {
        // If a field exists but is not an array, treat it as length 0.
        let v = json!({ "entities": "not-an-array" });
        assert!(validate_rdap_object(&v, &tight()).is_ok());
    }
}
