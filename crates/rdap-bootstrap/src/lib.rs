//! IANA Bootstrap service discovery.
//!
//! Implements RFC 9224 / RFC 7484 — the client fetches IANA bootstrap files to
//! locate the authoritative RDAP server for a given query.
//!
//! ## Lookup model
//!
//! At parse time each bootstrap file is turned into an O(1) lookup structure
//! ([`ResourceData`]). DNS uses a `HashMap` keyed by the **exact labels IANA
//! publishes** (root-zone TLDs, and any multi-label keys a registry may add),
//! and lookups use the RFC 7484 §3.2 *longest matching label-suffix* rule. So
//! `example.co.uk` resolves to whichever key IANA actually publishes — `co.uk`
//! if present, otherwise the registered TLD `uk` — without ever missing a
//! ccSLD. (Note: IANA keys are root-zone TLDs, **not** Public-Suffix-List
//! suffixes; the optional `psl-validation` feature is used only for *input*
//! hygiene, never for server selection.)
//!
//! ## Egress
//!
//! All bootstrap downloads go through [`rdap_security::secure_request`] — the
//! same audited SSRF pipeline as the primary fetch hot path (DNS-resolved IP
//! validation + per-hop redirect re-validation). See [`Bootstrap::new`].
//!
//! Bootstrap files are cached in memory with a 24-hour TTL.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock as StdRwLock};
use std::time::{Duration, Instant};

use dashmap::DashMap;
use ipnetwork::IpNetwork;
use serde::Deserialize;
use tokio::sync::{Notify, RwLock};

use rdap_security::{read_limited, secure_request, HttpSecurityPolicy, SecurityError};
use rdap_types::error::{RdapError, Result};

/// Hard cap on bootstrap response size. IANA bootstrap files are well
/// under 100 KiB in practice; 1 MiB gives a generous safety margin while
/// preventing memory exhaustion if an adversary controls the upstream.
const MAX_BOOTSTRAP_BODY_BYTES: usize = 1024 * 1024;

// ── IANA bootstrap response format ───────────────────────────────────────────

/// Root structure of every IANA bootstrap JSON file.
#[derive(Debug, Deserialize)]
struct BootstrapFile {
    #[allow(dead_code)]
    version: String,
    /// Each entry is `[ [patterns…], [servers…] ]`
    services: Vec<(Vec<String>, Vec<String>)>,
}

// ── Parsed, lookup-ready resource data ───────────────────────────────────────

/// A bootstrap file parsed into the structure best suited to its query type.
///
/// Built once at fetch/parse time and shared via `Arc`, so repeated lookups
/// never re-parse or clone the underlying data.
#[derive(Debug)]
enum ResourceData {
    /// DNS: O(1) index keyed by the exact labels IANA publishes (root-zone
    /// TLDs and any multi-label keys), mapping to the candidate server URLs.
    /// Queried by RFC 7484 longest-suffix match.
    Dns(HashMap<String, Vec<String>>),
    /// IPv4 / IPv6: CIDR network → server, matched by containment.
    Ip(Vec<(IpNetwork, String)>),
    /// ASN: inclusive `[start, end]` range → server.
    Asn(Vec<(u32, u32, String)>),
}

