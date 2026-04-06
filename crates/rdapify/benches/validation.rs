//! Benchmarks for the RDAP response validation layer (`rdap-core`).
//!
//! # What is measured
//!
//! * `validate_rdap_response` end-to-end on payloads of varying sizes.
//! * `validate_json_structure` in isolation for depth / array / string checks.
//! * `validate_rdap_object` in isolation for field-level checks.
//!
//! These benchmarks are purely in-process (no I/O). They measure the
//! incremental overhead added by validation before deserialization.
//!
//! # Performance targets
//!
//! | Payload          | Target overhead |
//! |------------------|----------------|
//! | Minimal domain   | < 10 µs        |
//! | Typical domain   | < 50 µs        |
//! | Large domain     | < 200 µs       |
//! | Cache hit (no validation) | < 5 µs |

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use serde_json::json;

use rdap_core::validation::{validate_rdap_response, RdapValidationLimits};

// ── JSON fixtures ─────────────────────────────────────────────────────────────

/// Minimal RDAP domain payload (~100 bytes).
fn minimal_domain_bytes() -> Vec<u8> {
    json!({
        "objectClassName": "domain",
        "ldhName": "example.com",
        "status": ["active"]
    })
    .to_string()
    .into_bytes()
}

/// Typical RDAP domain payload (~1 KB).
fn typical_domain_bytes() -> Vec<u8> {
    json!({
        "objectClassName": "domain",
        "handle": "EXAMPLE-VERISIGN",
        "ldhName": "example.com",
        "status": ["client delete prohibited", "client transfer prohibited", "active"],
        "nameservers": [
            { "objectClassName": "nameserver", "ldhName": "ns1.example.com" },
            { "objectClassName": "nameserver", "ldhName": "ns2.example.com" },
            { "objectClassName": "nameserver", "ldhName": "ns3.example.com" }
        ],
        "entities": [
            {
                "objectClassName": "entity",
                "handle": "R1-LROR",
                "roles": ["registrar"],
                "publicIds": [{ "type": "IANA Registrar ID", "identifier": "376" }],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", "ACME Registrar, Inc."],
                    ["tel", { "type": ["voice"] }, "uri", "tel:+1.4805551212"]
                ]],
                "entities": [{
                    "objectClassName": "entity",
                    "roles": ["abuse"],
                    "vcardArray": ["vcard", [
                        ["version", {}, "text", "4.0"],
                        ["fn", {}, "text", "Abuse Contact"]
                    ]]
                }]
            },
            {
                "objectClassName": "entity",
                "handle": "C100-LROR",
                "roles": ["registrant", "technical"],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", "Example, Inc."],
                    ["adr", {}, "text", ["", "", "1 Example St", "Anytown", "CA", "94025", "US"]]
                ]]
            }
        ],
        "events": [
            { "eventAction": "registration",     "eventDate": "1995-08-14T04:00:00Z" },
            { "eventAction": "expiration",        "eventDate": "2030-08-13T04:00:00Z" },
            { "eventAction": "last changed",      "eventDate": "2024-01-15T12:00:00Z" },
            { "eventAction": "last update of RDAP database", "eventDate": "2024-03-20T00:00:00Z" }
        ],
        "links": [
            {
                "value":  "https://rdap.verisign.com/com/v1/domain/example.com",
                "rel":    "self",
                "href":   "https://rdap.verisign.com/com/v1/domain/example.com",
                "type":   "application/rdap+json"
            }
        ],
        "remarks": [{
            "title": "Terms of Use",
            "description": ["The data in this record is provided by Verisign."]
        }]
    })
    .to_string()
    .into_bytes()
}

/// Large RDAP domain payload with many entities (~5 KB).
fn large_domain_bytes(entity_count: usize) -> Vec<u8> {
    let entities: Vec<serde_json::Value> = (0..entity_count)
        .map(|i| {
            json!({
                "objectClassName": "entity",
                "handle": format!("ENTITY-{i}"),
                "roles": ["technical"],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", format!("Contact {i}")]
                ]],
                "events": [{ "eventAction": "registration", "eventDate": "2020-01-01T00:00:00Z" }]
            })
        })
        .collect();

    json!({
        "objectClassName": "domain",
        "handle": "LARGE-DOMAIN",
        "ldhName": "large.com",
        "status": ["active"],
        "nameservers": (0..8).map(|i| json!({
            "objectClassName": "nameserver",
            "ldhName": format!("ns{i}.large.com")
        })).collect::<Vec<_>>(),
        "entities": entities,
        "events": (0..10).map(|i| json!({
            "eventAction": format!("event-{i}"),
            "eventDate": "2024-01-01T00:00:00Z"
        })).collect::<Vec<_>>(),
        "links": (0..5).map(|i| json!({
            "value": format!("https://rdap.example.com/link/{i}"),
            "rel": "related",
            "href": format!("https://rdap.example.com/link/{i}"),
            "type": "application/rdap+json"
        })).collect::<Vec<_>>()
    })
    .to_string()
    .into_bytes()
}

// ── Benchmarks ────────────────────────────────────────────────────────────────

fn bench_validate_payload_sizes(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let minimal = minimal_domain_bytes();
    let typical = typical_domain_bytes();
    let large_20 = large_domain_bytes(20);
    let large_50 = large_domain_bytes(50);

    let mut group = c.benchmark_group("validation/full_pipeline");

    group.bench_function("minimal_domain", |b| {
        b.iter(|| {
            criterion::black_box(
                validate_rdap_response(&minimal, &limits).expect("validation failed"),
            )
        });
    });

    group.bench_function("typical_domain", |b| {
        b.iter(|| {
            criterion::black_box(
                validate_rdap_response(&typical, &limits).expect("validation failed"),
            )
        });
    });

    group.bench_function("large_domain_20_entities", |b| {
        b.iter(|| {
            criterion::black_box(
                validate_rdap_response(&large_20, &limits).expect("validation failed"),
            )
        });
    });

    group.bench_function("large_domain_50_entities", |b| {
        b.iter(|| {
            criterion::black_box(
                validate_rdap_response(&large_50, &limits).expect("validation failed"),
            )
        });
    });

    group.finish();
}

fn bench_validate_limit_scenarios(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();

    // Pre-build all payloads
    let payloads: Vec<(usize, Vec<u8>)> = [1, 10, 50, 100]
        .iter()
        .map(|&n| (n, large_domain_bytes(n)))
        .collect();

    let mut group = c.benchmark_group("validation/by_entity_count");
    for (n, bytes) in &payloads {
        group.bench_with_input(BenchmarkId::from_parameter(n), bytes, |b, payload| {
            b.iter(|| {
                criterion::black_box(
                    validate_rdap_response(payload, &limits).expect("validation failed"),
                )
            });
        });
    }
    group.finish();
}

fn bench_validation_overhead_vs_raw_parse(c: &mut Criterion) {
    let limits = RdapValidationLimits::default();
    let bytes = typical_domain_bytes();

    let mut group = c.benchmark_group("validation/overhead_comparison");

    group.bench_function("raw_serde_parse", |b| {
        b.iter(|| {
            criterion::black_box(
                serde_json::from_slice::<serde_json::Value>(&bytes).expect("parse failed"),
            )
        });
    });

    group.bench_function("validated_parse", |b| {
        b.iter(|| {
            criterion::black_box(
                validate_rdap_response(&bytes, &limits).expect("validation failed"),
            )
        });
    });

    group.finish();
}

criterion_group!(
    benches,
    bench_validate_payload_sizes,
    bench_validate_limit_scenarios,
    bench_validation_overhead_vs_raw_parse,
);
criterion_main!(benches);
