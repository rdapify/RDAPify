//! Benchmarks for the RDAP response validation layer.
//!
//! Measures the cost of the two-step validation gate that every response
//! must pass before deserialisation:
//!
//! 1. `validate_json_structure` — depth, array size, object fields, string length.
//! 2. `validate_rdap_object`   — RDAP field-level limits (entities, links, …).
//! 3. `validate_rdap_response` — combined end-to-end (bytes → validated Value).
//! 4. `Normalizer::domain/ip/asn` — full normalisation pipeline (parse + map).
//!
//! All inputs are synthetic JSON values constructed in-process — no I/O.

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};

use rdap_core::validation::{validate_rdap_response, RdapValidationLimits};
use rdap_core::Normalizer;
use serde_json::{json, Value};

// ── Response fixtures ─────────────────────────────────────────────────────────

fn domain_json_bytes() -> Vec<u8> {
    json!({
        "objectClassName": "domain",
        "handle": "2138514_DOMAIN_COM-VRSN",
        "ldhName": "example.com",
        "unicodeName": "example.com",
        "status": ["client delete prohibited", "client transfer prohibited", "active"],
        "nameservers": [
            { "objectClassName": "nameserver", "ldhName": "ns1.example.com" },
            { "objectClassName": "nameserver", "ldhName": "ns2.example.com" }
        ],
        "entities": [{
            "objectClassName": "entity",
            "handle": "292",
            "roles": ["registrar"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn",      {}, "text", "Example Registrar Inc."]
            ]]
        }],
        "events": [
            { "eventAction": "registration", "eventDate": "1995-08-14T04:00:00Z" },
            { "eventAction": "expiration",   "eventDate": "2030-08-13T04:00:00Z" },
            { "eventAction": "last changed", "eventDate": "2023-08-14T07:01:14Z" }
        ],
        "links": [
            { "href": "https://rdap.verisign.com/com/v1/domain/example.com", "rel": "self" }
        ]
    })
    .to_string()
    .into_bytes()
}

fn ip_json_bytes() -> Vec<u8> {
    json!({
        "objectClassName": "ip network",
        "handle": "NET-8-8-8-0-1",
        "startAddress": "8.8.8.0",
        "endAddress": "8.8.8.255",
        "ipVersion": "v4",
        "name": "LVLT-GOOGL-8-8-8",
        "country": "US",
        "status": ["active"],
        "entities": [{
            "objectClassName": "entity",
            "handle": "GOOGL-ARIN",
            "roles": ["registrant"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn",      {}, "text", "Google LLC"]
            ]]
        }],
        "events": [
            { "eventAction": "registration", "eventDate": "1992-12-01T00:00:00Z" },
            { "eventAction": "last changed",  "eventDate": "2014-03-14T00:00:00Z" }
        ]
    })
    .to_string()
    .into_bytes()
}

fn asn_json_bytes() -> Vec<u8> {
    json!({
        "objectClassName": "autnum",
        "handle": "AS15169",
        "startAutnum": 15169,
        "endAutnum": 15169,
        "name": "GOOGLE",
        "country": "US",
        "status": ["active"],
        "entities": [{
            "objectClassName": "entity",
            "handle": "GOOGL-ARIN",
            "roles": ["registrant"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn",      {}, "text", "Google LLC"]
            ]]
        }],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-03-30T00:00:00Z" }
        ]
    })
    .to_string()
    .into_bytes()
}

/// Build a JSON response with `n` entities (stress-tests entity iteration).
fn domain_with_n_entities(n: usize) -> Vec<u8> {
    let entities: Vec<Value> = (0..n)
        .map(|i| {
            json!({
                "objectClassName": "entity",
                "handle": format!("REG-{i}"),
                "roles": ["registrar"],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn",      {}, "text", format!("Registrar {i}")]
                ]]
            })
        })
        .collect();

    json!({
        "objectClassName": "domain",
        "ldhName": "example.com",
        "status": ["active"],
        "entities": entities,
        "events": [{ "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" }]
    })
    .to_string()
    .into_bytes()
}

// ── Combined validation (bytes → Value) ───────────────────────────────────────

fn bench_validate_domain(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let bytes = domain_json_bytes();

    c.bench_function("validate_domain_response", |b| {
        b.iter(|| {
            criterion::black_box(validate_rdap_response(&bytes, &limits).unwrap());
        });
    });
}

fn bench_validate_ip(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let bytes = ip_json_bytes();

    c.bench_function("validate_ip_response", |b| {
        b.iter(|| {
            criterion::black_box(validate_rdap_response(&bytes, &limits).unwrap());
        });
    });
}

fn bench_validate_asn(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let bytes = asn_json_bytes();

    c.bench_function("validate_asn_response", |b| {
        b.iter(|| {
            criterion::black_box(validate_rdap_response(&bytes, &limits).unwrap());
        });
    });
}

// ── Entity-count scaling ──────────────────────────────────────────────────────

fn bench_validate_entity_scaling(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let mut group = c.benchmark_group("validate_entity_scaling");

    for &n in &[1usize, 5, 20, 50] {
        let bytes = domain_with_n_entities(n);
        group.bench_with_input(BenchmarkId::from_parameter(n), &bytes, |b, bytes| {
            b.iter(|| {
                criterion::black_box(validate_rdap_response(bytes, &limits).unwrap());
            });
        });
    }

    group.finish();
}

// ── Normaliser pipeline ───────────────────────────────────────────────────────
//
// Measures the full normalisation pipeline (validate → parse → struct mapping).

fn bench_normalise_domain(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let normalizer = Normalizer::new();
    let bytes = domain_json_bytes();
    let server = "https://rdap.verisign.com/com/v1";

    // Pre-validate once so each iteration only measures normalisation.
    let value = validate_rdap_response(&bytes, &limits).unwrap();

    c.bench_function("normalise_domain", |b| {
        b.iter(|| {
            criterion::black_box(
                normalizer
                    .domain("example.com", value.clone(), server, false)
                    .unwrap(),
            )
        });
    });
}

fn bench_normalise_ip(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let normalizer = Normalizer::new();
    let bytes = ip_json_bytes();
    let server = "https://rdap.arin.net/registry";

    let value = validate_rdap_response(&bytes, &limits).unwrap();

    c.bench_function("normalise_ip", |b| {
        b.iter(|| {
            criterion::black_box(
                normalizer
                    .ip("8.8.8.8", value.clone(), server, false)
                    .unwrap(),
            )
        });
    });
}

fn bench_normalise_asn(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let normalizer = Normalizer::new();
    let bytes = asn_json_bytes();
    let server = "https://rdap.arin.net/registry";

    let value = validate_rdap_response(&bytes, &limits).unwrap();

    c.bench_function("normalise_asn", |b| {
        b.iter(|| {
            criterion::black_box(
                normalizer.asn(15169, value.clone(), server, false).unwrap(),
            )
        });
    });
}

// ── Throughput: validate 1 000 small payloads ─────────────────────────────────

fn bench_validate_throughput(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let bytes = domain_json_bytes();

    c.bench_function("validate_1000_responses", |b| {
        b.iter(|| {
            for _ in 0..1_000 {
                criterion::black_box(validate_rdap_response(&bytes, &limits).unwrap());
            }
        });
    });
}

criterion_group!(
    benches,
    bench_validate_domain,
    bench_validate_ip,
    bench_validate_asn,
    bench_validate_entity_scaling,
    bench_normalise_domain,
    bench_normalise_ip,
    bench_normalise_asn,
    bench_validate_throughput,
);
criterion_main!(benches);
