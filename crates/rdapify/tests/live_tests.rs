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

use rdapify::RdapClient;

fn client() -> RdapClient {
    RdapClient::new().expect("client construction failed")
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_domain_example_com() {
    let res = client()
        .domain("example.com")
        .await
        .expect("domain query failed");
    assert_eq!(res.query, "example.com");
    assert!(!res.status.is_empty(), "status should not be empty");
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_domain_idn_unicode() {
    // "пример" = example in Russian → xn--e1afmkfd.com
    let res = client()
        .domain("пример.com")
        .await
        .expect("IDN domain query failed");
    assert!(!res.query.is_empty());
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_google_dns_v4() {
    let res = client().ip("8.8.8.8").await.expect("IPv4 query failed");
    assert_eq!(res.query, "8.8.8.8");
    assert_eq!(res.country.as_deref(), Some("US"));
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_cloudflare_v4() {
    let res = client()
        .ip("1.1.1.1")
        .await
        .expect("Cloudflare IPv4 failed");
    assert_eq!(res.query, "1.1.1.1");
    assert!(res.country.is_some());
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_ip_google_dns_v6() {
    let res = client()
        .ip("2001:4860:4860::8888")
        .await
        .expect("IPv6 query failed");
    assert!(!res.query.is_empty());
}

#[tokio::test]
#[ignore = "requires network — run with --ignored"]
async fn live_asn_google() {
    let res = client().asn("AS15169").await.expect("ASN query failed");
    assert_eq!(res.query, 15169);
    assert!(res.name.is_some());
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
