//! Shared test utilities: mock server helpers.

use serde_json::{json, Value};

// ── IANA Bootstrap fixtures ───────────────────────────────────────────────────

pub fn dns_bootstrap_json(tld: &str, server_url: &str) -> Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "description": "RDAP bootstrap file for top-level domains",
        "services": [
            [[tld], [server_url]]
        ]
    })
}

pub fn ipv4_bootstrap_json(cidr: &str, server_url: &str) -> Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "description": "RDAP bootstrap file for IPv4",
        "services": [
            [[cidr], [server_url]]
        ]
    })
}

pub fn asn_bootstrap_json(range: &str, server_url: &str) -> Value {
    json!({
        "version": "1.0",
        "publication": "2024-01-01T00:00:00Z",
        "description": "RDAP bootstrap file for ASNs",
        "services": [
            [[range], [server_url]]
        ]
    })
}

// ── RDAP response fixtures ────────────────────────────────────────────────────

pub fn domain_rdap_response(ldh_name: &str) -> Value {
    json!({
        "objectClassName": "domain",
        "handle": "2138514_DOMAIN_COM-VRSN",
        "ldhName": ldh_name,
        "unicodeName": ldh_name,
        "status": ["client delete prohibited", "client transfer prohibited", "active"],
        "nameservers": [
            { "objectClassName": "nameserver", "ldhName": "ns1.example.com" },
            { "objectClassName": "nameserver", "ldhName": "ns2.example.com" }
        ],
        "entities": [
            {
                "objectClassName": "entity",
                "handle": "292",
                "roles": ["registrar"],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", "Test Registrar Inc."]
                ]],
                "links": [
                    { "href": "https://www.test-registrar.com", "rel": "self", "type": "text/html" }
                ]
            }
        ],
        "events": [
            { "eventAction": "registration", "eventDate": "1995-08-14T04:00:00Z" },
            { "eventAction": "expiration",   "eventDate": "2025-08-13T04:00:00Z" },
            { "eventAction": "last changed", "eventDate": "2023-08-14T07:01:14Z" }
        ],
        "links": [
            { "href": "https://rdap.verisign.com/com/v1/domain/example.com", "rel": "self", "type": "application/rdap+json" }
        ]
    })
}

pub fn ip_rdap_response(start: &str, end: &str, country: &str) -> Value {
    json!({
        "objectClassName": "ip network",
        "handle": "NET-8-8-8-0-1",
        "startAddress": start,
        "endAddress": end,
        "ipVersion": "v4",
        "name": "LVLT-GOOGL-8-8-8",
        "type": "DIRECT ALLOCATION",
        "country": country,
        "status": ["active"],
        "entities": [
            {
                "objectClassName": "entity",
                "handle": "GOOGL-ARIN",
                "roles": ["registrant"],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", "Google LLC"]
                ]]
            }
        ],
        "events": [
            { "eventAction": "registration", "eventDate": "1992-12-01T00:00:00Z" },
            { "eventAction": "last changed",  "eventDate": "2014-03-14T00:00:00Z" }
        ]
    })
}

pub fn asn_rdap_response(start: u32, end: u32, name: &str) -> Value {
    json!({
        "objectClassName": "autnum",
        "handle": format!("AS{start}"),
        "startAutnum": start,
        "endAutnum": end,
        "name": name,
        "type": "DIRECT ALLOCATION",
        "country": "US",
        "status": ["active"],
        "entities": [
            {
                "objectClassName": "entity",
                "handle": "GOOGL-ARIN",
                "roles": ["registrant"],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", "Google LLC"]
                ]]
            }
        ],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-03-30T00:00:00Z" }
        ]
    })
}

pub fn nameserver_rdap_response(ldh_name: &str) -> Value {
    json!({
        "objectClassName": "nameserver",
        "handle": "2138514-NS",
        "ldhName": ldh_name,
        "unicodeName": ldh_name,
        "status": ["active"],
        "ipAddresses": {
            "v4": ["8.8.8.8", "8.8.4.4"],
            "v6": ["2001:4860:4860::8888"]
        },
        "events": [
            { "eventAction": "registration", "eventDate": "1993-09-30T04:00:00Z" }
        ]
    })
}

pub fn entity_rdap_response(handle: &str) -> Value {
    json!({
        "objectClassName": "entity",
        "handle": handle,
        "roles": ["registrar"],
        "vcardArray": ["vcard", [
            ["version", {}, "text", "4.0"],
            ["fn",      {}, "text", "Test Entity"],
            ["email",   {}, "text", "test@example.com"]
        ]],
        "status": ["active"],
        "events": [
            { "eventAction": "registration", "eventDate": "2000-01-01T00:00:00Z" }
        ]
    })
}
