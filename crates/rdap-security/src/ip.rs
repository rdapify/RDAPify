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
/// * CGNAT     — 100.64.0.0/10 (RFC 6598 shared address space)
/// * NAT64     — 64:ff9b::/96 (RFC 6052) · 64:ff9b:1::/48 (RFC 8215)
/// * Test/Doc  — 192.0.2.0/24 · 198.51.100.0/24 · 203.0.113.0/24 (RFC 5737)
#[inline]
pub fn is_blocked_ip(ip: IpAddr) -> bool {
    let ip = canonicalize(ip);
    is_loopback(ip)
        || is_private_ip(ip)
        || is_link_local(ip)
        || is_unspecified(ip)
        || is_broadcast(ip)
        || is_special_use(ip)
}

/// Returns `true` for special-use ranges that are neither routable public
/// destinations nor covered by the loopback/private/link-local classifiers, yet
/// must never be reachable by an outbound RDAP request:
///
/// * **CGNAT** — `100.64.0.0/10` (RFC 6598 shared address space). Used between
///   ISP NAT tiers; reaching it from a service is an egress-policy violation.
/// * **NAT64** — `64:ff9b::/96` (RFC 6052 well-known prefix) and
///   `64:ff9b:1::/48` (RFC 8215 local-use prefix). The embedded IPv4
///   destination could be an internal address, so both prefixes are refused.
/// * **TEST-NET-1/2/3 & documentation** — `192.0.2.0/24`, `198.51.100.0/24`,
///   `203.0.113.0/24` (RFC 5737). These never identify a real host; a request
///   to them signals a misconfiguration or an attempted bypass.
#[inline]
fn is_special_use(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_cgnat_v4(v4) || is_test_net_v4(v4),
        IpAddr::V6(v6) => is_nat64_v6(v6),
    }
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

/// 100.64.0.0/10 — Carrier-Grade NAT / shared address space (RFC 6598).
///
/// The first 10 bits are fixed: octet 0 == 100 and the top two bits of octet 1
/// == `01` (covering 100.64.x.x – 100.127.x.x).
///
/// Shared with the backward-compat [`crate::SsrfGuard`] so both validators
/// classify the range identically.
#[inline]
pub(crate) fn is_cgnat_v4(v4: Ipv4Addr) -> bool {
    let o = v4.octets();
    o[0] == 100 && (o[1] & 0xc0) == 0x40
}

/// TEST-NET-1/2/3 and documentation ranges (RFC 5737):
/// 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24.
///
/// Shared with the backward-compat [`crate::SsrfGuard`].
#[inline]
pub(crate) fn is_test_net_v4(v4: Ipv4Addr) -> bool {
    let o = v4.octets();
    matches!(
        [o[0], o[1], o[2]],
        [192, 0, 2] | [198, 51, 100] | [203, 0, 113]
    )
}

