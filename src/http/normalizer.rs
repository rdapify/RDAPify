//! Response normaliser — converts raw RDAP JSON into typed response structs.
//!
//! The normaliser extracts the minimum necessary fields from the raw response
//! and returns a typed, consistent struct regardless of which RDAP server
//! produced the response.

use chrono::Utc;
use serde_json::Value;

use crate::error::{RdapError, Result};
use crate::types::{
    asn::AsnResponse,
    common::{RdapEntity, RdapEvent, RdapLink, RdapRemark, RdapRole, RdapStatus, ResponseMeta},
    domain::{DomainResponse, RegistrarSummary},
    entity::EntityResponse,
    ip::{IpResponse, IpVersion},
    nameserver::{NameserverIpAddresses, NameserverResponse},
};

/// Normalises raw RDAP responses into typed structs.
#[derive(Debug, Clone, Default)]
pub struct Normalizer;

impl Normalizer {
    pub fn new() -> Self {
        Self
    }

    // ── Public normalisation methods ──────────────────────────────────────────

    pub fn domain(
        &self,
        query: &str,
        raw: Value,
        source: &str,
        cached: bool,
    ) -> Result<DomainResponse> {
        let meta = make_meta(source, cached);
        let obj = require_object(&raw)?;

        let entities = parse_entities(obj.get("entities"));
        let events = parse_events(obj.get("events"));

        let nameservers = obj
            .get("nameservers")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|ns| {
                        ns.get("ldhName")
                            .or_else(|| ns.get("unicodeName"))
                            .and_then(|v| v.as_str())
                            .map(str::to_lowercase)
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let registrar = extract_registrar(&entities);

        Ok(DomainResponse {
            query: query.to_string(),
            ldh_name: string_field(obj, "ldhName"),
            unicode_name: string_field(obj, "unicodeName"),
            handle: string_field(obj, "handle"),
            status: parse_status(obj.get("status")),
            nameservers,
            registrar,
            entities,
            events,
            links: parse_links(obj.get("links")),
            remarks: parse_remarks(obj.get("remarks")),
            meta,
        })
    }

    pub fn ip(&self, query: &str, raw: Value, source: &str, cached: bool) -> Result<IpResponse> {
        let meta = make_meta(source, cached);
        let obj = require_object(&raw)?;

        let ip_version = obj
            .get("ipVersion")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "v4" => IpVersion::V4,
                _ => IpVersion::V6,
            });

        Ok(IpResponse {
            query: query.to_string(),
            handle: string_field(obj, "handle"),
            start_address: string_field(obj, "startAddress"),
            end_address: string_field(obj, "endAddress"),
            ip_version,
            name: string_field(obj, "name"),
            allocation_type: string_field(obj, "type"),
            country: string_field(obj, "country"),
            parent_handle: string_field(obj, "parentHandle"),
            status: parse_status(obj.get("status")),
            entities: parse_entities(obj.get("entities")),
            events: parse_events(obj.get("events")),
            links: parse_links(obj.get("links")),
            remarks: parse_remarks(obj.get("remarks")),
            meta,
        })
    }

    pub fn asn(&self, query: u32, raw: Value, source: &str, cached: bool) -> Result<AsnResponse> {
        let meta = make_meta(source, cached);
        let obj = require_object(&raw)?;

        Ok(AsnResponse {
            query,
            handle: string_field(obj, "handle"),
            start_autnum: obj
                .get("startAutnum")
                .and_then(|v| v.as_u64())
                .map(|n| n as u32),
            end_autnum: obj
                .get("endAutnum")
                .and_then(|v| v.as_u64())
                .map(|n| n as u32),
            name: string_field(obj, "name"),
            autnum_type: string_field(obj, "type"),
            country: string_field(obj, "country"),
            status: parse_status(obj.get("status")),
            entities: parse_entities(obj.get("entities")),
            events: parse_events(obj.get("events")),
            links: parse_links(obj.get("links")),
            remarks: parse_remarks(obj.get("remarks")),
            meta,
        })
    }

    pub fn nameserver(
        &self,
        query: &str,
        raw: Value,
        source: &str,
        cached: bool,
    ) -> Result<NameserverResponse> {
        let meta = make_meta(source, cached);
        let obj = require_object(&raw)?;

        let ip_addresses = {
            let ip_obj = obj.get("ipAddresses").and_then(|v| v.as_object());
            NameserverIpAddresses {
                v4: ip_obj
                    .and_then(|o| o.get("v4"))
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(str::to_string))
                            .collect()
                    })
                    .unwrap_or_default(),
                v6: ip_obj
                    .and_then(|o| o.get("v6"))
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(str::to_string))
                            .collect()
                    })
                    .unwrap_or_default(),
            }
        };

        Ok(NameserverResponse {
            query: query.to_string(),
            handle: string_field(obj, "handle"),
            ldh_name: string_field(obj, "ldhName"),
            unicode_name: string_field(obj, "unicodeName"),
            ip_addresses,
            status: parse_status(obj.get("status")),
            entities: parse_entities(obj.get("entities")),
            events: parse_events(obj.get("events")),
            links: parse_links(obj.get("links")),
            remarks: parse_remarks(obj.get("remarks")),
            meta,
        })
    }

    pub fn entity(
        &self,
        query: &str,
        raw: Value,
        source: &str,
        cached: bool,
    ) -> Result<EntityResponse> {
        let meta = make_meta(source, cached);
        let obj = require_object(&raw)?;

        let roles = obj
            .get("roles")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value::<RdapRole>(v.clone()).ok())
                    .collect()
            })
            .unwrap_or_default();

        Ok(EntityResponse {
            query: query.to_string(),
            handle: string_field(obj, "handle"),
            vcard_array: obj.get("vcardArray").cloned(),
            roles,
            status: parse_status(obj.get("status")),
            entities: parse_entities(obj.get("entities")),
            events: parse_events(obj.get("events")),
            links: parse_links(obj.get("links")),
            remarks: parse_remarks(obj.get("remarks")),
            meta,
        })
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

