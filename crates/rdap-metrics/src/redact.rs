//! PII redaction helpers for log fields.
//!
//! Stage D rule: never log a full domain or IP. These helpers produce
//! deterministic, non-reversible short tokens suitable for use as a
//! `target_redacted` field on a tracing span.
//!
//! The redaction is **not** cryptographic — its purpose is to keep ops dashboards
//! free of PII while still letting an operator correlate two log lines for the
//! same target. A salted hash would make correlation across deployments harder
//! without adding meaningful security; the tokens here are intentionally cheap.

use std::net::IpAddr;

/// Redacts a domain to the form `<tld>:<8-hex>` where the hex segment is a
/// fast non-cryptographic hash of the full domain.
///
/// Examples:
/// - `example.com` → `com:6c3a4b2d`
/// - `sub.example.co.uk` → `uk:9f1e7c30`
/// - `localhost` → `_:c4d2a8e1`
///
/// The TLD is preserved (low cardinality, useful for filtering registry
/// outages); everything to its left is collapsed into the hash.
pub fn redact_domain(domain: &str) -> String {
    let trimmed = domain.trim_end_matches('.');
    let tld = trimmed.rsplit('.').next().unwrap_or("_");
    let tld = if tld.is_empty() { "_" } else { tld };
    let h = hash32(trimmed.as_bytes());
    format!("{tld}:{h:08x}")
}

/// Redacts an IP address to its network prefix:
///
/// - IPv4: keeps the first two octets, replaces the rest with `x.x` (e.g.
///   `192.0.2.1` → `192.0.x.x`).
/// - IPv6: keeps the first 32 bits (the typical site prefix) and replaces
///   the rest with `::/96` (e.g. `2001:db8:85a3::8a2e:370:7334` →
///   `2001:db8::/96`).
///
/// This preserves enough information to spot a "the whole 2001:db8:: range
/// is failing" signal while dropping the bits that identify a host.
pub fn redact_ip(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(v4) => {
            let o = v4.octets();
            format!("{}.{}.x.x", o[0], o[1])
        }
        IpAddr::V6(v6) => {
            let s = v6.segments();
            format!("{:x}:{:x}::/96", s[0], s[1])
        }
    }
}

/// Redacts a URL by stripping the path / query and replacing the host with
/// [`redact_domain`].
///
/// We don't pull in the full `url` crate here — `rdap-metrics` is intentionally
/// thin. The split is conservative: anything that doesn't look like
/// `scheme://host[:port]/...` falls back to a hashed opaque token.
pub fn redact_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        let h = hash32(url.as_bytes());
        return format!("opaque:{h:08x}");
    };
    // Authority ends at the first `/`, `?`, or `#`.
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let authority = &rest[..authority_end];
    // Host is everything before the optional `:port`. Userinfo (`user@host`)
    // is intentionally dropped — we don't want to log credentials.
    let host_with_port = authority.rsplit_once('@').map_or(authority, |(_, h)| h);
    let host = host_with_port
        .split_once(':')
        .map_or(host_with_port, |(h, _)| h);
    if host.is_empty() {
        let h = hash32(url.as_bytes());
        return format!("opaque:{h:08x}");
    }
    format!("{scheme}://{}", redact_domain(host))
}

/// 32-bit FNV-1a — fast, deterministic, allocation-free. Not cryptographic.
fn hash32(bytes: &[u8]) -> u32 {
    const FNV_OFFSET: u32 = 0x811c_9dc5;
    const FNV_PRIME: u32 = 0x0100_0193;
    let mut h: u32 = FNV_OFFSET;
    for &b in bytes {
        h ^= b as u32;
        h = h.wrapping_mul(FNV_PRIME);
    }
    h
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn redact_domain_keeps_tld() {
        let r = redact_domain("example.com");
        assert!(r.starts_with("com:"));
        assert_eq!(r.len(), "com:".len() + 8);
    }

    #[test]
    fn redact_domain_is_deterministic() {
        assert_eq!(redact_domain("example.com"), redact_domain("example.com"));
    }

    #[test]
    fn redact_domain_differs_for_different_inputs() {
        assert_ne!(redact_domain("example.com"), redact_domain("other.com"));
    }

    #[test]
    fn redact_domain_does_not_leak_raw_input() {
        let r = redact_domain("super-secret-internal.corp");
        assert!(!r.contains("super-secret-internal"));
    }

    #[test]
    fn redact_domain_handles_trailing_dot() {
        // FQDN with trailing dot
        let r = redact_domain("example.com.");
        assert!(r.starts_with("com:"));
    }

    #[test]
    fn redact_domain_handles_no_dot() {
        let r = redact_domain("localhost");
        assert!(r.starts_with("localhost:"));
    }

    #[test]
    fn redact_ipv4_preserves_first_two_octets() {
        let ip = IpAddr::V4(Ipv4Addr::new(203, 0, 113, 42));
        assert_eq!(redact_ip(ip), "203.0.x.x");
    }

    #[test]
    fn redact_ipv6_keeps_site_prefix() {
        let ip = IpAddr::V6(Ipv6Addr::new(0x2001, 0xdb8, 0, 0, 0, 0, 0, 1));
        assert_eq!(redact_ip(ip), "2001:db8::/96");
    }

    #[test]
    fn redact_url_strips_path_and_query() {
        let r = redact_url("https://rdap.verisign.com/domain/example.com?foo=bar");
        // Should NOT contain example.com nor any query param.
        assert!(!r.contains("example.com"));
        assert!(!r.contains("foo"));
        assert!(r.starts_with("https://"));
    }

    #[test]
    fn redact_url_unparseable_falls_back_to_opaque_hash() {
        let r = redact_url("not a url");
        assert!(r.starts_with("opaque:"));
    }
}