/// NAT64 translation prefixes — both refused because the embedded IPv4
/// destination could itself be an internal address:
///
/// * **Well-known** `64:ff9b::/96` (RFC 6052) — first 96 bits fixed
///   (`0064:ff9b:0000:0000:0000:0000`), final 32 bits embed the IPv4 target.
/// * **Local-use** `64:ff9b:1::/48` (RFC 8215) — first 48 bits fixed
///   (`0064:ff9b:0001`), operator-chosen translation prefix.
///
/// Both share the leading `0064:ff9b` label. Shared with the backward-compat
/// [`crate::SsrfGuard`].
#[inline]
pub(crate) fn is_nat64_v6(v6: Ipv6Addr) -> bool {
    let o = v6.octets();
    // Both prefixes share the leading `0064:ff9b` 32-bit label.
    if !(o[0] == 0x00 && o[1] == 0x64 && o[2] == 0xff && o[3] == 0x9b) {
        return false;
    }
    // Well-known `64:ff9b::/96`: octets 4..12 (bits 32..96) are all zero.
    let well_known = o[4..12].iter().all(|&b| b == 0);
    // Local-use `64:ff9b:1::/48`: octets 4..6 (bits 32..48) are `00 01`.
    let local_use = o[4] == 0x00 && o[5] == 0x01;
    well_known || local_use
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

    // ── Special-use ranges (SSRF low-item sweep) ───────────────────────────────

    #[test]
    fn cgnat_v4_is_blocked() {
        // 100.64.0.0/10 boundaries and interior (RFC 6598).
        for addr in [
            "100.64.0.0",
            "100.64.0.1",
            "100.100.50.25",
            "100.127.255.255",
        ] {
            assert!(is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    #[test]
    fn cgnat_v4_boundaries_outside_range_are_allowed() {
        // Just below (100.63.x) and just above (100.128.x) the /10 must stay
        // routable — the mask must not over-block the neighbouring 100/8 space.
        for addr in ["100.63.255.255", "100.128.0.0", "99.64.0.1", "101.64.0.1"] {
            assert!(!is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    #[test]
    fn test_net_v4_ranges_are_blocked() {
        // TEST-NET-1/2/3 and documentation ranges (RFC 5737).
        for addr in [
            "192.0.2.0",
            "192.0.2.255",
            "198.51.100.1",
            "198.51.100.254",
            "203.0.113.0",
            "203.0.113.42",
        ] {
            assert!(is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    #[test]
    fn test_net_neighbours_are_allowed() {
        // Adjacent /24s outside the documentation ranges must remain routable.
        for addr in ["192.0.3.1", "198.51.101.1", "203.0.114.1", "192.0.1.1"] {
            assert!(!is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    #[test]
    fn nat64_well_known_prefix_is_blocked() {
        // 64:ff9b::/96 (RFC 6052) — including an embedded public IPv4 (8.8.8.8),
        // which must still be refused because the embedded host may be internal.
        for addr in [
            "64:ff9b::",
            "64:ff9b::1",
            "64:ff9b::808:808",
            "64:ff9b::0.0.0.1",
        ] {
            let ip = addr.parse::<IpAddr>().unwrap();
            assert!(ip.is_ipv6(), "{addr} should parse as IPv6");
            assert!(is_blocked_ip(ip), "{addr} (NAT64) must be blocked");
        }
    }

    #[test]
    fn nat64_local_use_prefix_is_blocked() {
        // RFC 8215 local-use NAT64 prefix 64:ff9b:1::/48.
        for addr in ["64:ff9b:1::", "64:ff9b:1::1", "64:ff9b:1:abcd::1"] {
            let ip = addr.parse::<IpAddr>().unwrap();
            assert!(ip.is_ipv6(), "{addr} should parse as IPv6");
            assert!(
                is_blocked_ip(ip),
                "{addr} (NAT64 local-use) must be blocked"
            );
        }
    }

    #[test]
    fn nat64_neighbours_are_allowed() {
        // Addresses sharing the leading label but outside the well-known /96 and
        // the local-use /48 must not be over-blocked. `64:ff9b:2::1` sits just
        // past the local-use prefix (octet 5 == 0x02, not 0x01).
        for addr in [
            "64:ff9c::1",
            "65:ff9b::1",
            "64:ff9b:2::1",
            "2606:4700:4700::1111",
        ] {
            assert!(!is_blocked_ip(addr.parse::<IpAddr>().unwrap()), "{addr}");
        }
    }

    #[test]
    fn special_use_via_ipv4_mapped_is_blocked() {
        // The mapped forms must normalize to the IPv4 special-use rules.
        for addr in [
            "::ffff:100.64.0.1",
            "::ffff:192.0.2.1",
            "::ffff:203.0.113.1",
        ] {
            let ip = addr.parse::<IpAddr>().unwrap();
            assert!(ip.is_ipv6(), "{addr} should parse as IPv6");
            assert!(
                is_blocked_ip(ip),
                "{addr} (mapped special-use) must be blocked"
            );
        }
    }
}
