//! Network security gateway for RDAPify.
//!
//! **All outbound HTTP requests in RDAPify must go through this crate.**
//! Direct use of `reqwest` (or any HTTP client) is not permitted in other
//! crates.
//!
//! # Layers of protection
//!
//! | Layer | Module | What it prevents |
//! |---|---|---|
//! | URL validation | [`url`] | Bad schemes, credentials, IP literals |
//! | DNS resolution | [`dns`] | SSRF via hostname → private IP |
//! | IP classification | [`ip`] | Loopback, private, link-local, unspecified |
//! | HTTP policy | [`http_policy`] | Timeout, redirect limit, response size |
//! | Redirect guard | [`redirect`] | SSRF / rebinding across redirect chain |
//! | Response limits | [`limits`] | Memory exhaustion from large bodies |
//! | Content-type | [`content_type`] | Non-RDAP responses masquerading as RDAP |
//!
//! # Quick start
//!
//! ```rust,no_run
//! use rdap_security::{secure_fetch, HttpSecurityPolicy};
//! use url::Url;
//!
//! # async fn example() -> Result<(), rdap_security::SecurityError> {
//! let client = reqwest::Client::builder()
//!     .redirect(reqwest::redirect::Policy::none())
//!     .build()
//!     .unwrap();
//!
//! let bytes = secure_fetch(
//!     &client,
//!     Url::parse("https://rdap.verisign.com/com/v1/domain/EXAMPLE.COM").unwrap(),
//!     &HttpSecurityPolicy::default(),
//! )
//! .await?;
//! # Ok(())
//! # }
//! ```
//!
//! # Backward-compatible SSRF guard
//!
//! The [`SsrfGuard`] / [`SsrfConfig`] types from the original crate are kept
//! intact for existing callers in `rdap-core`. New code should prefer
//! [`secure_fetch`].

#![forbid(unsafe_code)]
#![deny(missing_docs)]

// ── Public modules ────────────────────────────────────────────────────────────

pub mod content_type;
pub mod dns;
pub mod error;
pub mod http_policy;
pub mod ip;
pub mod limits;
pub mod redirect;
pub mod resolver;
pub mod url;

// ── Re-exports ────────────────────────────────────────────────────────────────

pub use content_type::validate_rdap_content_type;
pub use dns::{resolve_host, validate_resolved_ips};
pub use error::SecurityError;
pub use http_policy::HttpSecurityPolicy;
pub use ip::{is_blocked_ip, is_link_local, is_loopback, is_private_ip};
pub use limits::read_limited;
pub use redirect::validate_redirect;
pub use resolver::SecureResolver;
pub use url::validate_url;

// ── secure_fetch ──────────────────────────────────────────────────────────────

/// The primary entry point for all outbound RDAP HTTP requests.
///
/// Executes the full security pipeline:
///
/// 1. **URL validation** — scheme, credentials, IP-literal host.
/// 2. **DNS resolution** — hostname → IP addresses.
/// 3. **IP validation** — blocks private/loopback/link-local results.
/// 4. **HTTP request** — using the caller-supplied `client`.
/// 5. **Redirect handling** — each hop is re-validated through steps 1–3.
/// 6. **Content-Type check** — must be `application/rdap+json` or
///    `application/json`.
/// 7. **Response size limit** — stops reading at
///    `policy.max_response_size`.
///
/// # Client requirements
///
/// The supplied `client` **must** be built with
/// [`reqwest::redirect::Policy::none()`] so that redirects are intercepted and
/// re-validated by this function rather than followed silently.
///
/// # Errors
///
/// Returns a [`SecurityError`] if any security check fails or a transport
/// error occurs.
pub async fn secure_fetch(
    client: &reqwest::Client,
    url: ::url::Url,
    policy: &HttpSecurityPolicy,
) -> Result<bytes::Bytes, SecurityError> {
    // Steps 1–5 (URL/DNS/IP validation + validated redirect loop) live in
    // `secure_request`, the single audited egress primitive. `secure_fetch`
    // is now a thin wrapper that adds the RDAP-specific post-processing
    // (Content-Type check + size-capped body read) on top of the final,
    // already-validated response.
    let response = secure_request(client, url, policy).await?;

    // 6. Validate Content-Type.
    content_type::validate_rdap_content_type(response.headers())?;

    // 7. Read the body with a size cap.
    limits::read_limited(response, policy.max_response_size).await
}

