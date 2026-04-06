//! Configurable limits for the RDAP response validation layer.

/// Limits applied during RDAP response validation.
///
/// All limits have conservative defaults designed to protect against malicious
/// or malformed responses without rejecting legitimate RDAP data.
///
/// # Examples
///
/// ```rust
/// use rdap_core::validation::RdapValidationLimits;
///
/// // Use safe defaults
/// let limits = RdapValidationLimits::default();
///
/// // Tighten limits for a resource-constrained environment
/// let strict = RdapValidationLimits {
///     max_json_size: 512 * 1024,  // 512 KB
///     max_array_length: 100,
///     max_entities: 10,
///     ..Default::default()
/// };
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RdapValidationLimits {
    /// Maximum raw JSON body size in bytes before any parsing occurs.
    ///
    /// Default: 5 MiB (`5 * 1024 * 1024`).
    pub max_json_size: usize,

    /// Maximum number of items in any single JSON array.
    ///
    /// Default: 1 000.
    pub max_array_length: usize,

    /// Maximum number of key-value pairs in any single JSON object.
    ///
    /// Default: 200.
    pub max_object_fields: usize,

    /// Maximum byte length of any single JSON string value.
    ///
    /// Default: 10 KiB (`10 * 1024`).
    pub max_string_length: usize,

    /// Maximum JSON nesting depth (arrays + objects count as one level each).
    ///
    /// Default: 10.
    pub max_recursion_depth: usize,

    /// Maximum number of objects in the top-level `entities` array.
    ///
    /// Default: 100.
    pub max_entities: usize,

    /// Maximum number of objects in any top-level `links` array.
    ///
    /// Default: 100.
    pub max_links: usize,

    /// Maximum number of objects in any top-level `events` array.
    ///
    /// Default: 100.
    pub max_events: usize,
}

impl Default for RdapValidationLimits {
    fn default() -> Self {
        Self {
            max_json_size: 5 * 1024 * 1024, // 5 MiB
            max_array_length: 1_000,
            max_object_fields: 200,
            max_string_length: 10 * 1024, // 10 KiB
            max_recursion_depth: 10,
            max_entities: 100,
            max_links: 100,
            max_events: 100,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::RdapValidationLimits;

    #[test]
    fn default_values_are_sane() {
        let l = RdapValidationLimits::default();
        assert_eq!(l.max_json_size, 5 * 1024 * 1024);
        assert_eq!(l.max_array_length, 1_000);
        assert_eq!(l.max_object_fields, 200);
        assert_eq!(l.max_string_length, 10 * 1024);
        assert_eq!(l.max_recursion_depth, 10);
        assert_eq!(l.max_entities, 100);
        assert_eq!(l.max_links, 100);
        assert_eq!(l.max_events, 100);
    }

    #[test]
    fn partial_override_preserves_other_defaults() {
        let l = RdapValidationLimits {
            max_json_size: 1024,
            ..Default::default()
        };
        assert_eq!(l.max_json_size, 1024);
        assert_eq!(l.max_array_length, 1_000); // unchanged
    }
}