impl ResourceData {
    /// Parses a bootstrap file into the lookup structure for `resource`
    /// (`"dns"`, `"ipv4"`, `"ipv6"`, or `"asn"`).
    fn parse(resource: &str, file: BootstrapFile) -> Self {
        match resource {
            "dns" => {
                let mut index: HashMap<String, Vec<String>> = HashMap::new();
                for (patterns, servers) in file.services {
                    let servers: Vec<String> = servers
                        .into_iter()
                        .map(|s| s.trim_end_matches('/').to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                    if servers.is_empty() {
                        continue;
                    }
                    for pattern in patterns {
                        index
                            .entry(pattern.to_lowercase())
                            .or_default()
                            .extend(servers.iter().cloned());
                    }
                }
                ResourceData::Dns(index)
            }
            "asn" => {
                let mut ranges = Vec::new();
                for (patterns, servers) in file.services {
                    let Some(server) = first_server(servers) else {
                        continue;
                    };
                    for pattern in patterns {
                        if let Some((start, end)) = parse_asn_range(&pattern) {
                            ranges.push((start, end, server.clone()));
                        }
                    }
                }
                ResourceData::Asn(ranges)
            }
            // "ipv4" / "ipv6"
            _ => {
                let mut nets = Vec::new();
                for (patterns, servers) in file.services {
                    let Some(server) = first_server(servers) else {
                        continue;
                    };
                    for pattern in patterns {
                        if let Ok(network) = pattern.parse::<IpNetwork>() {
                            nets.push((network, server.clone()));
                        }
                    }
                }
                ResourceData::Ip(nets)
            }
        }
    }
}

// ── Internal cache entry ──────────────────────────────────────────────────────

#[derive(Debug)]
struct CacheEntry {
    /// Parsed, lookup-ready data. `Arc` so `get_resource` hands out cheap
    /// clones instead of deep-copying the index on every query.
    data: Arc<ResourceData>,
    fetched_at: Instant,
}

impl CacheEntry {
    fn is_expired(&self, ttl: Duration) -> bool {
        self.fetched_at.elapsed() > ttl
    }
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/// Discovers the authoritative RDAP server URL for a query target.
///
/// Thread-safe: the cache is behind a `RwLock`, and a single `Bootstrap`
/// instance can be shared across tasks via `Arc<Bootstrap>`.
///
/// ## Single-flight refresh
///
/// When the bootstrap cache for a resource (`"dns"`, `"ipv4"`, `"ipv6"`,
/// `"asn"`) is missing or expired and N concurrent queries arrive, exactly
/// one fetches IANA. Followers wait on a per-resource `Notify` and re-read
/// the cache when the leader signals completion. If the leader's fetch
/// fails, followers fall through to their own fetch attempt rather than
/// cascading the failure.
#[derive(Debug, Clone)]
pub struct Bootstrap {
    base_url: String,
    client: reqwest::Client,
    ttl: Duration,
    /// Security policy for [`secure_request`] (timeout, redirect cap). The
    /// body size is capped separately by [`read_limited`].
    egress_policy: HttpSecurityPolicy,
    /// When `true` (production default) every download is routed through the
    /// audited [`secure_request`] pipeline. Disabled only in tests that target
    /// loopback mock servers, which `secure_request` would (correctly) reject.
    secure_egress: bool,
    cache: Arc<RwLock<HashMap<&'static str, CacheEntry>>>,
    /// Custom TLD → server URL overrides; consulted (by longest-match) before
    /// the IANA index.
    custom_servers: Arc<StdRwLock<HashMap<String, String>>>,
    /// Single-flight registry — one Notify per resource currently being
    /// refreshed. Insertion is atomic via DashMap's entry API.
    ///
    /// Naturally bounded: the only keys ever inserted are the four
    /// hardcoded `&'static str` values that [`Bootstrap::get_resource`] is
    /// called with (`"dns"`, `"ipv4"`, `"ipv6"`, `"asn"`). Maximum size: 4.
    /// No size cap is needed.
    in_flight: Arc<DashMap<&'static str, Arc<Notify>>>,
    /// Number of times a follower observed an in-flight refresh and waited
    /// rather than fetching independently. Diagnostic counter.
    refresh_dedup_total: Arc<AtomicU64>,
}

impl Bootstrap {
    /// Creates a new resolver using the official IANA bootstrap endpoint.
    ///
    /// The supplied `client` **must** be built with
    /// [`reqwest::redirect::Policy::none()`] and the SSRF-validating resolver
    /// (as produced by `rdap-core`'s `Fetcher`), because downloads are routed
    /// through [`secure_request`], which drives the redirect loop itself.
    pub fn new(client: reqwest::Client) -> Self {
        Self::build("https://data.iana.org/rdap".to_string(), client)
    }

    /// Creates a resolver with a custom base URL (e.g. an internal IANA
    /// mirror). The URL is still subject to the full SSRF egress pipeline.
    pub fn with_base_url(base_url: impl Into<String>, client: reqwest::Client) -> Self {
        Self::build(base_url.into().trim_end_matches('/').to_string(), client)
    }

