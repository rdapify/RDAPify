//! URL validation for outbound RDAP requests.

use std::net::IpAddr;

use url::{Host, Url};

use crate::error::SecurityError;
use crate::ip;

/// Validates that `url` is safe to use for an outbound RDAP request.
///
/// Rules enforced (in order):
/// 1. Scheme must be `https` (only).
/// 2. URL must not contain embedded credentials.
/// 3. URL must have a non-empty host.
/// 4. Host must not be `localhost` (case-insensitive).
/// 5. IP-literal hosts must not be in any blocked range.
pub fn validate_url(url: &Url) -> Result<(), SecurityError> {
    // 1. HTTPS only
    if url.scheme() != "https" {
        return Err(SecurityError::InvalidScheme);
    }

    // 2. No embedded credentials
    if !url.username().is_empty() || url.password().is_some() {
        return Err(SecurityError::CredentialsInUrl);
    }

    // 3 + 4 + 5. Host checks
    match url.host() {
        None => return Err(SecurityError::InvalidHost),

        Some(Host::Domain(domain)) => {
            if domain.is_empty() || domain.eq_ignore_ascii_case("localhost") {
                return Err(SecurityError::InvalidHost);
            }
        }

        Some(Host::Ipv4(v4)) => {
            if ip::is_blocked_ip(IpAddr::V4(v4)) {
                return Err(SecurityError::BlockedIp);
            }
        }

        Some(Host::Ipv6(v6)) => {
            if ip::is_blocked_ip(IpAddr::V6(v6)) {
                return Err(SecurityError::BlockedIp);
            }
        }
    }

    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn allows_public_https() {
        assert!(validate_url(&parse("https://rdap.verisign.com/com/v1/")).is_ok());
        assert!(validate_url(&parse("https://rdap.arin.net/registry/")).is_ok());
    }

    #[test]
    fn rejects_http() {
        assert!(matches!(
            validate_url(&parse("http://rdap.verisign.com/")),
            Err(SecurityError::InvalidScheme)
        ));
    }

    #[test]
    fn rejects_credentials() {
        assert!(matches!(
            validate_url(&parse("https://user:pass@rdap.verisign.com/")),
            Err(SecurityError::CredentialsInUrl)
        ));
        assert!(matches!(
            validate_url(&parse("https://user@rdap.verisign.com/")),
            Err(SecurityError::CredentialsInUrl)
        ));
    }

    #[test]
    fn rejects_localhost() {
        assert!(matches!(
            validate_url(&parse("https://localhost/")),
            Err(SecurityError::InvalidHost)
        ));
        assert!(matches!(
            validate_url(&parse("https://LOCALHOST/")),
            Err(SecurityError::InvalidHost)
        ));
    }

    #[test]
    fn rejects_private_ip_literals() {
        for url in [
            "https://127.0.0.1/",
            "https://10.0.0.1/",
            "https://192.168.1.1/",
            "https://172.16.0.1/",
            "https://169.254.169.254/",
            "https://[::1]/",
            "https://[fe80::1]/",
            "https://[fc00::1]/",
        ] {
            assert!(
                matches!(
                    validate_url(&parse(url)),
                    Err(SecurityError::BlockedIp | SecurityError::InvalidHost)
                ),
                "expected block for {url}"
            );
        }
    }
}
