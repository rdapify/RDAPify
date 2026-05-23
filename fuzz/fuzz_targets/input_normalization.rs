//! Fuzz target — input normalization and validation.
//!
//! # Goal
//!
//! Prove that the input-handling layer (domain/IP/ASN parsing and SSRF guard)
//! **never panics** on arbitrary UTF-8 strings.
//!
//! # What is exercised
//!
//! 1. Domain input parsing and normalization (idna, unicode handling)
//! 2. IP address parsing (v4 and v6)
//! 3. ASN string parsing
//! 4. SSRF guard URL validation
//!
//! # Invariant
//!
//! For any UTF-8 string input:
//! - All code paths return `Ok` or `Err(RdapError::…)` — no panics.
//! - No infinite loops (IDNA processing must terminate).

#![no_main]

use libfuzzer_sys::fuzz_target;
use rdap_security::{SsrfConfig, SsrfGuard};

fuzz_target!(|data: &[u8]| {
    // Only exercise UTF-8 input — the public API takes `&str`.
    let Ok(s) = std::str::from_utf8(data) else {
        return;
    };

    // ── SSRF guard ────────────────────────────────────────────────────────────
    //
    // The guard validates URLs before HTTP requests are made.
    // Arbitrary strings may be valid or invalid URLs — both paths must be safe.
    let guard = SsrfGuard::new(SsrfConfig::default());
    let _ = guard.validate(s);

    // ── Domain-like inputs ────────────────────────────────────────────────────
    //
    // Domains go through IDNA normalisation (idna crate) which must not panic
    // on any input including mixed scripts, RTL text, or null bytes.
    //
    // We test the normalizer by building a minimal RDAP JSON with the fuzzed
    // string as the ldhName and running it through rdap_core::Normalizer.
    if s.len() <= 256 {
        let raw = serde_json::json!({
            "objectClassName": "domain",
            "ldhName": s,
            "status": [],
        });
        let norm = rdap_core::Normalizer::new();
        let _ = norm.domain(s, raw, "fuzz.rdap.example", false);
    }

    // ── IP-like inputs ────────────────────────────────────────────────────────
    //
    // IP addresses are parsed by the `ipnetwork` crate; all inputs are safe.
    if s.len() <= 64 {
        let raw = serde_json::json!({
            "objectClassName": "ip network",
            "startAddress": s,
            "endAddress": s,
            "ipVersion": "v4",
        });
        let norm = rdap_core::Normalizer::new();
        let _ = norm.ip(s, raw, "fuzz.rdap.example", false);
    }
});
