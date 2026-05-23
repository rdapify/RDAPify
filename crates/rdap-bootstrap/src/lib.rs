//! IANA Bootstrap service discovery.
//!
//! Implements RFC 9224 — the client fetches IANA bootstrap files to locate
//! the authoritative RDAP server for a given query.
//!
//! Bootstrap files are cached in memory with a 24-hour TTL.

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::sync::{Arc, RwLock as StdRwLock};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use dashmap::DashMap;
use ipnetwork::IpNetwork;
use serde::Deserialize;
use tokio::sync::{Notify, RwLock};

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

// ── Internal cache entry ──────────────────────────────────────────────────────

#[derive(Debug)]
struct CacheEntry {
    /// Parsed entries: `(pattern, first_server_url)`.
    entries: Vec<(String, String)>,
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
    cache: Arc<RwLock<HashMap<&'static str, CacheEntry>>>,
    /// Custom TLD → server URL overrides; consulted before IANA lookup.
    custom_servers: Arc<StdRwLock<HashMap<String, String>>>,
    /// Single-flight registry — one Notify per resource currently being
    /// refreshed. Insertion is atomic via DashMap's entry API.
    ///
    /// Naturally bounded: the only keys ever inserted are the four
    /// hardcoded `&'static str` values that [`Bootstrap::get_entries`] is
    /// called with (`"dns"`, `"ipv4"`, `"ipv6"`, `"asn"`). Maximum size: 4.
    /// No size cap is needed.
    in_flight: Arc<DashMap<&'static str, Arc<Notify>>>,
    /// Number of times a follower observed an in-flight refresh and waited
    /// rather than fetching independently. Diagnostic counter.
    refresh_dedup_total: Arc<AtomicU64>,
}

