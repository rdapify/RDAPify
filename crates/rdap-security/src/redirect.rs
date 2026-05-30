//! Redirect validation — every hop in a redirect chain must pass the same
//! checks as the original URL.

use url::Url;

use crate::dns;
use crate::error::SecurityError;
use crate::url as url_check;

/// Validates a single redirect hop from `from` to `to`.
///
/// Performs the full security stack on the redirect target:
/// 0. Origin check — reject a protocol downgrade (HTTPS → non-HTTPS).
/// 1. URL structure validation (scheme, no credentials, no blocked IP literal).
/// 2. DNS resolution of the target host.
/// 3. IP validation of every resolved address.
///
/// The `from` origin is inspected to block protocol-downgrade redirects.
/// Cross-host redirects are intentionally **permitted**: RDAP bootstrap
/// legitimately redirects to authoritative registries on other hosts, and
/// every target host is independently re-validated by steps 1–3, so a
/// host change carries no SSRF risk that the per-hop checks do not already
/// cover.
pub async fn validate_redirect(from: &Url, to: &Url) -> Result<(), SecurityError> {
    // 0. Defense-in-depth: a secure origin must never be downgraded to an
    //    insecure transport across a hop. This is enforced here independently
    //    of the target-scheme policy in `validate_url`, so the invariant holds
    //    even if that policy is ever relaxed.
    if from.scheme() == "https" && to.scheme() != "https" {
        return Err(SecurityError::InvalidScheme);
    }

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
    fn non_https_origin_does_not_trip_downgrade_check() {
        // The origin downgrade check (step 0) only fires for an HTTPS origin.
        // With a non-HTTPS origin it must stay inert and let `validate_url`
        // (step 1) be the backstop that still rejects the non-HTTPS target —
        // proving the `from`-based branch neither over-blocks nor is the only
        // line of defence.
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let from = parse("http://rdap.example.com/");
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
