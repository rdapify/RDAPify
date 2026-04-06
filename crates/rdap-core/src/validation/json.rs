//! JSON structural validation.
//!
//! Walks the parsed JSON tree iteratively and enforces depth, array-length,
//! object-field, and string-length limits defined in [`RdapValidationLimits`].
//!
//! # Why iterative, not recursive?
//!
//! A recursive walk would consume one Rust stack frame per nesting level.
//! An adversary could craft a deeply nested JSON document and exhaust the
//! thread stack before the recursion limit is reached.  An explicit stack on
//! the heap is bounded only by the configured depth limit, not by stack size.

use serde_json::Value;

use super::error::ValidationError;
use super::limits::RdapValidationLimits;

/// Validates the structural properties of a parsed JSON value.
///
/// Traverses the entire tree iteratively using an explicit work-stack.
/// Validation stops immediately on the first limit violation.
///
/// # Limits enforced
///
/// | Trigger            | Error                         |
/// |--------------------|-------------------------------|
/// | Array too long     | [`ValidationError::TooManyArrayItems`]   |
/// | Object too wide    | [`ValidationError::TooManyObjectFields`] |
/// | String too long    | [`ValidationError::StringTooLong`]       |
/// | Nesting too deep   | [`ValidationError::RecursionTooDeep`]    |
pub fn validate_json_structure(
    root: &Value,
    limits: &RdapValidationLimits,
) -> Result<(), ValidationError> {
    // Each entry on the stack is (node_ref, depth_of_this_node).
    // The root is at depth 0.
    let mut stack: Vec<(&Value, usize)> = vec![(root, 0)];

    while let Some((node, depth)) = stack.pop() {
        match node {
            Value::Array(arr) => {
                if arr.len() > limits.max_array_length {
                    return Err(ValidationError::TooManyArrayItems);
                }
                // Only push children if the array is non-empty; they would be
                // at depth+1, which must not exceed the recursion limit.
                if !arr.is_empty() {
                    let next = depth + 1;
                    if next > limits.max_recursion_depth {
                        return Err(ValidationError::RecursionTooDeep);
                    }
                    for item in arr {
                        stack.push((item, next));
                    }
                }
            }
            Value::Object(obj) => {
                if obj.len() > limits.max_object_fields {
                    return Err(ValidationError::TooManyObjectFields);
                }
                if !obj.is_empty() {
                    let next = depth + 1;
                    if next > limits.max_recursion_depth {
                        return Err(ValidationError::RecursionTooDeep);
                    }
                    for (_, v) in obj {
                        stack.push((v, next));
                    }
                }
            }
            Value::String(s) => {
                if s.len() > limits.max_string_length {
                    return Err(ValidationError::StringTooLong);
                }
            }
            // Null, Bool, Number: no size constraints
            _ => {}
        }
    }

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::super::limits::RdapValidationLimits;
    use super::validate_json_structure;
    use crate::validation::error::ValidationError;

    fn tight() -> RdapValidationLimits {
        RdapValidationLimits {
            max_json_size: 1024,
            max_array_length: 5,
            max_object_fields: 5,
            max_string_length: 20,
            max_recursion_depth: 3,
            max_entities: 5,
            max_links: 5,
            max_events: 5,
        }
    }

    #[test]
    fn valid_simple_object() {
        let v = json!({"a": 1, "b": "hello"});
        assert!(validate_json_structure(&v, &tight()).is_ok());
    }

    #[test]
    fn rejects_oversized_array() {
        let arr: Value = Value::Array(vec![Value::Null; 6]);
        assert_eq!(
            validate_json_structure(&arr, &tight()),
            Err(ValidationError::TooManyArrayItems)
        );
    }

    #[test]
    fn rejects_too_many_object_fields() {
        let obj = json!({"a":1,"b":2,"c":3,"d":4,"e":5,"f":6});
        assert_eq!(
            validate_json_structure(&obj, &tight()),
            Err(ValidationError::TooManyObjectFields)
        );
    }

    #[test]
    fn rejects_long_string() {
        // 21 bytes > max_string_length=20
        let v = json!({"key": "a".repeat(21)});
        assert_eq!(
            validate_json_structure(&v, &tight()),
            Err(ValidationError::StringTooLong)
        );
    }

    #[test]
    fn rejects_excessive_nesting() {
        // Build a 4-level deep object (max depth = 3)
        // depth 0: outer obj
        // depth 1: arr
        // depth 2: inner obj
        // depth 3: arr2
        // depth 4 would be required for arr2's children → error
        let v = json!({ "a": [[[ 1 ]]] });
        assert_eq!(
            validate_json_structure(&v, &tight()),
            Err(ValidationError::RecursionTooDeep)
        );
    }

    #[test]
    fn allows_nesting_exactly_at_limit() {
        // max_recursion_depth = 3 → children up to depth 3 are allowed
        // depth 0: obj → depth 1: arr → depth 2: obj → depth 3: scalar
        let v = json!({ "a": [{ "b": 1 }] });
        assert!(validate_json_structure(&v, &tight()).is_ok());
    }

    #[test]
    fn empty_containers_never_recurse() {
        // Empty arrays/objects at any depth should be fine even at the limit
        let v = json!({ "a": [{ "b": [] }] });
        assert!(validate_json_structure(&v, &tight()).is_ok());
    }

    #[test]
    fn scalar_root_is_valid() {
        assert!(validate_json_structure(&json!(42), &tight()).is_ok());
        assert!(validate_json_structure(&json!(true), &tight()).is_ok());
        assert!(validate_json_structure(&Value::Null, &tight()).is_ok());
    }
}
