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
    let ip = canonicalize(ip);
    is_loopback(ip)
        || is_private_ip(ip)
        || is_link_local(ip)
        || is_unspecified(ip)
        || is_broadcast(ip)
}

/// Returns `true` for RFC 1918 IPv4 addresses and IPv6 unique-local (fc00::/7).
#[inline]
pub fn is_private_ip(ip: IpAddr) -> bool {
    match canonicalize(ip) {
        IpAddr::V4(v4) => is_private_v4(v4),
        IpAddr::V6(v6) => is_unique_local_v6(v6),
    }
}

/// Returns `true` for loopback addresses (127.0.0.0/8 for IPv4, ::1 for IPv6).
#[inline]
pub fn is_loopback(ip: IpAddr) -> bool {
    canonicalize(ip).is_loopback()
}

/// Returns `true` for link-local addresses (169.254/16 for IPv4, fe80::/10 for
/// IPv6).
#[inline]
pub fn is_link_local(ip: IpAddr) -> bool {
    match canonicalize(ip) {
        IpAddr::V4(v4) => v4.is_link_local(),
        IpAddr::V6(v6) => is_link_local_v6(v6),
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Normalizes an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) to its canonical
/// IPv4 form so the IPv4 rules apply. All other addresses pass through
/// unchanged.
///
/// Without this, an address such as `::ffff:192.168.1.1` is classified as a
/// generic (allowed) IPv6 address and slips past the RFC 1918 / loopback /
/// link-local checks — a real SSRF bypass when a host resolves to a mapped
/// address. Applied at the entry of every public classifier so all callers
/// (`validate_resolved_ips`, `SecureResolver`, the URL validator) are covered.
#[inline]
fn canonicalize(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => IpAddr::V6(v6),
        },
        v4 => v4,
    }
}

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

    // ── IPv4-mapped IPv6 normalization (SSRF-F2) ───────────────────────────────

    #[test]
    fn ipv4_mapped_private_is_blocked() {
        // `::ffff:a.b.c.d` must be normalized so the IPv4 RFC 1918 rules apply.
        for addr in ["::ffff:10.0.0.1", "::ffff:192.168.1.1", "::ffff:172.16.0.1"] {
            let ip = addr.parse::<IpAddr>().unwrap();
            // Guard: must still be an IPv6 value (testing the mapped path, not
            // a parser auto-conversion to IPv4).
            assert!(ip.is_ipv6(), "{addr} should parse as IPv6");
            assert!(is_blocked_ip(ip), "{addr} (mapped private) must be blocked");
            assert!(is_private_ip(ip), "{addr} must classify as private");
        }
    }

    #[test]
    fn ipv4_mapped_loopback_and_metadata_is_blocked() {
        let loopback = "::ffff:127.0.0.1".parse::<IpAddr>().unwrap();
        assert!(loopback.is_ipv6());
        assert!(is_blocked_ip(loopback));
        assert!(is_loopback(loopback), "mapped 127.0.0.1 must be loopback");

        // Cloud-metadata endpoint reached via a mapped link-local address.
        let metadata = "::ffff:169.254.169.254".parse::<IpAddr>().unwrap();
        assert!(is_blocked_ip(metadata));
        assert!(
            is_link_local(metadata),
            "mapped 169.254/16 must be link-local"
        );
    }

    #[test]
    fn ipv4_mapped_public_is_still_allowed() {
        // Normalization must not over-block legitimate public addresses.
        for addr in ["::ffff:8.8.8.8", "::ffff:1.1.1.1"] {
            assert!(
                !is_blocked_ip(addr.parse::<IpAddr>().unwrap()),
                "{addr} (mapped public) must be allowed"
            );
        }
    }
}