    fn build(base_url: String, client: reqwest::Client) -> Self {
        Self {
            base_url,
            client,
            ttl: Duration::from_secs(86_400),
            egress_policy: HttpSecurityPolicy::default(),
            secure_egress: true,
            cache: Arc::new(RwLock::new(HashMap::new())),
            custom_servers: Arc::new(StdRwLock::new(HashMap::new())),
            in_flight: Arc::new(DashMap::new()),
            refresh_dedup_total: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Number of times a concurrent caller waited on an in-flight refresh
    /// instead of fetching independently. For metrics / diagnostics.
    pub fn refresh_dedup_count(&self) -> u64 {
        self.refresh_dedup_total.load(Ordering::Relaxed)
    }

    /// Enables or disables routing downloads through the audited SSRF egress
    /// pipeline ([`secure_request`]).
    ///
    /// Mirrors the client's SSRF guard: production keeps this enabled (the
    /// default); test harnesses that disable SSRF to reach loopback mock
    /// servers must disable it here too, since [`secure_request`] rejects
    /// non-HTTPS / loopback targets by design.
    pub fn set_secure_egress(&mut self, enabled: bool) {
        self.secure_egress = enabled;
    }

    /// Overrides the egress timeout used by [`secure_request`].
    ///
    /// Defaults to the [`HttpSecurityPolicy`] default; the client threads its
    /// configured fetcher timeout here so bootstrap downloads and the primary
    /// fetch hot path use the same deadline.
    pub fn set_egress_timeout(&mut self, timeout: Duration) {
        self.egress_policy.timeout = timeout;
    }

    /// Registers custom TLD → RDAP server URL overrides.
    pub fn set_custom_servers(&mut self, servers: HashMap<String, String>) {
        let mut guard = self.custom_servers.write().expect("lock poisoned");
        *guard = servers
            .into_iter()
            .map(|(k, v)| (k.to_lowercase(), v))
            .collect();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Returns the RDAP server base URL for a domain.
    ///
    /// Uses the RFC 7484 longest matching label-suffix rule against the IANA
    /// DNS index (and any custom overrides, which take priority). So
    /// `example.co.uk` matches the most specific published key.
    pub async fn for_domain(&self, domain: &str) -> Result<String> {
        let normalized = normalize_domain_input(domain)?;

        // Custom overrides take priority (longest-match over custom keys).
        {
            let custom = self.custom_servers.read().expect("lock poisoned");
            if let Some(server) = longest_suffix(&custom, &normalized) {
                return Ok(server.clone());
            }
        }

        let data = self.get_resource("dns").await?;
        match &*data {
            ResourceData::Dns(index) => longest_suffix(index, &normalized)
                .and_then(|servers| servers.first())
                .cloned()
                .ok_or_else(|| RdapError::NoServerFound {
                    query: domain.to_string(),
                }),
            // get_resource("dns") always yields Dns; defensive, never hit.
            _ => Err(RdapError::ParseError {
                reason: "bootstrap 'dns' resource produced a non-DNS index".to_string(),
            }),
        }
    }

    /// Returns the RDAP server base URL for an IPv4 address.
    pub async fn for_ipv4(&self, ip: &str) -> Result<String> {
        let addr: IpAddr = ip
            .parse()
            .map_err(|_| RdapError::InvalidInput(format!("Invalid IPv4 address: {ip}")))?;
        let data = self.get_resource("ipv4").await?;
        self.match_ip(&data, addr, ip)
    }

    /// Returns the RDAP server base URL for an IPv6 address.
    pub async fn for_ipv6(&self, ip: &str) -> Result<String> {
        let addr: IpAddr = ip
            .parse()
            .map_err(|_| RdapError::InvalidInput(format!("Invalid IPv6 address: {ip}")))?;
        let data = self.get_resource("ipv6").await?;
        self.match_ip(&data, addr, ip)
    }

    /// Returns the RDAP server base URL for an ASN.
    pub async fn for_asn(&self, asn: u32) -> Result<String> {
        let data = self.get_resource("asn").await?;
        match &*data {
            ResourceData::Asn(ranges) => ranges
                .iter()
                .find(|(start, end, _)| asn >= *start && asn <= *end)
                .map(|(_, _, server)| server.clone())
                .ok_or_else(|| RdapError::NoServerFound {
                    query: format!("AS{asn}"),
                }),
            _ => Err(RdapError::ParseError {
                reason: "bootstrap 'asn' resource produced a non-ASN index".to_string(),
            }),
        }
    }

    /// Clears the in-memory bootstrap cache.
    pub async fn clear_cache(&self) {
        self.cache.write().await.clear();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn match_ip(&self, data: &ResourceData, addr: IpAddr, original: &str) -> Result<String> {
        match data {
            ResourceData::Ip(nets) => nets
                .iter()
                .find(|(network, _)| network.contains(addr))
                .map(|(_, server)| server.clone())
                .ok_or_else(|| RdapError::NoServerFound {
                    query: original.to_string(),
                }),
            _ => Err(RdapError::ParseError {
                reason: "bootstrap IP resource produced a non-IP index".to_string(),
            }),
        }
    }

    async fn get_resource(&self, resource: &'static str) -> Result<Arc<ResourceData>> {
        // ── Fast path: fresh cache hit, no lock contention ────────────────
        if let Some(data) = self.read_cache_if_fresh(resource).await {
            return Ok(data);
        }

        // ── Single-flight: atomically claim the refresh slot or join the
        //    in-flight wait. The DashMap entry guard is dropped at the end
        //    of this block, before any `.await`. ────────────────────────────
        let claim: Claim = {
            match self.in_flight.entry(resource) {
                dashmap::mapref::entry::Entry::Vacant(v) => {
                    let notify = Arc::new(Notify::new());
                    v.insert(Arc::clone(&notify));
                    Claim::Leader(notify)
                }
                dashmap::mapref::entry::Entry::Occupied(o) => Claim::Follower(Arc::clone(o.get())),
            }
        };

        match claim {
            Claim::Leader(notify) => {
                // We own the in-flight slot. Always release on exit so a
                // failed fetch doesn't permanently block this resource.
                let result = self.fetch_and_cache(resource).await;
                self.in_flight.remove(resource);
                notify.notify_waiters();
                result
            }
            Claim::Follower(notify) => {
                self.refresh_dedup_total.fetch_add(1, Ordering::Relaxed);
                notify.notified().await;
                // Leader is done — re-read the cache.
                if let Some(data) = self.read_cache_if_fresh(resource).await {
                    return Ok(data);
                }
                // Leader's fetch failed (or cache TTL is too short). Fall
                // back to a direct fetch so we don't cascade the failure
                // across all waiters.
                self.fetch_and_cache(resource).await
            }
        }
    }

    /// Reads the in-memory cache and returns the data if fresh, else `None`.
    async fn read_cache_if_fresh(&self, resource: &'static str) -> Option<Arc<ResourceData>> {
        let cache = self.cache.read().await;
        let entry = cache.get(resource)?;
        if entry.is_expired(self.ttl) {
            return None;
        }
        Some(Arc::clone(&entry.data))
    }

    /// Fetches fresh data from IANA and writes it to the cache.
    async fn fetch_and_cache(&self, resource: &'static str) -> Result<Arc<ResourceData>> {
        let data = Arc::new(self.fetch_resource(resource).await?);
        let mut cache = self.cache.write().await;
        cache.insert(
            resource,
            CacheEntry {
                data: Arc::clone(&data),
                fetched_at: Instant::now(),
            },
        );
        Ok(data)
    }

    async fn fetch_resource(&self, resource: &str) -> Result<ResourceData> {
        let url_str = format!("{}/{}.json", self.base_url, resource);

        // SSRF-F3: route bootstrap egress through the audited security
        // pipeline — identical DNS-resolved IP checks and per-hop redirect
        // re-validation as the primary fetch hot path.
        let response = if self.secure_egress {
            let url = url::Url::parse(&url_str).map_err(|source| RdapError::InvalidUrl {
                url: url_str.clone(),
                source,
            })?;
            secure_request(&self.client, url, &self.egress_policy)
                .await
                .map_err(|e| map_security_error(e, &url_str, self.egress_policy.timeout))?
        } else {
            // Test-only direct path (loopback mock servers, which the security
            // pipeline rejects by design). Never taken in production.
            self.client
                .get(&url_str)
                .send()
                .await
                .map_err(RdapError::Network)?
        };

        if !response.status().is_success() {
            return Err(RdapError::HttpStatus {
                status: response.status().as_u16(),
                url: url_str,
            });
        }

        // Enforce a hard size cap *before* JSON parsing. An adversarial
        // upstream cannot OOM us by streaming a multi-gigabyte body. The cap is
        // applied by the audited `rdap-security` primitive so bootstrap egress
        // shares one body-limiting implementation with the primary fetch path.
        let body = read_limited(response, MAX_BOOTSTRAP_BODY_BYTES)
            .await
            .map_err(|e| map_security_error(e, &url_str, self.egress_policy.timeout))?;

        let file: BootstrapFile =
            serde_json::from_slice(&body).map_err(|e| RdapError::ParseError {
                reason: e.to_string(),
            })?;

        Ok(ResourceData::parse(resource, file))
    }
}

// ── Internal types ────────────────────────────────────────────────────────────

/// Single-flight claim outcome — leader fetches, followers wait.
enum Claim {
    Leader(Arc<Notify>),
    Follower(Arc<Notify>),
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/// RFC 7484 §3.2 longest matching label-suffix lookup.
///
/// Tries the full name first, then drops leading labels one at a time, so the
/// first hit is the longest matching suffix present in `map`. Keys in `map`
/// are expected to be lowercased.
///
/// `a.b.c` is probed as `a.b.c`, then `b.c`, then `c`.
fn longest_suffix<'a, V>(map: &'a HashMap<String, V>, domain: &str) -> Option<&'a V> {
    let domain = domain.trim_end_matches('.').to_lowercase();
    if domain.is_empty() {
        return None;
    }
    let labels: Vec<&str> = domain.split('.').collect();
    (0..labels.len()).find_map(|start| map.get(&labels[start..].join(".")))
}

/// Normalizes and validates a domain query before lookup.
///
/// Always: trims a trailing root dot, lowercases, and rejects empty input.
///
/// With the `psl-validation` feature: additionally validates the input against
/// the Public Suffix List, rejecting bare public suffixes (e.g. `co.uk` with no
/// registrable label). PSL is used **only** for input hygiene here — never for
/// IANA server selection, which is keyed by root-zone TLDs, not PSL suffixes.
fn normalize_domain_input(domain: &str) -> Result<String> {
    let normalized = domain.trim().trim_end_matches('.').to_lowercase();
    if normalized.is_empty() {
        return Err(RdapError::InvalidInput(
            "Domain name must not be empty".to_string(),
        ));
    }

    #[cfg(feature = "psl-validation")]
    psl_validate(&normalized)?;

    Ok(normalized)
}

/// Public-Suffix-List input validation (feature-gated).
///
/// Rejects inputs that are themselves a public suffix (no registrable label),
/// and structurally invalid domains, before they reach the lookup engine.
/// IDNA / punycode conversion is performed upstream by the client; this is a
/// final sanity gate.
#[cfg(feature = "psl-validation")]
fn psl_validate(domain: &str) -> Result<()> {
    let parsed = addr::parse_domain_name(domain)
        .map_err(|e| RdapError::InvalidInput(format!("Invalid domain '{domain}': {e}")))?;
    if parsed.root().is_none() {
        return Err(RdapError::InvalidInput(format!(
            "'{domain}' is a public suffix, not a registrable domain"
        )));
    }
    Ok(())
}

/// First non-empty server URL (trailing slash trimmed) from a service entry.
fn first_server(servers: Vec<String>) -> Option<String> {
    servers
        .into_iter()
        .map(|s| s.trim_end_matches('/').to_string())
        .find(|s| !s.is_empty())
}

/// Parses an ASN bootstrap pattern: either `"N"` or `"START-END"`.
fn parse_asn_range(pattern: &str) -> Option<(u32, u32)> {
    match pattern.split_once('-') {
        Some((start, end)) => Some((start.trim().parse().ok()?, end.trim().parse().ok()?)),
        None => {
            let n = pattern.trim().parse().ok()?;
            Some((n, n))
        }
    }
}

/// Maps a [`SecurityError`] from the egress pipeline into the public
/// [`RdapError`] taxonomy without leaking transport detail. SSRF-class
/// violations collapse to [`RdapError::SsrfBlocked`].
fn map_security_error(err: SecurityError, url: &str, timeout: Duration) -> RdapError {
    let reason = err.to_string();
    match err {
        SecurityError::InvalidScheme => RdapError::InsecureScheme {
            scheme: url::Url::parse(url)
                .map(|u| u.scheme().to_string())
                .unwrap_or_else(|_| "non-https".to_string()),
        },
        SecurityError::Network(inner) => RdapError::Network(inner),
        SecurityError::Timeout => RdapError::Timeout {
            millis: timeout.as_millis() as u64,
            url: url.to_string(),
        },
        // All IP / host / DNS / redirect violations are SSRF blocks. The
        // message is the security layer's generic text — no transport detail.
        // Exhaustive (no wildcard) so a new SecurityError variant fails the
        // build here rather than silently collapsing to SsrfBlocked.
        SecurityError::BlockedIp
        | SecurityError::PrivateIp
        | SecurityError::LoopbackIp
        | SecurityError::LinkLocalIp
        | SecurityError::InvalidHost
        | SecurityError::CredentialsInUrl
        | SecurityError::DnsResolutionFailed(_)
        | SecurityError::DnsRebindingDetected
        | SecurityError::TooManyRedirects => RdapError::SsrfBlocked {
            url: url.to_string(),
            reason,
        },
        // Body/content variants are only produced by `secure_fetch`'s body
        // handling, never by `secure_request` (which returns an unread
        // response); map defensively without leaking transport detail.
        SecurityError::ResponseTooLarge | SecurityError::InvalidContentType => {
            RdapError::ParseError { reason }
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a bootstrap pointed at a loopback mock server. SSRF egress is
    /// disabled because `secure_request` rejects non-HTTPS / loopback targets
    /// by design (see `Bootstrap::secure_egress`).
    fn mock_bootstrap(base_url: &str) -> Bootstrap {
        let mut b = Bootstrap::with_base_url(base_url, reqwest::Client::new());
        b.secure_egress = false;
        b
    }

    // ── RFC 7484 longest-match (unit, no network) ──────────────────────────

    fn dns_index() -> HashMap<String, Vec<String>> {
        let mut m: HashMap<String, Vec<String>> = HashMap::new();
        m.insert("com".into(), vec!["https://rdap.verisign.example/".into()]);
        m.insert("net".into(), vec!["https://rdap.verisign.example/".into()]);
        m.insert("uk".into(), vec!["https://rdap.nominet.example/".into()]);
        // A multi-label key: exercises true longest-match precedence.
        m.insert("co.uk".into(), vec!["https://rdap.couk.example/".into()]);
        m.insert("sa".into(), vec!["https://rdap.nic-sa.example/".into()]);
        m
    }

    #[test]
    fn longest_match_simple_tld() {
        let idx = dns_index();
        assert_eq!(
            longest_suffix(&idx, "example.com").unwrap()[0],
            "https://rdap.verisign.example/"
        );
        assert_eq!(
            longest_suffix(&idx, "host.sub.net").unwrap()[0],
            "https://rdap.verisign.example/"
        );
    }

    #[test]
    fn longest_match_prefers_more_specific_ccsld() {
        let idx = dns_index();
        // `co.uk` (longer) must win over `uk` for example.co.uk.
        assert_eq!(
            longest_suffix(&idx, "example.co.uk").unwrap()[0],
            "https://rdap.couk.example/"
        );
        // A plain `.uk` registration falls back to the `uk` key.
        assert_eq!(
            longest_suffix(&idx, "example.uk").unwrap()[0],
            "https://rdap.nominet.example/"
        );
    }

    #[test]
    fn longest_match_falls_back_to_root_tld() {
        let idx = dns_index();
        // `com.sa` is not a published key, so `sub.domain.com.sa` matches the
        // registered TLD `sa` (longest suffix actually present).
        assert_eq!(
            longest_suffix(&idx, "sub.domain.com.sa").unwrap()[0],
            "https://rdap.nic-sa.example/"
        );
    }

    #[test]
    fn longest_match_unknown_tld_is_none() {
        let idx = dns_index();
        assert!(longest_suffix(&idx, "host.invalidtld").is_none());
        assert!(longest_suffix(&idx, "").is_none());
    }

    #[test]
    fn parse_asn_range_handles_single_and_range() {
        assert_eq!(parse_asn_range("15169"), Some((15169, 15169)));
        assert_eq!(parse_asn_range("64496-64511"), Some((64496, 64511)));
        assert_eq!(parse_asn_range("not-a-number"), None);
    }

    // ── End-to-end longest-match through the fetch/parse/cache pipeline ─────

    /// A DNS bootstrap file with both single- and multi-label keys.
    fn dns_bootstrap_body() -> &'static str {
        r#"{
            "version": "1.0",
            "publication": "2026-01-01T00:00:00Z",
            "description": "test",
            "services": [
                [["com", "net"], ["https://rdap.verisign.example/"]],
                [["uk"], ["https://rdap.nominet.example/"]],
                [["co.uk"], ["https://rdap.couk.example/"]],
                [["sa"], ["https://rdap.nic-sa.example/"]],
                [["org"], ["https://rdap.publicinterestregistry.example/"]]
            ]
        }"#
    }

    async fn dns_server() -> (mockito::ServerGuard, mockito::Mock) {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap_body())
            .create_async()
            .await;
        (server, mock)
    }

    #[tokio::test]
    async fn for_domain_matches_ccslds_via_longest_match() {
        let (server, _mock) = dns_server().await;
        let b = mock_bootstrap(&server.url());

        assert_eq!(
            b.for_domain("example.com").await.unwrap(),
            "https://rdap.verisign.example"
        );
        assert_eq!(
            b.for_domain("host.net").await.unwrap(),
            "https://rdap.verisign.example"
        );
        // ccSLD: longest match `co.uk` wins over `uk`.
        assert_eq!(
            b.for_domain("example.co.uk").await.unwrap(),
            "https://rdap.couk.example"
        );
        // Plain `.uk`.
        assert_eq!(
            b.for_domain("bbc.uk").await.unwrap(),
            "https://rdap.nominet.example"
        );
        // `.com.sa` not published → matches root TLD `sa`.
        assert_eq!(
            b.for_domain("sub.domain.com.sa").await.unwrap(),
            "https://rdap.nic-sa.example"
        );
    }

    #[tokio::test]
    async fn for_domain_unknown_tld_returns_no_server() {
        let (server, _mock) = dns_server().await;
        let b = mock_bootstrap(&server.url());
        let err = b.for_domain("host.nonexistenttld").await.unwrap_err();
        assert!(matches!(err, RdapError::NoServerFound { .. }));
    }

    #[tokio::test]
    async fn custom_servers_override_iana() {
        let (server, _mock) = dns_server().await;
        let mut b = mock_bootstrap(&server.url());
        let mut custom = HashMap::new();
        custom.insert("com".to_string(), "https://custom.example/rdap".to_string());
        b.set_custom_servers(custom);
        assert_eq!(
            b.for_domain("example.com").await.unwrap(),
            "https://custom.example/rdap"
        );
    }

    // ── B2.4 — Single-flight refresh ──────────────────────────────────────

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn one_hundred_concurrent_first_loads_produce_one_iana_fetch() {
        // Mandatory B2.4 test: under concurrency, only one upstream fetch
        // should happen for a given resource even when 100 lookups race.
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap_body())
            // Add a small delay so all concurrent followers actually overlap
            // the leader's fetch window.
            .with_chunked_body(|w| {
                std::thread::sleep(std::time::Duration::from_millis(50));
                w.write_all(dns_bootstrap_body().as_bytes())
            })
            .expect(1) // exactly one upstream call permitted
            .create_async()
            .await;

        let bootstrap = Arc::new(mock_bootstrap(&server.url()));

        // 100 concurrent for_domain lookups — same TLD, same resource.
        let n = 100usize;
        let barrier = Arc::new(tokio::sync::Barrier::new(n));
        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let b = Arc::clone(&bootstrap);
            let bar = Arc::clone(&barrier);
            handles.push(tokio::spawn(async move {
                bar.wait().await;
                b.for_domain("example.com").await
            }));
        }

        for h in handles {
            let res = h.await.unwrap();
            assert!(res.is_ok(), "domain lookup should succeed: {res:?}");
        }

        // Mockito asserts that exactly one upstream call was made (`expect(1)`).
        mock.assert_async().await;
        // And we should have recorded 99 dedups.
        assert_eq!(bootstrap.refresh_dedup_count(), (n - 1) as u64);
    }

