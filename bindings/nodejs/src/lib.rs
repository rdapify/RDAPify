//! Node.js binding for rdapify — built with napi-rs.
//!
//! Exposes all query types as async JavaScript functions.
//! Each function returns a plain JavaScript object (via serde-json).
//!
//! # Usage (JavaScript/TypeScript)
//! ```js
//! const { domain, ip, asn, nameserver, entity } = require('rdapify-nd');
//!
//! const result = await domain('example.com');
//! console.log(result.registrar?.name);
//!
//! const ipResult = await ip('8.8.8.8');
//! console.log(ipResult.country);
//! ```

#![deny(clippy::all)]

use std::sync::OnceLock;

use napi_derive::napi;
use rdapify::{AsnEvent, NameserverEvent, RdapClient, StreamConfig};
use tokio_stream::StreamExt;

/// Module-level singleton — constructed once, reused across all JS calls.
///
/// `RdapClient` is cheap to clone (all inner state is `Arc`-wrapped), so
/// cloning for each call is effectively free while keeping the async API
/// straightforward.
static CLIENT: OnceLock<RdapClient> = OnceLock::new();

fn get_client() -> napi::Result<RdapClient> {
    Ok(CLIENT
        .get_or_init(|| RdapClient::new().expect("failed to initialise RdapClient"))
        .clone())
}

/// Query RDAP information for a domain name.
///
/// @param domainName - Domain name (e.g. "example.com", Unicode IDNs supported)
/// @returns Normalised RDAP domain object
#[napi]
pub async fn domain(domain_name: String) -> napi::Result<serde_json::Value> {
    let client = get_client()?;
    let result = client
        .domain(&domain_name)
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    serde_json::to_value(result).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Query RDAP information for an IP address (IPv4 or IPv6).
///
/// @param ipAddress - IP address (e.g. "8.8.8.8", "2001:4860:4860::8888")
/// @returns Normalised RDAP IP network object
#[napi]
pub async fn ip(ip_address: String) -> napi::Result<serde_json::Value> {
    let client = get_client()?;
    let result = client
        .ip(&ip_address)
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    serde_json::to_value(result).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Query RDAP information for an Autonomous System Number.
///
/// @param asnValue - ASN number or prefixed form (e.g. "15169", "AS15169")
/// @returns Normalised RDAP autnum object
#[napi]
pub async fn asn(asn_value: String) -> napi::Result<serde_json::Value> {
    let client = get_client()?;
    let result = client
        .asn(&asn_value)
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    serde_json::to_value(result).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Query RDAP information for a nameserver hostname.
///
/// @param hostname - Nameserver hostname (e.g. "ns1.google.com")
/// @returns Normalised RDAP nameserver object
#[napi]
pub async fn nameserver(hostname: String) -> napi::Result<serde_json::Value> {
    let client = get_client()?;
    let result = client
        .nameserver(&hostname)
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    serde_json::to_value(result).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Query RDAP information for an entity (contact / registrar).
///
/// Entities have no global bootstrap registry — an explicit server URL is required.
///
/// @param handle    - Entity handle (e.g. "ARIN-HN-1")
/// @param serverUrl - RDAP server base URL (e.g. "https://rdap.arin.net/registry")
/// @returns Normalised RDAP entity object
#[napi]
pub async fn entity(handle: String, server_url: String) -> napi::Result<serde_json::Value> {
    let client = get_client()?;
    let result = client
        .entity(&handle, &server_url)
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    serde_json::to_value(result).map_err(|e| napi::Error::from_reason(e.to_string()))
}

/// Check whether a domain is available for registration.
///
/// @param name - Domain name (e.g. "example.com")
/// @returns Object with `available` boolean and `expiresAt` string or null
#[napi]
pub async fn domain_available(name: String) -> napi::Result<serde_json::Value> {
    let client = get_client()?;
    let result = client
        .domain_available(&name)
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    Ok(serde_json::json!({
        "available": result.available,
        "expiresAt": result.expires_at,
    }))
}

/// Check availability for multiple domains concurrently.
///
/// @param names - Array of domain names to check
/// @returns Array of objects with `name`, `available`, `expiresAt`, and `error` fields
#[napi]
pub async fn domain_available_batch(
    names: Vec<String>,
) -> napi::Result<Vec<serde_json::Value>> {
    let client = get_client()?;
    let results = client.domain_available_batch(names.clone(), None).await;
    let output = names
        .into_iter()
        .zip(results)
        .map(|(name, res)| match res {
            Ok(r) => serde_json::json!({
                "name": name,
                "available": r.available,
                "expiresAt": r.expires_at.as_deref().unwrap_or_default(),
                "error": null,
            }),
            Err(e) => serde_json::json!({
                "name": name,
                "available": false,
                "expiresAt": null,
                "error": e.to_string(),
            }),
        })
        .collect();
    Ok(output)
}

/// Stream RDAP ASN results for multiple queries, collecting all events.
///
/// @param queries - Array of ASN values (e.g. ["15169", "AS32934"])
/// @returns Array of objects with `query`, `result`, and `error` fields
#[napi]
pub async fn stream_asn(queries: Vec<String>) -> napi::Result<Vec<serde_json::Value>> {
    let client = get_client()?;
    let stream = client.stream_asn(queries, StreamConfig::default());
    let events: Vec<AsnEvent> = stream.collect().await;
    let output = events
        .into_iter()
        .map(|event| match event {
            AsnEvent::Result(r) => serde_json::json!({
                "query": r.query.to_string(),
                "result": serde_json::to_value(*r).unwrap_or(serde_json::Value::Null),
                "error": null,
            }),
            AsnEvent::Error { query, error } => serde_json::json!({
                "query": query,
                "result": null,
                "error": error.to_string(),
            }),
        })
        .collect();
    Ok(output)
}

/// Stream RDAP nameserver results for multiple queries, collecting all events.
///
/// @param queries - Array of nameserver hostnames (e.g. ["ns1.google.com"])
/// @returns Array of objects with `query`, `result`, and `error` fields
#[napi]
pub async fn stream_nameserver(queries: Vec<String>) -> napi::Result<Vec<serde_json::Value>> {
    let client = get_client()?;
    let stream = client.stream_nameserver(queries, StreamConfig::default());
    let events: Vec<NameserverEvent> = stream.collect().await;
    let output = events
        .into_iter()
        .map(|event| match event {
            NameserverEvent::Result(r) => serde_json::json!({
                "query": r.query.clone(),
                "result": serde_json::to_value(*r).unwrap_or(serde_json::Value::Null),
                "error": null,
            }),
            NameserverEvent::Error { query, error } => serde_json::json!({
                "query": query,
                "result": null,
                "error": error.to_string(),
            }),
        })
        .collect();
    Ok(output)
}
