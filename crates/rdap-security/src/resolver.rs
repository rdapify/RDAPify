//! Connect-time SSRF-validating DNS resolver.
//!
//! [`SecureResolver`] plugs into reqwest via
//! [`reqwest::ClientBuilder::dns_resolver`]. Because reqwest connects *only* to
//! the addresses this resolver returns, validating here — at the exact moment
//! reqwest resolves for the connection — closes the DNS-rebinding TOCTOU that a
//! separate pre-connection [`crate::dns::resolve_host`] check cannot: there is
//! no second, unvalidated resolution between the check and the TCP connect.
//!
//! IP-literal URLs never reach this resolver (reqwest connects to the literal
//! directly); those are rejected earlier by [`crate::url::validate_url`] /
//! [`crate::SsrfGuard`].

use std::net::SocketAddr;

use reqwest::dns::{Addrs, Name, Resolve, Resolving};

use crate::dns::validate_resolved_ips;
use crate::error::SecurityError;

/// Boxed error type expected by [`reqwest::dns::Resolving`].
type BoxError = Box<dyn std::error::Error + Send + Sync>;

/// A [`reqwest::dns::Resolve`] implementation that refuses to resolve a host to
/// any blocked IP (loopback, RFC 1918 / `fc00::/7` private, link-local
/// including the `169.254.169.254` cloud-metadata address, and the other ranges
/// covered by [`validate_resolved_ips`]).
///
/// If *any* address a hostname resolves to is blocked, the entire resolution
/// fails — a split-horizon / rebinding answer mixing a public and a private IP
/// cannot be used to reach an internal target. Wiring this into the fetcher's
/// `reqwest::Client` makes the validated address set the *same* set reqwest
/// connects to, which is what eliminates the rebinding window.
#[derive(Debug, Clone, Default)]
pub struct SecureResolver;

impl SecureResolver {
    /// Creates a new resolver.
    pub fn new() -> Self {
        Self
    }
}

impl Resolve for SecureResolver {
    fn resolve(&self, name: Name) -> Resolving {
        Box::pin(async move {
            // Resolve with the system resolver. Port `0` is a placeholder:
            // reqwest overrides it with the URL's port at connect time.
            // `name` is owned by this block, so borrowing `as_str()` across the
            // await needs no allocation.
            let resolved: Vec<SocketAddr> = tokio::net::lookup_host((name.as_str(), 0))
                .await
                .map_err(|e| {
                    Box::new(SecurityError::DnsResolutionFailed(e.to_string())) as BoxError
                })?
                .collect();

            if resolved.is_empty() {
                return Err(Box::new(SecurityError::DnsResolutionFailed(format!(
                    "No addresses returned for '{}'",
                    name.as_str()
                ))) as BoxError);
            }

            // Validate every resolved address; reject the whole resolution if
            // any is blocked so reqwest can never connect to an internal IP.
            let ips: Vec<_> = resolved.iter().map(|sa| sa.ip()).collect();
            validate_resolved_ips(&ips).map_err(|e| Box::new(e) as BoxError)?;

            Ok(Box::new(resolved.into_iter()) as Addrs)
        })
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// `localhost` deterministically resolves to a loopback address on every
    /// supported platform, so the resolver must reject it. This proves the
    /// connect-time gate blocks a blocked IP at the moment of resolution —
    /// i.e. reqwest would never be handed a loopback address to connect to.
    #[tokio::test]
    async fn rejects_loopback_host() {
        let resolver = SecureResolver::new();
        let name = "localhost".parse::<Name>().expect("valid host name");
        assert!(
            resolver.resolve(name).await.is_err(),
            "localhost must be rejected by the connect-time resolver"
        );
    }
}
