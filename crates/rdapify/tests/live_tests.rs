//! Live integration tests against real RDAP servers.
//!
//! These tests are **ignored by default** — they require network access.
//!
//! Run manually:
//! ```bash
//! cargo test --test live_tests -- --ignored --nocapture
//! ```
//!
//! In CI, run daily via `.github/workflows/live-tests.yml`.
//!
//! ## Discipline
//!
//! Live tests assert **structure**, never content. Concretely:
//!
//! - The `query` field is the only guaranteed-present, content-stable
//!   field in every response — assert it equals the input (or its
//!   normalised form).
//! - Optional RDAP fields (`country`, `name`, `status`, `handle`, etc.)
//!   are *upstream-controlled* and may be absent, change shape, or
//!   change value over time. **Never** assert on their content here.
//! - Engine transformations (e.g. IDN → punycode, ASN-prefix stripping)
//!   are validated by **unit tests** in the relevant crate, not by
//!   live tests. Live tests should not hold the engine accountable
//!   for whether a chosen example is registered.
//!
//! See `tests/TESTING_GUIDELINES.md` for the full policy.

use rdapify::RdapClient;

fn client() -> RdapClient {
    RdapClient::new().expect("client construction failed")
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_domain_example_com() {
    // example.com is IANA-reserved and stable. Structural assertions only.
    let res = client()
        .domain("example.com")
        .await
        .expect("domain query failed");
    assert_eq!(res.query, "example.com");
}

// IDN/punycode transformation is engine logic and is validated by pure
// unit tests in `crates/rdapify-client/src/lib.rs::normalise_domain_tests`.
// A live IDN test would conflate "engine encodes IDN correctly" with
// "the chosen IDN is registered in its TLD" — see
// `tests/TESTING_GUIDELINES.md` §3.

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_google_dns_v4() {
    // Structural only — ARIN does not consistently publish `country` for
    // IP allocations (verified 2026-04-30: 8.8.8.8 had no country field).
    // Treating any optional field as required is content-coupling.
    let res = client().ip("8.8.8.8").await.expect("IPv4 query failed");
    assert_eq!(res.query, "8.8.8.8");
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_cloudflare_v4() {
    // Structural only.
    let res = client()
        .ip("1.1.1.1")
        .await
        .expect("Cloudflare IPv4 failed");
    assert_eq!(res.query, "1.1.1.1");
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_google_dns_v6() {
    let res = client()
        .ip("2001:4860:4860::8888")
        .await
        .expect("IPv6 query failed");
    // Engine returns the input verbatim; some upstreams reformat,
    // so we only assert non-empty.
    assert!(!res.query.is_empty());
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_asn_google() {
    // Numeric normalisation (`AS15169` → `15169`) is exercised here.
    // The `name` field is upstream-controlled and may be absent, so
    // we do not assert on it.
    let res = client().asn("AS15169").await.expect("ASN query failed");
    assert_eq!(res.query, 15169);
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_asn_cloudflare() {
    let res = client().asn("13335").await.expect("ASN 13335 query failed");
    assert_eq!(res.query, 13335);
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_nameserver_google() {
    let res = client()
        .nameserver("ns1.google.com")
        .await
        .expect("nameserver query failed");
    assert!(!res.query.is_empty());
}
