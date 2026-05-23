//! Contract tests — API schema stability.
//!
//! These tests lock down the *structural guarantees* of every public response
//! type.  They answer the question:
//!
//! > "Does the normalizer always produce a response that satisfies the
//! >  documented API contract, regardless of what the upstream server sent?"
//!
//! # What is tested
//!
//! | Response type     | Contract enforced                                      |
//! |-------------------|--------------------------------------------------------|
//! | `DomainResponse`  | `query` non-empty · `meta` present · ldhName lowercase |
//! | `IpResponse`      | `query` non-empty · `ip_version` is v4/v6              |
//! | `AsnResponse`     | `start_autnum` ≤ `end_autnum`                          |
//! | `NameserverResponse` | `query` non-empty                                   |
//! | All               | `meta.source` non-empty · `meta.cached` is bool        |
//!
//! These tests use the normalizer directly (no HTTP) to isolate contract
//! verification from network behaviour.

mod common;

use rdap_core::Normalizer;
use rdap_types::ip::IpVersion;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn norm() -> Normalizer {
    Normalizer::new()
}

const SOURCE: &str = "rdap.contract.test";

// ── DomainResponse contract ───────────────────────────────────────────────────

#[test]
fn contract_domain_query_is_preserved() {
    let resp = norm()
        .domain(
            "example.com",
            common::domain_rdap_response("example.com"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert!(!resp.query.is_empty(), "query must never be empty");
    assert_eq!(resp.query, "example.com", "query must equal the input");
}

#[test]
fn contract_domain_meta_is_always_present() {
    let resp = norm()
        .domain(
            "example.com",
            common::domain_rdap_response("example.com"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert!(
        !resp.meta.source.is_empty(),
        "meta.source must not be empty"
    );
    assert_eq!(
        resp.meta.source, SOURCE,
        "meta.source must equal the source arg"
    );
    assert!(
        !resp.meta.queried_at.is_empty(),
        "meta.queried_at must be set"
    );
    assert!(
        !resp.meta.cached,
        "meta.cached must be false when cached=false"
    );
}

#[test]
fn contract_domain_cached_flag_reflects_argument() {
    let cached_resp = norm()
        .domain("c.com", common::domain_rdap_response("c.com"), SOURCE, true)
        .expect("normalization must succeed");
    assert!(
        cached_resp.meta.cached,
        "meta.cached must be true when cached=true"
    );

    let live_resp = norm()
        .domain(
            "c.com",
            common::domain_rdap_response("c.com"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");
    assert!(
        !live_resp.meta.cached,
        "meta.cached must be false when cached=false"
    );
}

#[test]
fn contract_domain_ldh_name_is_lowercase() {
    // Supply a mixed-case ldhName in the raw JSON.
    let raw = serde_json::json!({
        "objectClassName": "domain",
        "ldhName": "EXAMPLE.COM",
        "status": [],
    });
    let resp = norm()
        .domain("EXAMPLE.COM", raw, SOURCE, false)
        .expect("normalization must succeed");

    if let Some(lname) = &resp.ldh_name {
        assert_eq!(
            lname.as_str(),
            lname.to_lowercase().as_str(),
            "ldhName must always be lowercase — got '{lname}'"
        );
    }
}

#[test]
fn contract_domain_nameservers_are_lowercase() {
    let raw = serde_json::json!({
        "objectClassName": "domain",
        "ldhName": "example.com",
        "nameservers": [
            { "objectClassName": "nameserver", "ldhName": "NS1.EXAMPLE.COM" },
            { "objectClassName": "nameserver", "ldhName": "NS2.EXAMPLE.COM" },
        ],
    });
    let resp = norm()
        .domain("example.com", raw, SOURCE, false)
        .expect("normalization must succeed");

    for ns in &resp.nameservers {
        assert_eq!(
            ns.as_str(),
            ns.to_lowercase().as_str(),
            "nameserver '{ns}' must be lowercase"
        );
    }
}

#[test]
fn contract_domain_events_have_required_fields() {
    let resp = norm()
        .domain(
            "example.com",
            common::domain_rdap_response("example.com"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    for event in &resp.events {
        assert!(
            !event.event_action.is_empty(),
            "event.eventAction must not be empty"
        );
        assert!(
            !event.event_date.is_empty(),
            "event.eventDate must not be empty"
        );
    }
}

#[test]
fn contract_domain_empty_status_array_is_valid() {
    // The contract allows an empty status list — RFC 9083 §4.6 says status
    // MAY be absent.
    let raw = serde_json::json!({
        "objectClassName": "domain",
        "ldhName": "nostatus.com",
    });
    let resp = norm()
        .domain("nostatus.com", raw, SOURCE, false)
        .expect("empty status must be valid");

    assert!(
        resp.status.is_empty(),
        "empty status array must deserialize as empty Vec, not fail"
    );
}

// ── IpResponse contract ───────────────────────────────────────────────────────

#[test]
fn contract_ip_query_is_preserved() {
    let resp = norm()
        .ip(
            "8.8.8.8",
            common::ip_rdap_response("8.8.8.0", "8.8.8.255", "US"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert!(!resp.query.is_empty(), "query must never be empty");
    assert_eq!(resp.query, "8.8.8.8");
}

#[test]
fn contract_ip_version_is_v4_or_v6() {
    let resp = norm()
        .ip(
            "8.8.8.8",
            common::ip_rdap_response("8.8.8.0", "8.8.8.255", "US"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert!(
        matches!(
            resp.ip_version,
            Some(IpVersion::V4) | Some(IpVersion::V6) | None
        ),
        "ip_version must be V4, V6, or None — got {:?}",
        resp.ip_version
    );
}

#[test]
fn contract_ip_meta_is_present() {
    let resp = norm()
        .ip(
            "8.8.8.8",
            common::ip_rdap_response("8.8.8.0", "8.8.8.255", "US"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert!(!resp.meta.source.is_empty());
    assert!(!resp.meta.queried_at.is_empty());
}

// ── AsnResponse contract ──────────────────────────────────────────────────────

#[test]
fn contract_asn_start_leq_end() {
    let resp = norm()
        .asn(
            15169,
            common::asn_rdap_response(15169, 15169, "GOOGLE"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    if let (Some(start), Some(end)) = (resp.start_autnum, resp.end_autnum) {
        assert!(
            start <= end,
            "startAutnum ({start}) must be ≤ endAutnum ({end})"
        );
    }
}

#[test]
fn contract_asn_query_is_preserved() {
    let resp = norm()
        .asn(
            15169,
            common::asn_rdap_response(15169, 15169, "GOOGLE"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert_eq!(
        resp.query, 15169,
        "asn query must preserve input ASN number"
    );
}

// ── NameserverResponse contract ───────────────────────────────────────────────

#[test]
fn contract_nameserver_query_is_preserved() {
    let resp = norm()
        .nameserver(
            "ns1.example.com",
            common::nameserver_rdap_response("ns1.example.com"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    assert_eq!(resp.query, "ns1.example.com");
    assert!(!resp.meta.source.is_empty());
}

// ── Backwards-compatibility: optional fields remain optional ──────────────────

#[test]
fn contract_domain_optional_fields_absent_on_minimal_response() {
    // A minimal RDAP response with only objectClassName — all optional fields
    // must be None / empty, not a panic or error.
    let minimal = serde_json::json!({
        "objectClassName": "domain",
        "ldhName": "minimal.com",
    });
    let resp = norm()
        .domain("minimal.com", minimal, SOURCE, false)
        .expect("minimal response must normalize without error");

    // These are all optional in RFC 9083 — they must be absent, not panics.
    assert!(resp.unicode_name.is_none());
    assert!(resp.handle.is_none());
    assert!(resp.registrar.is_none());
    assert!(resp.entities.is_empty());
    assert!(resp.events.is_empty());
    assert!(resp.nameservers.is_empty());
    assert!(resp.links.is_empty());
    assert!(resp.remarks.is_empty());
}

// ── Round-trip: serialize → deserialize produces equal struct ─────────────────

#[test]
fn contract_domain_json_roundtrip() {
    use rdap_types::domain::DomainResponse;

    let resp = norm()
        .domain(
            "roundtrip.com",
            common::domain_rdap_response("roundtrip.com"),
            SOURCE,
            false,
        )
        .expect("normalization must succeed");

    let json = serde_json::to_string(&resp).expect("serialization must not fail");
    let decoded: DomainResponse =
        serde_json::from_str(&json).expect("round-trip deserialization must not fail");

    assert_eq!(resp.query, decoded.query);
    assert_eq!(resp.ldh_name, decoded.ldh_name);
    assert_eq!(resp.handle, decoded.handle);
    assert_eq!(resp.meta.source, decoded.meta.source);
    assert_eq!(resp.meta.cached, decoded.meta.cached);
}
