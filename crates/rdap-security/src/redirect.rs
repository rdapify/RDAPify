//! Redirect validation — every hop in a redirect chain must pass the same
//! checks as the original URL.

use url::Url;

use crate::dns;
use crate::error::SecurityError;
use crate::url as url_check;

/// Validates a single redirect hop from `_from` to `to`.
///
/// Performs the full security stack on the redirect target:
/// 1. URL structure validation (scheme, no credentials, no blocked IP literal).
/// 2. DNS resolution of the target host.
/// 3. IP validation of every resolved address.
///
/// The `_from` parameter is accepted for future use (e.g., blocking
/// protocol-downgrade redirects from HTTPS to HTTP) but is not currently
/// inspected.
pub async fn validate_redirect(_from: &Url, to: &Url) -> Result<(), SecurityError> {
    // 1. Re-run full URL validation on the redirect target.
    url_check::validate_url(to)?;

    // 2–3. Re-resolve DNS and check IPs (guards against DNS-rebinding across
    //      the redirect chain).
    if let Some(host) = to.host_str() {
        let ips = dns::resolve_host(host).await?;
        dns::validate_resolved_ips(&ips)?;
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
    fn rejects_http_redirect_target() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let from = parse("https://rdap.example.com/");
            let to = parse("http://rdap.example.com/");
            assert!(matches!(
                validate_redirect(&from, &to).await,
                Err(SecurityError::InvalidScheme)
            ));
        });
    }

    #[test]
    fn rejects_private_ip_redirect() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let from = parse("https://rdap.example.com/");
            let to = parse("https://10.0.0.1/");
            assert!(matches!(
                validate_redirect(&from, &to).await,
                Err(SecurityError::BlockedIp)
            ));
        });
    }
}