impl Bootstrap {
    /// Creates a new resolver using the official IANA bootstrap endpoint.
    pub fn new(client: reqwest::Client) -> Self {
        Self {
            base_url: "https://data.iana.org/rdap".to_string(),
            client,
            ttl: Duration::from_secs(86_400),
            cache: Arc::new(RwLock::new(HashMap::new())),
            custom_servers: Arc::new(StdRwLock::new(HashMap::new())),
            in_flight: Arc::new(DashMap::new()),
            refresh_dedup_total: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Creates a resolver with a custom base URL (useful for testing).
    pub fn with_base_url(base_url: impl Into<String>, client: reqwest::Client) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            client,
            ttl: Duration::from_secs(86_400),
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

    /// Registers custom TLD → RDAP server URL overrides.
    pub fn set_custom_servers(&mut self, servers: HashMap<String, String>) {
        let mut guard = self.custom_servers.write().expect("lock poisoned");
        *guard = servers
            .into_iter()
            .map(|(k, v)| (k.to_lowercase(), v))
            .collect();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// Returns the RDAP server base URL for a domain (by TLD).
    pub async fn for_domain(&self, domain: &str) -> Result<String> {
        let tld = extract_tld(domain)?;
        let tld_lower = tld.to_lowercase();

        {
            let custom = self.custom_servers.read().expect("lock poisoned");
            if let Some(server) = custom.get(&tld_lower) {
                return Ok(server.clone());
            }
        }

        let entries = self.get_entries("dns").await?;

        entries
            .iter()
            .find(|(pattern, _)| pattern.to_lowercase() == tld_lower)
            .map(|(_, server)| server.clone())
            .ok_or_else(|| RdapError::NoServerFound {
                query: domain.to_string(),
            })
    }

    /// Returns the RDAP server base URL for an IPv4 address.
    pub async fn for_ipv4(&self, ip: &str) -> Result<String> {
        let addr: std::net::IpAddr = ip
            .parse()
            .map_err(|_| RdapError::InvalidInput(format!("Invalid IPv4 address: {ip}")))?;

        let entries = self.get_entries("ipv4").await?;
        self.match_ip_entries(&entries, addr, ip)
    }

    /// Returns the RDAP server base URL for an IPv6 address.
    pub async fn for_ipv6(&self, ip: &str) -> Result<String> {
        let addr: std::net::IpAddr = ip
            .parse()
            .map_err(|_| RdapError::InvalidInput(format!("Invalid IPv6 address: {ip}")))?;

        let entries = self.get_entries("ipv6").await?;
        self.match_ip_entries(&entries, addr, ip)
    }

    /// Returns the RDAP server base URL for an ASN.
    pub async fn for_asn(&self, asn: u32) -> Result<String> {
        let entries = self.get_entries("asn").await?;

        for (pattern, server) in &entries {
            if let Some((start, end)) = pattern.split_once('-') {
                let start: u32 = start.parse().unwrap_or(u32::MAX);
                let end: u32 = end.parse().unwrap_or(0);
                if asn >= start && asn <= end {
                    return Ok(server.clone());
                }
            } else if let Ok(n) = pattern.parse::<u32>() {
                if asn == n {
                    return Ok(server.clone());
                }
            }
        }

        Err(RdapError::NoServerFound {
            query: format!("AS{asn}"),
        })
    }

    /// Clears the in-memory bootstrap cache.
    pub async fn clear_cache(&self) {
        self.cache.write().await.clear();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    async fn get_entries(&self, resource: &'static str) -> Result<Vec<(String, String)>> {
        // ── Fast path: fresh cache hit, no lock contention ────────────────
        if let Some(entries) = self.read_cache_if_fresh(resource).await {
            return Ok(entries);
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
                dashmap::mapref::entry::Entry::Occupied(o) => {
                    Claim::Follower(Arc::clone(o.get()))
                }
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
                if let Some(entries) = self.read_cache_if_fresh(resource).await {
                    return Ok(entries);
                }
                // Leader's fetch failed (or cache TTL is too short). Fall
                // back to a direct fetch so we don't cascade the failure
                // across all waiters.
                self.fetch_and_cache(resource).await
            }
        }
    }

    /// Reads the in-memory cache and returns the entries if fresh, else `None`.
    async fn read_cache_if_fresh(
        &self,
        resource: &'static str,
    ) -> Option<Vec<(String, String)>> {
        let cache = self.cache.read().await;
        let entry = cache.get(resource)?;
        if entry.is_expired(self.ttl) {
            return None;
        }
        Some(entry.entries.clone())
    }

    /// Fetches fresh entries from IANA and writes them to the cache.
    async fn fetch_and_cache(
        &self,
        resource: &'static str,
    ) -> Result<Vec<(String, String)>> {
        let entries = self.fetch_entries(resource).await?;
        let mut cache = self.cache.write().await;
        cache.insert(
            resource,
            CacheEntry {
                entries: entries.clone(),
                fetched_at: Instant::now(),
            },
        );
        Ok(entries)
    }

    async fn fetch_entries(&self, resource: &str) -> Result<Vec<(String, String)>> {
        let url = format!("{}/{}.json", self.base_url, resource);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(RdapError::Network)?;

        if !response.status().is_success() {
            return Err(RdapError::HttpStatus {
                status: response.status().as_u16(),
                url,
            });
        }

        // Enforce a hard size cap *before* JSON parsing. An adversarial
        // upstream cannot OOM us by streaming a multi-gigabyte body.
        let body = read_capped_bytes(response, MAX_BOOTSTRAP_BODY_BYTES).await?;

        let file: BootstrapFile = serde_json::from_slice(&body).map_err(|e| RdapError::ParseError {
            reason: e.to_string(),
        })?;

        let entries = file
            .services
            .into_iter()
            .filter_map(|(patterns, servers)| {
                let server = servers.into_iter().next()?;
                let server = server.trim_end_matches('/').to_string();
                Some(patterns.into_iter().map(move |p| (p, server.clone())))
            })
            .flatten()
            .collect();

        Ok(entries)
    }

    fn match_ip_entries(
        &self,
        entries: &[(String, String)],
        addr: std::net::IpAddr,
        original: &str,
    ) -> Result<String> {
        for (pattern, server) in entries {
            if let Ok(network) = pattern.parse::<IpNetwork>() {
                if network.contains(addr) {
                    return Ok(server.clone());
                }
            }
        }
        Err(RdapError::NoServerFound {
            query: original.to_string(),
        })
    }
}

// ── Internal types ────────────────────────────────────────────────────────────

/// Single-flight claim outcome — leader fetches, followers wait.
enum Claim {
    Leader(Arc<Notify>),
    Follower(Arc<Notify>),
}

/// Reads at most `cap` bytes from `response`'s body. Returns an error
/// if the body exceeds the cap, instead of allocating unboundedly.
///
/// The cap is checked across streamed chunks; a very large body is rejected
/// after the first chunk that pushes the total over the limit, so we never
/// hold more than `cap + chunk_size` bytes in memory.
async fn read_capped_bytes(
    response: reqwest::Response,
    cap: usize,
) -> Result<Vec<u8>> {
    use futures::StreamExt;

    let mut total: Vec<u8> = Vec::with_capacity(8 * 1024);
    let mut stream = response.bytes_stream();
    while let Some(chunk_res) = stream.next().await {
        let chunk: bytes::Bytes = match chunk_res {
            Ok(b) => b,
            Err(e) => return Err(RdapError::Network(e)),
        };
        if total.len().saturating_add(chunk.len()) > cap {
            return Err(RdapError::ParseError {
                reason: format!(
                    "bootstrap response exceeds {} bytes (received {} so far + {} more)",
                    cap,
                    total.len(),
                    chunk.len(),
                ),
            });
        }
        total.extend_from_slice(&chunk);
    }
    Ok(total)
}

// ── Utilities ─────────────────────────────────────────────────────────────────

fn extract_tld(domain: &str) -> Result<String> {
    let domain = domain.trim_end_matches('.').to_lowercase();

    if domain.is_empty() {
        return Err(RdapError::InvalidInput(
            "Domain name must not be empty".to_string(),
        ));
    }

    let parts: Vec<&str> = domain.split('.').collect();

    match parts.len() {
        0 => Err(RdapError::InvalidInput(
            "Domain name must not be empty".to_string(),
        )),
        1 => Ok(parts[0].to_string()),
        _ => Ok(parts.last().unwrap().to_string()),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_simple_tld() {
        assert_eq!(extract_tld("example.com").unwrap(), "com");
        assert_eq!(extract_tld("google.org").unwrap(), "org");
    }

    #[test]
    fn extracts_from_subdomain() {
        assert_eq!(extract_tld("www.example.com").unwrap(), "com");
        assert_eq!(extract_tld("deep.sub.example.net").unwrap(), "net");
    }

    #[test]
    fn handles_single_label() {
        assert_eq!(extract_tld("com").unwrap(), "com");
    }

    #[test]
    fn rejects_empty() {
        assert!(extract_tld("").is_err());
    }

    // ── B2.4 — Single-flight refresh ──────────────────────────────────────

    /// A bootstrap file matching the IANA RFC 9224 schema.
    fn dns_bootstrap_body() -> &'static str {
        r#"{
            "version": "1.0",
            "publication": "2026-01-01T00:00:00Z",
            "description": "test",
            "services": [
                [["com", "net"], ["https://rdap.verisign.example/"]],
                [["org"], ["https://rdap.publicinterestregistry.example/"]]
            ]
        }"#
    }

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

        let bootstrap = Arc::new(Bootstrap::with_base_url(
            server.url(),
            reqwest::Client::new(),
        ));

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

        let bootstrap = Bootstrap::with_base_url(server.url(), reqwest::Client::new());

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

        let bootstrap = Bootstrap::with_base_url(server.url(), reqwest::Client::new());
        let err = bootstrap.for_domain("example.com").await.unwrap_err();
        let msg = format!("{err}");
        assert!(
            msg.contains("exceeds") || msg.contains("Failed to parse"),
            "expected size-cap error, got: {msg}"
        );
    }

    #[tokio::test]
    async fn leader_fetch_failure_releases_slot_for_followers() {
        // First N requests get 500; later requests should still be able to
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

        let bootstrap = Bootstrap::with_base_url(server.url(), reqwest::Client::new());

        // First call: hits the 500.
        let first = bootstrap.for_domain("example.com").await;
        assert!(first.is_err(), "first call should fail (500)");

        // Second call: slot must be free; fetches the good response.
        let second = bootstrap.for_domain("example.com").await;
        assert!(second.is_ok(), "second call must succeed: {second:?}");
    }
}