/// Drives the audited SSRF egress pipeline and returns the final, fully
/// validated [`reqwest::Response`] — leaving all body / status / header
/// post-processing to the caller.
///
/// This is the single place in the workspace that performs the validated
/// redirect loop. It is the egress primitive that `rdap-core`'s `Fetcher`
/// builds on so that it keeps its own status-code, `Retry-After`,
/// `Cache-Control`, body-size-cap, retry, and circuit-breaker handling while
/// every hop is still re-validated here.
///
/// Pipeline (identical to [`secure_fetch`] steps 1–5):
///
/// 1. **URL validation** — scheme, credentials, IP-literal host.
/// 2. **DNS resolution** — hostname → IP addresses.
/// 3. **IP validation** — blocks private/loopback/link-local results.
/// 4. **HTTP request** — using the caller-supplied `client`.
/// 5. **Redirect handling** — each hop is re-validated through
///    [`redirect::validate_redirect`] (URL + DNS + IP).
///
/// Unlike [`secure_fetch`], this function does **not** check `Content-Type`
/// or read/limit the body; the returned response body is still unread.
///
/// # Client requirements
///
/// The supplied `client` **must** be built with
/// [`reqwest::redirect::Policy::none()`] so redirects are intercepted and
/// re-validated here rather than followed silently. A `client` that follows
/// redirects on its own would bypass the per-hop SSRF revalidation.
///
/// # Errors
///
/// Returns a [`SecurityError`] if any security check fails or a transport
/// error occurs.
pub async fn secure_request(
    client: &reqwest::Client,
    url: ::url::Url,
    policy: &HttpSecurityPolicy,
) -> Result<reqwest::Response, SecurityError> {
    // 0. Scheme policy — fail-fast before *any* network lookup.
    //
    // When `policy.require_https` is set (the default), a non-HTTPS scheme is
    // rejected here, before DNS resolution or any connection is attempted, so a
    // disallowed scheme can never trigger an outbound lookup. `validate_url`
    // (step 1) also enforces HTTPS as an unconditional baseline — including on
    // every redirect hop — but this guard is the configurable, policy-driven
    // front door that makes `require_https` an enforced constraint rather than
    // dead configuration.
    if policy.require_https && url.scheme() != "https" {
        return Err(SecurityError::InvalidScheme);
    }

    // 1. Validate the initial URL.
    url::validate_url(&url)?;

    // 2–3. Resolve and validate DNS for the initial host.
    //
    // This is an early, fail-fast check that returns a clear `SecurityError`
    // before a request is built. It is NOT the TOCTOU-closing gate on its own:
    // reqwest re-resolves the host at connect time. The actual rebinding
    // defense is [`crate::SecureResolver`], which the caller's `reqwest::Client`
    // must be built with — it validates the addresses reqwest *actually*
    // connects to, so there is no unvalidated second resolution. This pre-check
    // therefore costs one extra (OS-cached) lookup on the cold path, accepted
    // for the clearer error; it is dominated by the TLS handshake that follows.
    if let Some(host) = url.host_str() {
        let ips = dns::resolve_host(host).await?;
        dns::validate_resolved_ips(&ips)?;
    }

    // 4–5. Send the request; follow redirects manually so each hop is checked.
    let mut current_url = url;
    let mut redirect_count: usize = 0;

    loop {
        let response = tokio::time::timeout(
            policy.timeout,
            client
                .get(current_url.as_str())
                .header(
                    reqwest::header::ACCEPT,
                    "application/rdap+json, application/json",
                )
                .send(),
        )
        .await
        .map_err(|_| SecurityError::Timeout)?
        .map_err(SecurityError::Network)?;

        let status = response.status();

        // Follow redirects securely.
        if status.is_redirection() {
            if redirect_count >= policy.max_redirects {
                return Err(SecurityError::TooManyRedirects);
            }

            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or(SecurityError::InvalidHost)?;

            // Resolve relative redirects against the current URL.
            let next_url = current_url
                .join(location)
                .map_err(|_| SecurityError::InvalidHost)?;

            // Re-run full security validation on the redirect target.
            redirect::validate_redirect(&current_url, &next_url).await?;

            current_url = next_url;
            redirect_count += 1;
            continue;
        }

        // Hand the final, validated response back to the caller untouched.
        return Ok(response);
    }
}

