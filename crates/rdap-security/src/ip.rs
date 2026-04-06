//! IP address classification for SSRF protection.
//!
//! These are pure, synchronous helpers used by both the URL validator and the
//! DNS resolver. Every function is `#[inline]` so the compiler can eliminate
//! branches it can prove unreachable.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

/// Returns `true` if the IP address must be blocked unconditionally.
///
/// This is the single gate used by [`crate::dns::validate_resolved_ips`] and
/// [`crate::url::validate_url`] (for IP-literal hosts). It covers:
///
/// * Loopback  — 127.0.0.0/8 · ::1
/// * Private   — 10/8 · 172.16/12 · 192.168/16 · fc00::/7
/// * Link-local — 169.254/16 · fe80::/10
/// * Unspecified — 0.0.0.0 · ::
/// * Broadcast — 255.255.255.255
#[inline]
pub fn is_blocked_ip(ip: IpAddr) -> bool {
    is_loopback(ip)
        || is_private_ip(ip)
        || is_link_local(ip)
        || is_unspecified(ip)
        || is_broadcast(ip)
}

/// Returns `true` for RFC 1918 IPv4 addresses and IPv6 unique-local (fc00::/7).
#[inline]
pub fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_private_v4(v4),
        IpAddr::V6(v6) => is_unique_local_v6(v6),
    }
}

/// Returns `true` for loopback addresses (127.0.0.0/8 for IPv4, ::1 for IPv6).
#[inline]
pub fn is_loopback(ip: IpAddr) -> bool {
    ip.is_loopback()
}

/// Returns `true` for link-local addresses (169.254/16 for IPv4, fe80::/10 for
/// IPv6).
#[inline]
pub fn is_link_local(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_link_local(),
        IpAddr::V6(v6) => is_link_local_v6(v6),
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

#[inline]
fn is_unspecified(ip: IpAddr) -> bool {
    ip.is_unspecified()
}

#[inline]
fn is_broadcast(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_broadcast(),
        IpAddr::V6(_) => false,
    }
}

/// 10/8, 172.16/12, 192.168/16 — as defined by std (`Ipv4Addr::is_private`).
#[inline]
fn is_private_v4(v4: Ipv4Addr) -> bool {
    v4.is_private()
}

/// fc00::/7 — unique-local unicast (RFC 4193).
///
/// Matches both fc00::/8 and fd00::/8, which together form fc00::/7.
#[inline]
fn is_unique_local_v6(v6: Ipv6Addr) -> bool {
    // The high byte must be 0xfc or 0xfd (i.e. top 7 bits == 0b1111110x).
    (v6.octets()[0] & 0xfe) == 0xfc
}

/// fe80::/10 — link-local unicast.
#[inline]
fn is_link_local_v6(v6: Ipv6Addr) -> bool {
    let o = v6.octets();
    o[0] == 0xfe && (o[1] & 0xc0) == 0x80
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::IpAddr;

    // ── IPv4 ──────────────────────────────────────────────────────────────────

    #[test]
    fn loopback_v4_is_blocked() {
        assert!(is_blocked_ip("127.0.0.1".parse::<IpAddr>().unwrap()));
        assert!(is_blocked_ip("127.255.255.255".parse::<IpAddr>().unwrap()));
    }

    #[test]
    fn private_v4_ranges_are_blocked() {
        for addr in ["10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1"] {
            assert!(is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    #[test]
    fn link_local_v4_is_blocked() {
        assert!(is_blocked_ip("169.254.1.1".parse::<IpAddr>().unwrap()));
        // Cloud metadata endpoint
        assert!(is_blocked_ip("169.254.169.254".parse::<IpAddr>().unwrap()));
    }

    #[test]
    fn unspecified_v4_is_blocked() {
        assert!(is_blocked_ip("0.0.0.0".parse::<IpAddr>().unwrap()));
    }

    #[test]
    fn public_v4_is_allowed() {
        for addr in ["1.1.1.1", "8.8.8.8", "93.184.216.34"] {
            assert!(!is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    // ── IPv6 ──────────────────────────────────────────────────────────────────

    #[test]
    fn loopback_v6_is_blocked() {
        assert!(is_blocked_ip("::1".parse::<IpAddr>().unwrap()));
    }

    #[test]
    fn link_local_v6_is_blocked() {
        assert!(is_blocked_ip("fe80::1".parse::<IpAddr>().unwrap()));
        assert!(is_blocked_ip("fe80::dead:beef".parse::<IpAddr>().unwrap()));
    }

    #[test]
    fn unique_local_v6_is_blocked() {
        assert!(is_blocked_ip("fc00::1".parse::<IpAddr>().unwrap()));
        assert!(is_blocked_ip(
            "fd12:3456:789a::1".parse::<IpAddr>().unwrap()
        ));
    }

    #[test]
    fn public_v6_is_allowed() {
        assert!(!is_blocked_ip(
            "2606:4700:4700::1111".parse::<IpAddr>().unwrap()
        ));
    }
}