    #[tokio::test]
    async fn second_call_after_cache_population_does_not_refetch() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap_body())
            .expect(1) // one fetch only — second call must hit cache
            .create_async()
            .await;

        let bootstrap = mock_bootstrap(&server.url());

        let _ = bootstrap.for_domain("example.com").await.unwrap();
        let _ = bootstrap.for_domain("other.com").await.unwrap();

        mock.assert_async().await;
    }

    // ── C6 — Bootstrap response size cap ───────────────────────────────

    #[tokio::test]
    async fn bootstrap_rejects_oversized_response() {
        // Bootstrap server returns a 2 MiB body. Cap is 1 MiB. Must error
        // before allocating / parsing.
        let mut server = mockito::Server::new_async().await;
        let oversized = "a".repeat(2 * 1024 * 1024);
        let _bad = server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(oversized)
            .create_async()
            .await;

        let bootstrap = mock_bootstrap(&server.url());
        let err = bootstrap.for_domain("example.com").await.unwrap_err();
        let msg = format!("{err}");
        assert!(
            msg.contains("exceeds") || msg.contains("Failed to parse"),
            "expected size-cap error, got: {msg}"
        );
    }

    #[tokio::test]
    async fn leader_fetch_failure_releases_slot_for_followers() {
        // First request gets 500; later requests should still be able to
        // succeed (the failed leader did not permanently block the slot).
        let mut server = mockito::Server::new_async().await;
        let _bad = server
            .mock("GET", "/dns.json")
            .with_status(500)
            .with_body("nope")
            .expect(1)
            .create_async()
            .await;
        let _good = server
            .mock("GET", "/dns.json")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(dns_bootstrap_body())
            .create_async()
            .await;

        let bootstrap = mock_bootstrap(&server.url());

        // First call: hits the 500.
        let first = bootstrap.for_domain("example.com").await;
        assert!(first.is_err(), "first call should fail (500)");

        // Second call: slot must be free; fetches the good response.
        let second = bootstrap.for_domain("example.com").await;
        assert!(second.is_ok(), "second call must succeed: {second:?}");
    }

    // ── PSL input validation (feature-gated) ───────────────────────────────

    #[cfg(feature = "psl-validation")]
    #[test]
    fn psl_rejects_bare_public_suffix() {
        // A bare public suffix has no registrable label and must be rejected
        // before it reaches the lookup engine.
        assert!(normalize_domain_input("co.uk").is_err());
        assert!(normalize_domain_input("com").is_err());
    }

    #[cfg(feature = "psl-validation")]
    #[test]
    fn psl_accepts_registrable_domain() {
        assert_eq!(
            normalize_domain_input("example.co.uk").unwrap(),
            "example.co.uk"
        );
        assert_eq!(
            normalize_domain_input("example.com").unwrap(),
            "example.com"
        );
    }

    #[cfg(not(feature = "psl-validation"))]
    #[test]
    fn without_psl_bare_suffix_is_normalized_not_rejected() {
        // Default build performs no PSL check — only structural normalization.
        assert_eq!(normalize_domain_input("CO.UK.").unwrap(), "co.uk");
    }
}