// ── Backward-compatible SSRF guard ───────────────────────────────────────────
//
// The types below are the original public API consumed by `rdap-core` and all
// integration tests.  They continue to return `rdap_types::error::RdapError`
// so existing call-sites compile without changes.

use ::url::{Host, Url as UrlType};
use rdap_types::error::{RdapError, Result as RdapResult};
use std::net::{Ipv4Addr, Ipv6Addr};

/// Configuration for the SSRF guard.
#[derive(Debug, Clone)]
pub struct SsrfConfig {
    /// When `false` all checks are skipped (for testing only — never in
    /// production).
    pub enabled: bool,
    /// Additional domain suffixes to block (e.g., `"internal.corp"`).
    pub blocked_domains: Vec<String>,
    /// If non-empty, only these domain suffixes are allowed.
    /// Takes priority over `blocked_domains` and all IP checks.
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

/// SSRF guard — validates a URL string before any network call.
///
/// Prefer [`secure_fetch`] for new code. `SsrfGuard` is kept for backward
/// compatibility with `rdap-core`.
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

    /// Returns `true` when SSRF protection is active.
    ///
    /// When `false` (test-only configuration), the guard's [`validate`] is a
    /// no-op; callers such as `rdap-core`'s `Fetcher` use this to decide
    /// whether to route egress through the audited [`secure_request`] pipeline
    /// (production) or fall back to a direct, unvalidated request (tests that
    /// deliberately target `http://127.0.0.1` mock servers).
    ///
    /// [`validate`]: SsrfGuard::validate
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Validates a URL string.
    ///
    /// Returns `Ok(())` if the URL is safe to fetch, or a [`RdapError`]
    /// explaining why it was blocked.
    pub fn validate(&self, raw_url: &str) -> RdapResult<()> {
        if !self.config.enabled {
            return Ok(());
        }

        let url = UrlType::parse(raw_url).map_err(|e| RdapError::InvalidUrl {
            url: raw_url.to_string(),
            source: e,
        })?;

        if url.scheme() != "https" {
            return Err(RdapError::InsecureScheme {
                scheme: url.scheme().to_string(),
            });
        }

        // Allowlist (highest priority).
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
            return Ok(());
        }

        match url.host() {
            None => {
                return Err(RdapError::InvalidInput(format!(
                    "URL has no host: {raw_url}"
                )))
            }

            Some(Host::Domain(domain)) => {
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
            }

            Some(Host::Ipv4(v4)) => {
                self.check_ipv4(v4, raw_url)?;
            }

            Some(Host::Ipv6(v6)) => {
                // Normalize IPv4-mapped IPv6 literals (`[::ffff:a.b.c.d]`) so
                // the IPv4 rules apply — otherwise e.g. `[::ffff:192.168.1.1]`
                // would slip past the IPv6-only checks (SSRF-F2).
                match v6.to_ipv4_mapped() {
                    Some(v4) => self.check_ipv4(v4, raw_url)?,
                    None => self.check_ipv6(v6, raw_url)?,
                }
            }
        }

