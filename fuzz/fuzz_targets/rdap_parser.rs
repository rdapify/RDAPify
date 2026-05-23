//! Fuzz target — RDAP response parser / normalizer.
//!
//! # Goal
//!
//! Prove that the normalizer **never panics** on arbitrary byte input.
//! The normalizer is a trust boundary: it receives raw HTTP response bytes
//! from third-party RDAP servers that may be malformed, truncated, or
//! adversarially crafted.
//!
//! # What is exercised
//!
//! 1. `serde_json::from_slice` — arbitrary bytes → JSON parse
//! 2. `Normalizer::domain`     — JSON → `DomainResponse`
//! 3. `Normalizer::ip`         — JSON → `IpResponse`
//! 4. `Normalizer::asn`        — JSON → `AsnResponse`
//! 5. `Normalizer::nameserver` — JSON → `NameserverResponse`
//! 6. `Normalizer::entity`     — JSON → `EntityResponse`
//!
//! # Invariant
//!
//! For any input `data: &[u8]`:
//! - No `panic!` / `unwrap` / `expect` that propagates to the caller
//! - No infinite loop
//! - No stack overflow (serde_json recursion limit handles this)
//!
//! Errors (malformed JSON, missing fields, unknown class) are acceptable —
//! they must be returned as `Err(RdapError::…)`, never as panics.

#![no_main]

use libfuzzer_sys::fuzz_target;
use rdap_core::Normalizer;

fuzz_target!(|data: &[u8]| {
    // Step 1: try to parse bytes as JSON.
    // serde_json enforces a recursion limit (~128 levels) so deeply nested
    // payloads are rejected before reaching the normalizer.
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(data) else {
        return; // invalid JSON — nothing to normalise
    };

    let norm = Normalizer::new();
    let src = "fuzz-server.rdap.example";

    // Exercise all normalizer code paths.  Errors are expected and fine.
    let _ = norm.domain("fuzz.com", value.clone(), src, false);
    let _ = norm.ip("1.2.3.4", value.clone(), src, false);
    let _ = norm.asn(12345, value.clone(), src, false);
    let _ = norm.nameserver("ns1.fuzz.com", value.clone(), src, false);
    let _ = norm.entity(value, src, false);
});
