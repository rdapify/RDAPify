//! SSRF (Server-Side Request Forgery) protection for RDAP clients.
//!
//! Every outbound URL is validated before the HTTP request is issued.
//! The guard blocks:
//!
//! - Non-HTTPS schemes
//! - IPv4 loopback (127/8), private (RFC 1918), link-local (169.254/16)
//! - IPv6 loopback (::1), link-local (fe80::/10), unique-local (fc00::/7)
//! - Explicitly blocked domain patterns
//!
//! Allowed domains (allowlist) take priority over all other checks.

#![forbid(unsafe_code)]

use std::net::{Ipv4Addr, Ipv6Addr};

use url::{Host, Url};

use rdap_types::error::{RdapError, Result};

// ── Configuration ─────────────────────────────────────────────────────────────

/// Configuration for the SSRF guard.
#[derive(Debug, Clone)]
pub struct SsrfConfig {
    /// When `false` all checks are skipped (for testing only — never in production).
    pub enabled: bool,
    /// Additional domain suffixes to block (e.g., "internal.corp").
    pub blocked_domains: Vec<String>,
    /// If non-empty, only these domain suffixes are allowed.
    /// Takes priority over `blocked_domains` and IP checks.
    pub allowed_domains: Vec<String>,
}

impl Default for SsrfConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            blocked_domains: Vec::new(),
            allowed_domains: Vec::new(),
        }
    }
}

// ── Guard ─────────────────────────────────────────────────────────────────────

/// SSRF guard — validates a URL before any network call.
#[derive(Debug, Clone)]
pub struct SsrfGuard {
    config: SsrfConfig,
}

impl SsrfGuard {
    /// Creates a new guard with the default (most restrictive) configuration.
    pub fn new() -> Self {
        Self::with_config(SsrfConfig::default())
    }

    /// Creates a guard with a custom configuration.
    pub fn with_config(config: SsrfConfig) -> Self {
        Self { config }
    }

    /// Validates a URL string.
    ///
    /// Returns `Ok(())` if the URL is safe to fetch, or a [`RdapError`]
    /// explaining why it was blocked.
    pub fn validate(&self, raw_url: &str) -> Result<()> {
        if !self.config.enabled {
            return Ok(());
        }

        // ── Parse URL ────────────────────────────────────────────────────────
        let url = Url::parse(raw_url).map_err(|e| RdapError::InvalidUrl {
            url: raw_url.to_string(),
            source: e,
        })?;

        // ── Enforce HTTPS ────────────────────────────────────────────────────
        if url.scheme() != "https" {
            return Err(RdapError::InsecureScheme {
                scheme: url.scheme().to_string(),
            });
        }

        // ── Allowlist (highest priority) ─────────────────────────────────────
        if !self.config.allowed_domains.is_empty() {
            let host_str = url
                .host_str()
                .ok_or_else(|| RdapError::InvalidInput(format!("URL has no host: {raw_url}")))?;

            let allowed = self.config.allowed_domains.iter().any(|d| {
                let d = d.to_lowercase();
                let h = host_str.to_lowercase();
                h == d || h.ends_with(&format!(".{d}"))
            });

            if !allowed {
                return Err(RdapError::SsrfBlocked {
                    url: raw_url.to_string(),
                    reason: format!("host '{host_str}' is not in the allowed-domains list"),
                });
            }

            // Allowlisted — skip all further checks.
            return Ok(());
        }

        // ── Use typed host to avoid string re-parsing ─────────────────────────
        match url.host() {
            None => {
                return Err(RdapError::InvalidInput(format!(
                    "URL has no host: {raw_url}"
                )))
            }

            Some(Host::Domain(domain)) => {
                // ── Domain blocklist check ────────────────────────────────────
                for blocked in &self.config.blocked_domains {
                    let b = blocked.to_lowercase();
                    let d = domain.to_lowercase();
                    if d == b || d.ends_with(&format!(".{b}")) {
                        return Err(RdapError::SsrfBlocked {
                            url: raw_url.to_string(),
                            reason: format!("domain '{domain}' is in the blocked-domains list"),
                        });
                    }
                }
                // Plain domain names are otherwise allowed.
            }

            Some(Host::Ipv4(v4)) => {
                self.check_ipv4(v4, raw_url)?;
            }

            Some(Host::Ipv6(v6)) => {
                self.check_ipv6(v6, raw_url)?;
            }
        }

        Ok(())
    }