        Ok(())
    }

    fn check_ipv4(&self, ip: Ipv4Addr, raw_url: &str) -> RdapResult<()> {
        // CGNAT / test-net classification is shared with the `ip` module so the
        // two validators can never diverge (see `crate::ip::is_special_use`).
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
        } else if crate::ip::is_cgnat_v4(ip) {
            Some("carrier-grade NAT address (100.64/10, RFC 6598)")
        } else if crate::ip::is_test_net_v4(ip) {
            Some("test/documentation address (RFC 5737)")
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

    fn check_ipv6(&self, ip: Ipv6Addr, raw_url: &str) -> RdapResult<()> {
        let o = ip.octets();

        let reason = if ip.is_loopback() {
            Some("IPv6 loopback address (::1)")
        } else if o[0] == 0xfe && (o[1] & 0xc0) == 0x80 {
            Some("IPv6 link-local address (fe80::/10)")
        } else if (o[0] & 0xfe) == 0xfc {
            Some("IPv6 unique-local address (fc00::/7)")
        } else if crate::ip::is_nat64_v6(ip) {
            Some("NAT64 prefix (64:ff9b::/96 RFC 6052 or 64:ff9b:1::/48 RFC 8215)")
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

// ── Tests (SsrfGuard — backward-compat) ──────────────────────────────────────

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
    fn blocks_ipv4_mapped_ipv6_literal() {
        // SSRF-F2: `[::ffff:a.b.c.d]` literals must be normalized to the IPv4
        // rules instead of slipping past the IPv6-only checks.
        let guard = SsrfGuard::new();
        assert!(guard
            .validate("https://[::ffff:192.168.1.1]/")
            .unwrap_err()
            .is_ssrf_blocked());
        assert!(guard
            .validate("https://[::ffff:127.0.0.1]/")
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
    fn blocks_cgnat_and_test_nets() {
        let guard = SsrfGuard::new();
        for url in [
            "https://100.64.0.1/",
            "https://100.127.255.255/",
            "https://192.0.2.1/",
            "https://198.51.100.1/",
            "https://203.0.113.1/",
        ] {
            assert!(
                guard.validate(url).unwrap_err().is_ssrf_blocked(),
                "{url} must be blocked"
            );
        }
    }

    #[test]
    fn blocks_nat64_prefix() {
        let guard = SsrfGuard::new();
        for url in [
            "https://[64:ff9b::1]/",
            "https://[64:ff9b::808:808]/",
            "https://[64:ff9b:1::1]/",
        ] {
            assert!(
                guard.validate(url).unwrap_err().is_ssrf_blocked(),
                "{url} must be blocked"
            );
        }
    }

    #[test]
    fn allows_neighbours_of_special_use_ranges() {
        // Boundary check: addresses just outside the new ranges stay routable.
        let guard = SsrfGuard::new();
        for url in [
            "https://100.63.255.255/",
            "https://100.128.0.1/",
            "https://192.0.3.1/",
            "https://[64:ff9c::1]/",
        ] {
            assert!(guard.validate(url).is_ok(), "{url} must be allowed");
        }
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

// ── Tests (require_https enforcement) ─────────────────────────────────────────

#[cfg(test)]
mod require_https_tests {
    use super::*;
    use ::url::Url;

    fn no_redirect_client() -> reqwest::Client {
        reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .expect("client builds")
    }

    /// The default policy must require HTTPS.
    #[test]
    fn default_policy_requires_https() {
        assert!(HttpSecurityPolicy::default().require_https);
    }

    /// With `require_https` enabled (the default), a non-HTTPS URL must be
    /// rejected *before* any network lookup is triggered. We aim at a
    /// guaranteed-unresolvable `.invalid` host (RFC 6761): a
    /// `DnsResolutionFailed`/`Network`/`Timeout` error would prove the scheme
    /// guard ran too late, whereas `InvalidScheme` proves it fired first.
    #[tokio::test]
    async fn require_https_rejects_http_before_network_lookup() {
        let policy = HttpSecurityPolicy::default();
        let url = Url::parse("http://this-host-does-not-resolve.invalid/rdap").unwrap();

        let err = secure_request(&no_redirect_client(), url, &policy)
            .await
            .expect_err("http must be rejected when require_https is set");

        assert!(
            matches!(err, SecurityError::InvalidScheme),
            "expected InvalidScheme (fail-fast, no lookup), got {err:?}"
        );
    }

    /// `secure_fetch` shares the same fail-fast guard via `secure_request`.
    #[tokio::test]
    async fn secure_fetch_rejects_http_when_https_required() {
        let policy = HttpSecurityPolicy::default();
        let url = Url::parse("http://this-host-does-not-resolve.invalid/rdap").unwrap();

        let err = secure_fetch(&no_redirect_client(), url, &policy)
            .await
            .expect_err("http must be rejected when require_https is set");

        assert!(matches!(err, SecurityError::InvalidScheme), "got {err:?}");
    }
}
