//! Fuzz target — RDAP response validation layer.
//!
//! # Goal
//!
//! Prove that the validation pipeline **never panics** on arbitrary JSON
//! input, regardless of schema violations, missing fields, unexpected types,
//! or adversarial nesting depth.
//!
//! # What is exercised
//!
//! 1. `validate_rdap_response` — full structural + RDAP-semantic validation
//! 2. Both `Ok` and `Err` paths must be reachable and safe
//!
//! # Invariant
//!
//! For any JSON `Value`:
//! - `validate_rdap_response(&value, &limits)` must return `Ok` or `Err`,
//!   never panic.
//! - Returned errors must be `ValidationError` variants, not unwrap panics.

#![no_main]

use libfuzzer_sys::fuzz_target;
use rdap_core::validation::{validate_rdap_response, RdapValidationLimits};

fuzz_target!(|data: &[u8]| {
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(data) else {
        return;
    };

    let limits = RdapValidationLimits::default();

    // Validation must not panic regardless of input shape.
    let _ = validate_rdap_response(&value, &limits);
});