    // ── Private IP checkers ───────────────────────────────────────────────────

    fn check_ipv4(&self, ip: Ipv4Addr, raw_url: &str) -> Result<()> {
        let reason = if ip.is_loopback() {
            Some("IPv4 loopback address (127/8)")
        } else if ip.is_private() {
            Some("private IPv4 address (RFC 1918)")
        } else if ip.is_link_local() {
            Some("IPv4 link-local address (169.254/16)")
        } else if ip.is_broadcast() {
            Some("IPv4 broadcast address")
        } else if ip.is_unspecified() {
            Some("unspecified IPv4 address (0.0.0.0/8)")
        } else {
            None
        };

        if let Some(r) = reason {
            return Err(RdapError::SsrfBlocked {
                url: raw_url.to_string(),
                reason: r.to_string(),
            });
        }
        Ok(())
    }

    fn check_ipv6(&self, ip: Ipv6Addr, raw_url: &str) -> Result<()> {
        let o = ip.octets();

        let reason = if ip.is_loopback() {
            // ::1/128
            Some("IPv6 loopback address (::1)")
        } else if o[0] == 0xfe && (o[1] & 0xc0) == 0x80 {
            // fe80::/10 — link-local
            Some("IPv6 link-local address (fe80::/10)")
        } else if (o[0] & 0xfe) == 0xfc {
            // fc00::/7 — unique-local (private)
            Some("IPv6 unique-local address (fc00::/7)")
        } else if ip.is_unspecified() {
            Some("unspecified IPv6 address (::/128)")
        } else {
            None
        };

        if let Some(r) = reason {
            return Err(RdapError::SsrfBlocked {
                url: raw_url.to_string(),
                reason: r.to_string(),
            });
        }
        Ok(())
    }
}

impl Default for SsrfGuard {
    fn default() -> Self {
        Self::new()
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_public_https() {
        let guard = SsrfGuard::new();
        assert!(guard.validate("https://rdap.verisign.com/com/v1/").is_ok());
        assert!(guard.validate("https://rdap.arin.net/registry/").is_ok());
    }

    #[test]
    fn blocks_http() {
        let guard = SsrfGuard::new();
        let err = guard.validate("http://rdap.verisign.com/").unwrap_err();
        assert!(matches!(err, RdapError::InsecureScheme { .. }));
    }

    #[test]
    fn blocks_localhost() {
        let guard = SsrfGuard::new();
        assert!(guard
            .validate("https://127.0.0.1/")
            .unwrap_err()
            .is_ssrf_blocked());
        assert!(guard
            .validate("https://[::1]/")
            .unwrap_err()
            .is_ssrf_blocked());
    }

    #[test]
    fn blocks_private_ranges() {
        let guard = SsrfGuard::new();
        assert!(guard
            .validate("https://10.0.0.1/")
            .unwrap_err()
            .is_ssrf_blocked());
        assert!(guard
            .validate("https://192.168.1.1/")
            .unwrap_err()
            .is_ssrf_blocked());
        assert!(guard
            .validate("https://172.16.0.1/")
            .unwrap_err()
            .is_ssrf_blocked());
    }

    #[test]
    fn blocks_link_local() {
        let guard = SsrfGuard::new();
        assert!(guard
            .validate("https://169.254.1.1/")
            .unwrap_err()
            .is_ssrf_blocked());
        assert!(guard
            .validate("https://[fe80::1]/")
            .unwrap_err()
            .is_ssrf_blocked());
    }

    #[test]
    fn allowlist_overrides_blocklist() {
        let guard = SsrfGuard::with_config(SsrfConfig {
            enabled: true,
            allowed_domains: vec!["rdap.verisign.com".into()],
            blocked_domains: vec!["rdap.verisign.com".into()],
        });
        assert!(guard.validate("https://rdap.verisign.com/com/v1/").is_ok());
    }

    #[test]
    fn allowlist_blocks_unlisted() {
        let guard = SsrfGuard::with_config(SsrfConfig {
            enabled: true,
            allowed_domains: vec!["rdap.verisign.com".into()],
            ..Default::default()
        });
        assert!(guard
            .validate("https://rdap.arin.net/registry/")
            .unwrap_err()
            .is_ssrf_blocked());
    }

    #[test]
    fn disabled_guard_allows_everything() {
        let guard = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        assert!(guard.validate("http://127.0.0.1/").is_ok());
    }
}
