//! Async DNS resolution with SSRF / DNS-rebinding protection.
//!
//! [`resolve_host`] uses the Tokio system resolver (libc on Linux/macOS,
//! `getaddrinfo` on Windows). No extra dependency is required.
//!
//! [`validate_resolved_ips`] rejects any result that contains a blocked address
//! so a name that points to `169.254.169.254` (cloud-metadata SSRF) is caught
//! at resolve time, before a TCP connection is opened.

use std::net::IpAddr;

use crate::error::SecurityError;
use crate::ip;

/// Resolves `host` to a list of IP addresses using the system resolver.
///
/// Returns [`SecurityError::DnsResolutionFailed`] if the host cannot be
/// resolved or yields no addresses.
///
/// # Note
///
/// Uses port 443 as a dummy port for `tokio::net::lookup_host`; only the IP
/// component of each returned `SocketAddr` is kept.
pub async fn resolve_host(host: &str) -> Result<Vec<IpAddr>, SecurityError> {
    let addrs = tokio::net::lookup_host(format!("{host}:443"))
        .await
        .map_err(|e| SecurityError::DnsResolutionFailed(e.to_string()))?;

    let ips: Vec<IpAddr> = addrs.map(|sa| sa.ip()).collect();

    if ips.is_empty() {
        return Err(SecurityError::DnsResolutionFailed(format!(
            "No addresses returned for '{host}'"
        )));
    }

    Ok(ips)
}

/// Validates a slice of resolved IP addresses.
///
/// Returns the most-specific error for the first blocked IP found:
/// [`SecurityError::LoopbackIp`] → [`SecurityError::LinkLocalIp`] →
/// [`SecurityError::PrivateIp`] → [`SecurityError::BlockedIp`].
pub fn validate_resolved_ips(ips: &[IpAddr]) -> Result<(), SecurityError> {
    for &ip in ips {
        if ip::is_loopback(ip) {
            return Err(SecurityError::LoopbackIp);
        }
        if ip::is_link_local(ip) {
            return Err(SecurityError::LinkLocalIp);
        }
        if ip::is_private_ip(ip) {
            return Err(SecurityError::PrivateIp);
        }
        if ip::is_blocked_ip(ip) {
            return Err(SecurityError::BlockedIp);
        }
    }
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};

    #[test]
    fn rejects_loopback() {
        let ips = vec![IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))];
        assert!(matches!(
            validate_resolved_ips(&ips),
            Err(SecurityError::LoopbackIp)
        ));
    }

    #[test]
    fn rejects_link_local() {
        let ips = vec![IpAddr::V4(Ipv4Addr::new(169, 254, 169, 254))];
        assert!(matches!(
            validate_resolved_ips(&ips),
            Err(SecurityError::LinkLocalIp)
        ));
    }

    #[test]
    fn rejects_private() {
        let ips = vec![IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))];
        assert!(matches!(
            validate_resolved_ips(&ips),
            Err(SecurityError::PrivateIp)
        ));
    }

    #[test]
    fn accepts_public() {
        let ips = vec![IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1))];
        assert!(validate_resolved_ips(&ips).is_ok());
    }

    #[test]
    fn rejects_mixed_list_on_any_blocked() {
        // Even one private IP among public ones must be rejected.
        let ips = vec![
            IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)),
            IpAddr::V4(Ipv4Addr::new(192, 168, 0, 1)),
        ];
        assert!(validate_resolved_ips(&ips).is_err());
    }
}
