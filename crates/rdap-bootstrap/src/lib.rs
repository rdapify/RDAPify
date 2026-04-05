//! IANA Bootstrap service discovery.
//!
//! Implements RFC 9224 — the client fetches IANA bootstrap files to locate
//! the authoritative RDAP server for a given query.
//!
//! Bootstrap files are cached in memory with a 24-hour TTL.

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::sync::{Arc, RwLock as StdRwLock};
use std::time::{Duration, Instant};

use ipnetwork::IpNetwork;
use serde::Deserialize;
use tokio::sync::RwLock;

use rdap_types::error::{RdapError, Result};

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
#[derive(Debug, Clone)]
pub struct Bootstrap {
    base_url: String,
    client: reqwest::Client,
    ttl: Duration,
    cache: Arc<RwLock<HashMap<&'static str, CacheEntry>>>,
    /// Custom TLD → server URL overrides; consulted before IANA lookup.
    custom_servers: Arc<StdRwLock<HashMap<String, String>>>,
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
        }
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
        {
            let cache = self.cache.read().await;
            if let Some(entry) = cache.get(resource) {
                if !entry.is_expired(self.ttl) {
                    return Ok(entry.entries.clone());
                }
            }
        }

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

        let file: BootstrapFile = response.json().await.map_err(|e| RdapError::ParseError {
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
    use super::extract_tld;

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
}