fn make_meta(source: &str, cached: bool) -> ResponseMeta {
    ResponseMeta {
        source: source.to_string(),
        queried_at: Utc::now().to_rfc3339(),
        cached,
    }
}

fn require_object(value: &Value) -> Result<&serde_json::Map<String, Value>> {
    value.as_object().ok_or_else(|| RdapError::ParseError {
        reason: "Expected a JSON object at the response root".to_string(),
    })
}

fn string_field(obj: &serde_json::Map<String, Value>, key: &str) -> Option<String> {
    obj.get(key).and_then(|v| v.as_str()).map(str::to_string)
}

fn parse_status(value: Option<&Value>) -> Vec<RdapStatus> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<RdapStatus>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn parse_events(value: Option<&Value>) -> Vec<RdapEvent> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<RdapEvent>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn parse_links(value: Option<&Value>) -> Vec<RdapLink> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<RdapLink>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn parse_remarks(value: Option<&Value>) -> Vec<RdapRemark> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<RdapRemark>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn parse_entities(value: Option<&Value>) -> Vec<RdapEntity> {
    value
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| serde_json::from_value::<RdapEntity>(v.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

/// Extracts a condensed `RegistrarSummary` from the entities list.
fn extract_registrar(entities: &[RdapEntity]) -> Option<RegistrarSummary> {
    let registrar_entity = entities
        .iter()
        .find(|e| e.roles.iter().any(|r| matches!(r, RdapRole::Registrar)))?;

    // Try to get the name from vCard
    let name = registrar_entity
        .vcard_array
        .as_ref()
        .and_then(extract_vcard_name);

    // Try to get the URL from links
    let url = registrar_entity
        .links
        .iter()
        .find(|l| l.rel.as_deref() == Some("self"))
        .map(|l| l.href.clone());

    Some(RegistrarSummary {
        name,
        handle: registrar_entity.handle.clone(),
        url,
        abuse_email: None,
        abuse_phone: None,
    })
}

/// Tries to extract the `fn` (full name) property from a vCard array.
fn extract_vcard_name(vcard: &Value) -> Option<String> {
    let outer = vcard.as_array()?;
    // vCard format: ["vcard", [[property, {}, type, value], ...]]
    let props = outer.get(1)?.as_array()?;

    for prop in props {
        let arr = prop.as_array()?;
        if arr.first()?.as_str()? == "fn" {
            return arr.get(3).and_then(|v| v.as_str()).map(str::to_string);
        }
    }
    None
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn norm() -> Normalizer {
        Normalizer::new()
    }

    // ── domain ────────────────────────────────────────────────────────────────

    #[test]
    fn domain_basic_fields() {
        let raw = json!({
            "ldhName": "EXAMPLE.COM",
            "unicodeName": "example.com",
            "handle": "DOMAIN-HANDLE-1",
            "status": ["active"],
            "nameservers": [
                { "ldhName": "NS1.EXAMPLE.COM" },
                { "ldhName": "NS2.EXAMPLE.COM" }
            ]
        });
        let res = norm()
            .domain("example.com", raw, "https://rdap.example/", false)
            .unwrap();

        assert_eq!(res.query, "example.com");
        assert_eq!(res.ldh_name.as_deref(), Some("EXAMPLE.COM"));
        assert_eq!(res.unicode_name.as_deref(), Some("example.com"));
        assert_eq!(res.handle.as_deref(), Some("DOMAIN-HANDLE-1"));
        assert!(res.is_active());
        assert_eq!(res.nameservers, vec!["ns1.example.com", "ns2.example.com"]);
        assert!(!res.meta.cached);
        assert_eq!(res.meta.source, "https://rdap.example/");
    }

    #[test]
    fn domain_cached_flag_propagates() {
        let raw = json!({ "ldhName": "EXAMPLE.COM" });
        let res = norm()
            .domain("example.com", raw, "https://rdap.example/", true)
            .unwrap();
        assert!(res.meta.cached);
    }

    #[test]
    fn domain_missing_optional_fields_are_none() {
        let raw = json!({});
        let res = norm()
            .domain("example.com", raw, "https://rdap.example/", false)
            .unwrap();
        assert!(res.ldh_name.is_none());
        assert!(res.unicode_name.is_none());
        assert!(res.handle.is_none());
        assert!(res.registrar.is_none());
        assert!(res.nameservers.is_empty());
        assert!(res.status.is_empty());
    }

    #[test]
    fn domain_nameservers_normalised_to_lowercase() {
        let raw = json!({
            "nameservers": [
                { "ldhName": "NS1.UPPER.COM" },
                { "unicodeName": "NS2.UPPER.COM" }  // fallback to unicodeName
            ]
        });
        let res = norm().domain("upper.com", raw, "s", false).unwrap();
        assert_eq!(res.nameservers, vec!["ns1.upper.com", "ns2.upper.com"]);
    }

    #[test]
    fn domain_events_expiration_and_registration() {
        let raw = json!({
            "events": [
                { "eventAction": "registration", "eventDate": "2010-01-01T00:00:00Z" },
                { "eventAction": "expiration",   "eventDate": "2030-01-01T00:00:00Z" }
            ]
        });
        let res = norm().domain("example.com", raw, "s", false).unwrap();
        assert_eq!(res.registration_date(), Some("2010-01-01T00:00:00Z"));
        assert_eq!(res.expiration_date(), Some("2030-01-01T00:00:00Z"));
    }

    #[test]
    fn domain_is_active_false_when_no_active_status() {
        let raw = json!({ "status": ["locked", "transfer prohibited"] });
        let res = norm().domain("example.com", raw, "s", false).unwrap();
        assert!(!res.is_active());
    }

    #[test]
    fn domain_registrar_extracted_from_entities() {
        let raw = json!({
            "entities": [{
                "handle": "REG-123",
                "roles": ["registrar"],
                "links": [{ "href": "https://registrar.example/", "rel": "self" }],
                "vcardArray": ["vcard", [
                    ["version", {}, "text", "4.0"],
                    ["fn",      {}, "text", "ACME Registrar Inc"]
                ]]
            }]
        });
        let res = norm().domain("example.com", raw, "s", false).unwrap();
        let reg = res.registrar.unwrap();
        assert_eq!(reg.handle.as_deref(), Some("REG-123"));
        assert_eq!(reg.name.as_deref(), Some("ACME Registrar Inc"));
        assert_eq!(reg.url.as_deref(), Some("https://registrar.example/"));
    }

    #[test]
    fn domain_no_registrar_when_no_registrar_entity() {
        let raw = json!({
            "entities": [{ "handle": "TECH-1", "roles": ["technical"] }]
        });
        let res = norm().domain("example.com", raw, "s", false).unwrap();
        assert!(res.registrar.is_none());
    }

    #[test]
    fn domain_non_object_json_returns_error() {
        let res = norm().domain("example.com", json!([1, 2, 3]), "s", false);
        assert!(res.is_err());
    }

    // ── ip ────────────────────────────────────────────────────────────────────

    #[test]
    fn ip_basic_v4_fields() {
        let raw = json!({
            "handle": "NET-192-0-2-0-1",
            "startAddress": "192.0.2.0",
            "endAddress": "192.0.2.255",
            "ipVersion": "v4",
            "name": "TEST-NET",
            "type": "ALLOCATED",
            "country": "US",
            "parentHandle": "NET-192-0-0-0-0"
        });
        let res = norm()
            .ip("192.0.2.0/24", raw, "https://rdap.arin.net/", false)
            .unwrap();

        assert_eq!(res.query, "192.0.2.0/24");
        assert_eq!(res.handle.as_deref(), Some("NET-192-0-2-0-1"));
        assert_eq!(res.start_address.as_deref(), Some("192.0.2.0"));
        assert_eq!(res.end_address.as_deref(), Some("192.0.2.255"));
        assert_eq!(res.ip_version, Some(IpVersion::V4));
        assert_eq!(res.name.as_deref(), Some("TEST-NET"));
        assert_eq!(res.country.as_deref(), Some("US"));
        assert_eq!(res.parent_handle.as_deref(), Some("NET-192-0-0-0-0"));
    }

    #[test]
    fn ip_v6_detected_from_ip_version_field() {
        let raw = json!({ "ipVersion": "v6", "startAddress": "2001:db8::" });
        let res = norm().ip("2001:db8::/32", raw, "s", false).unwrap();
        assert_eq!(res.ip_version, Some(IpVersion::V6));
    }

    #[test]
    fn ip_unknown_version_treated_as_v6() {
        let raw = json!({ "ipVersion": "v99" });
        let res = norm().ip("q", raw, "s", false).unwrap();
        assert_eq!(res.ip_version, Some(IpVersion::V6));
    }

    #[test]
    fn ip_missing_ip_version_is_none() {
        let raw = json!({ "startAddress": "1.2.3.4" });
        let res = norm().ip("1.2.3.4", raw, "s", false).unwrap();
        assert!(res.ip_version.is_none());
    }

    #[test]
    fn ip_non_object_json_returns_error() {
        let res = norm().ip("1.2.3.4", json!("not an object"), "s", false);
        assert!(res.is_err());
    }

    // ── asn ───────────────────────────────────────────────────────────────────

    #[test]
    fn asn_basic_fields() {
        let raw = json!({
            "handle": "AS15169",
            "startAutnum": 15169,
            "endAutnum": 15169,
            "name": "GOOGLE",
            "type": "DIRECT ALLOCATION",
            "country": "US"
        });
        let res = norm()
            .asn(15169, raw, "https://rdap.arin.net/", false)
            .unwrap();

        assert_eq!(res.query, 15169);
        assert_eq!(res.handle.as_deref(), Some("AS15169"));
        assert_eq!(res.start_autnum, Some(15169));
        assert_eq!(res.end_autnum, Some(15169));
        assert_eq!(res.name.as_deref(), Some("GOOGLE"));
        assert_eq!(res.country.as_deref(), Some("US"));
    }

    #[test]
    fn asn_missing_autnum_range_is_none() {
        let raw = json!({ "handle": "AS64512" });
        let res = norm().asn(64512, raw, "s", false).unwrap();
        assert!(res.start_autnum.is_none());
        assert!(res.end_autnum.is_none());
    }

    #[test]
    fn asn_non_object_json_returns_error() {
        let res = norm().asn(1, json!(null), "s", false);
        assert!(res.is_err());
    }

    // ── nameserver ────────────────────────────────────────────────────────────

    #[test]
    fn nameserver_basic_fields() {
        let raw = json!({
            "handle": "NS-1",
            "ldhName": "NS1.EXAMPLE.COM",
            "unicodeName": "ns1.example.com",
            "ipAddresses": {
                "v4": ["192.0.2.1", "192.0.2.2"],
                "v6": ["2001:db8::1"]
            }
        });
        let res = norm()
            .nameserver("ns1.example.com", raw, "s", false)
            .unwrap();

        assert_eq!(res.query, "ns1.example.com");
        assert_eq!(res.handle.as_deref(), Some("NS-1"));
        assert_eq!(res.ldh_name.as_deref(), Some("NS1.EXAMPLE.COM"));
        assert_eq!(res.ip_addresses.v4, vec!["192.0.2.1", "192.0.2.2"]);
        assert_eq!(res.ip_addresses.v6, vec!["2001:db8::1"]);
    }

    #[test]
    fn nameserver_empty_ip_addresses_when_field_absent() {
        let raw = json!({ "ldhName": "NS1.EXAMPLE.COM" });
        let res = norm()
            .nameserver("ns1.example.com", raw, "s", false)
            .unwrap();
        assert!(res.ip_addresses.v4.is_empty());
        assert!(res.ip_addresses.v6.is_empty());
    }

    #[test]
    fn nameserver_non_object_json_returns_error() {
        let res = norm().nameserver("ns1.example.com", json!(42), "s", false);
        assert!(res.is_err());
    }

    // ── entity ────────────────────────────────────────────────────────────────

    #[test]
    fn entity_basic_fields() {
        let raw = json!({
            "handle": "ENTITY-1",
            "roles": ["registrant", "administrative"],
            "vcardArray": ["vcard", [
                ["version", {}, "text", "4.0"],
                ["fn",      {}, "text", "Jane Doe"]
            ]]
        });
        let res = norm().entity("ENTITY-1", raw, "s", false).unwrap();

        assert_eq!(res.query, "ENTITY-1");
        assert_eq!(res.handle.as_deref(), Some("ENTITY-1"));
        assert_eq!(res.roles.len(), 2);
        assert!(res.roles.iter().any(|r| matches!(r, RdapRole::Registrant)));
        assert!(res
            .roles
            .iter()
            .any(|r| matches!(r, RdapRole::Administrative)));
        assert!(res.vcard_array.is_some());
    }

    #[test]
    fn entity_unknown_role_preserved_as_other() {
        let raw = json!({ "roles": ["novelRole"] });
        let res = norm().entity("E-1", raw, "s", false).unwrap();
        assert!(matches!(&res.roles[0], RdapRole::Other(s) if s == "novelRole"));
    }

    #[test]
    fn entity_empty_roles_when_absent() {
        let raw = json!({ "handle": "E-1" });
        let res = norm().entity("E-1", raw, "s", false).unwrap();
        assert!(res.roles.is_empty());
    }

    #[test]
    fn entity_non_object_json_returns_error() {
        let res = norm().entity("E-1", json!(true), "s", false);
        assert!(res.is_err());
    }

    // ── vcard extraction ──────────────────────────────────────────────────────

    #[test]
    fn extract_vcard_name_returns_fn_property() {
        let vcard = json!([
            "vcard",
            [
                ["version", {}, "text", "4.0"],
                ["fn", {}, "text", "Acme Corp"]
            ]
        ]);
        assert_eq!(extract_vcard_name(&vcard), Some("Acme Corp".to_string()));
    }

    #[test]
    fn extract_vcard_name_returns_none_when_no_fn() {
        let vcard = json!(["vcard", [["version", {}, "text", "4.0"]]]);
        assert_eq!(extract_vcard_name(&vcard), None);
    }

    #[test]
    fn extract_vcard_name_returns_none_for_invalid_structure() {
        assert_eq!(extract_vcard_name(&json!("not a vcard")), None);
        assert_eq!(extract_vcard_name(&json!([])), None);
        assert_eq!(extract_vcard_name(&json!(["vcard"])), None);
    }

    // ── status parsing ────────────────────────────────────────────────────────

    #[test]
    fn status_multi_valued_parsed_correctly() {
        let raw = json!({
            "status": ["active", "locked", "transfer prohibited", "unknownStatus"]
        });
        let res = norm().domain("example.com", raw, "s", false).unwrap();
        assert!(res.status.iter().any(|s| matches!(s, RdapStatus::Active)));
        assert!(res.status.iter().any(|s| matches!(s, RdapStatus::Locked)));
        assert!(res
            .status
            .iter()
            .any(|s| matches!(s, RdapStatus::TransferProhibited)));
        assert!(res
            .status
            .iter()
            .any(|s| matches!(s, RdapStatus::Other(v) if v == "unknownStatus")));
    }
}
