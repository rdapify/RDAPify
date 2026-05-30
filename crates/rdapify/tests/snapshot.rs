//! Snapshot tests — CLI output and response serialization stability.
//!
//! Uses [`insta`] to freeze the serialized shape of every public response type.
//! Any future change that silently alters the JSON output (renamed field,
//! removed optional field, reordered array) will cause a test failure here,
//! forcing an explicit review and approval step.
//!
//! # How snapshots work
//!
//! - First run (no `.snap` file): the test **fails** and writes a `.snap.new`
//!   file next to `snapshots/`.
//! - Review new snapshots: `cargo insta review`  (or `INSTA_UPDATE=always cargo test`)
//! - Committed `.snap` files act as the regression baseline.
//!
//! # Redactions
//!
//! `queried_at` is always redacted to `"[timestamp]"` so snapshots do not
//! drift from run to run.

mod common;

use rdap_core::Normalizer;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Normalize a fixture and return a stable `serde_json::Value` with the
/// non-deterministic `queried_at` field replaced by a fixed placeholder.
fn stable_value<T: serde::Serialize>(response: &T) -> serde_json::Value {
    let mut v = serde_json::to_value(response).expect("serialization must not fail");
    if let Some(meta) = v.get_mut("meta") {
        if let Some(obj) = meta.as_object_mut() {
            obj.insert("queried_at".into(), serde_json::json!("[timestamp]"));
        }
    }
    v
}

// ── Domain response ───────────────────────────────────────────────────────────

#[test]
fn snapshot_domain_response_json() {
    let norm = Normalizer::new();
    let raw = common::domain_rdap_response("example.com");
    let resp = norm
        .domain("example.com", &raw, "rdap.verisign.com/com/v1", false)
        .expect("normalization must succeed");

    insta::assert_json_snapshot!("domain_response", stable_value(&resp));
}

#[test]
fn snapshot_domain_response_with_cache_flag() {
    let norm = Normalizer::new();
    let raw = common::domain_rdap_response("cached.com");
    let resp = norm
        .domain("cached.com", &raw, "rdap.verisign.com/com/v1", true)
        .expect("normalization must succeed");

    insta::assert_json_snapshot!("domain_response_cached", stable_value(&resp));
}

// ── IP response ───────────────────────────────────────────────────────────────

#[test]
fn snapshot_ip_response_json() {
    let norm = Normalizer::new();
    let raw = common::ip_rdap_response("8.8.8.0", "8.8.8.255", "US");
    let resp = norm
        .ip("8.8.8.8", &raw, "rdap.arin.net/registry", false)
        .expect("normalization must succeed");

    insta::assert_json_snapshot!("ip_response", stable_value(&resp));
}

// ── ASN response ──────────────────────────────────────────────────────────────

#[test]
fn snapshot_asn_response_json() {
    let norm = Normalizer::new();
    let raw = common::asn_rdap_response(15169, 15169, "GOOGLE");
    let resp = norm
        .asn(15169, &raw, "rdap.arin.net/registry", false)
        .expect("normalization must succeed");

    insta::assert_json_snapshot!("asn_response", stable_value(&resp));
}

// ── Nameserver response ───────────────────────────────────────────────────────

#[test]
fn snapshot_nameserver_response_json() {
    let norm = Normalizer::new();
    let raw = common::nameserver_rdap_response("ns1.example.com");
    let resp = norm
        .nameserver("ns1.example.com", &raw, "rdap.verisign.com/com/v1", false)
        .expect("normalization must succeed");

    insta::assert_json_snapshot!("nameserver_response", stable_value(&resp));
}

// ── Stability: idempotent serialization ───────────────────────────────────────

/// Serializing the same response twice must produce identical JSON.
/// Catches any nondeterminism in Vec ordering or HashMap iteration.
#[test]
fn snapshot_domain_serialization_is_deterministic() {
    let norm = Normalizer::new();
    let raw = common::domain_rdap_response("stable.com");
    let resp = norm
        .domain("stable.com", &raw, "rdap.test.org", false)
        .expect("normalization must succeed");

    let v1 = stable_value(&resp);

    // Normalize again from the same raw JSON
    let resp2 = norm
        .domain("stable.com", &raw, "rdap.test.org", false)
        .expect("second normalization must succeed");
    let v2 = stable_value(&resp2);

    assert_eq!(
        v1, v2,
        "serializing the same response twice must produce identical JSON"
    );
}

// ── Status field ordering is stable ──────────────────────────────────────────

/// Status values must appear in a consistent order across runs.
/// (The normalizer preserves the order from the raw JSON — no sorting.)
#[test]
fn snapshot_status_field_order_is_stable() {
    let norm = Normalizer::new();
    let raw = serde_json::json!({
        "objectClassName": "domain",
        "ldhName": "order.com",
        "status": ["active", "client delete prohibited", "client transfer prohibited"],
    });
    let resp = norm
        .domain("order.com", &raw, "rdap.test.org", false)
        .expect("normalization must succeed");

    let v = stable_value(&resp);
    let status = v["status"].as_array().expect("status must be an array");
    let status_strs: Vec<&str> = status.iter().filter_map(|s| s.as_str()).collect();

    // Snapshot the exact order so any reordering is caught.
    insta::assert_debug_snapshot!("status_order", status_strs);
}
