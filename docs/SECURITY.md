# RDAPify Security Model

## Overview

RDAPify is designed for production use in environments where RDAP server queries must be strictly controlled and validated. The security model focuses on three concerns: SSRF protection, input validation, and PII handling.

## SSRF Protection

Server-Side Request Forgery (SSRF) is the primary threat when querying arbitrary RDAP servers. RDAPify includes built-in `SsrfGuard` protection that validates every outbound URL *before* the HTTP request is issued.

### Blocked Addresses

The guard blocks requests to:

#### IPv4 (RFC 1918 and related)
- Loopback: `127.0.0.0/8` (127.0.0.1 – 127.255.255.255)
- Private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Link-local: `169.254.0.0/16`
- Reserved: `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved)

#### IPv6
- Loopback: `::1`
- Link-local: `fe80::/10`
- Unique-local: `fc00::/7`
- Multicast: `ff00::/8`

#### URL Schemes
- Non-HTTPS schemes are rejected outright
- Only `https://` is permitted

### Configuration

SSRF protection is configurable via `SsrfConfig`:

```rust
pub struct SsrfConfig {
    /// When false, all checks are skipped (testing only — never in production)
    pub enabled: bool,
    /// Additional domain suffixes to block (e.g., "internal.corp")
    pub blocked_domains: Vec<String>,
    /// If non-empty, only these domains are allowed (allowlist takes priority)
    pub allowed_domains: Vec<String>,
}
```

**Production default**: enabled = true, no custom blocks or allowlist.

**Testing**: disable with `SsrfConfig { enabled: false, .. }` only in isolated test environments.

**Custom rules**: add domains to `blocked_domains` for internal registries that should not be accessed from this application. Use `allowed_domains` to whitelist only specific RDAP endpoints (e.g., `allowed_domains: vec!["rdap.arin.net", "rdap.lacnic.net"]`).

The allowlist takes absolute priority: if `allowed_domains` is non-empty, *only* those domains are accepted, regardless of IP blocks.

## Input Validation

Every query parameter is validated before any network call:

### Domain Names
- Normalized via IDNA (Internationalized Domain Names in Applications)
- IDNA conversion ensures punycode domains are handled correctly
- Empty strings rejected
- Invalid Unicode rejected during IDNA encoding

### IP Addresses
- Parsed as `std::net::IpAddr` (both IPv4 and IPv6)
- Invalid addresses rejected with `InvalidInput` error
- Private/reserved IPs are validated *after* bootstrap discovery, not blocked at the input level (see SSRF section)

### ASNs
- Parsed as u32 (0 – 4,294,967,295)
- Prefixes like "AS15169" or "as15169" are stripped before parsing
- Non-numeric values rejected

### Nameserver Hostnames
- Normalized via IDNA like domain names
- Validated to be non-empty

### Entity Handles
- Accepted as UTF-8 strings
- Validated to be non-empty
- Server URL is separately validated via SSRF guard

## No Unsafe Code

RDAPify uses `#![forbid(unsafe_code)]` across all crates. This means:
- No raw pointers
- No `unsafe` blocks of any kind
- All memory safety is guaranteed by Rust's type system
- Dependencies are audited to minimize unsafe code in transitive crates

## Rustls Rationale

TLS is implemented via `rustls` (pure Rust) instead of OpenSSL:
- **No system dependency**: eliminates OpenSSL version mismatches and CVE chains
- **Auditable**: rustls is maintained specifically for crypto safety in Rust
- **Modern**: supports TLS 1.3, hardware acceleration where available
- **Licensing**: dual Apache 2.0 / MIT, compatible with RDAPify's MIT license

## PII Awareness

RDAP responses contain Personally Identifiable Information (PII):
- Domain registrant data (name, email, phone)
- Registrar/administrative contact details
- Name server administrator information
- ISP/ASN holder contact information

### Caller Responsibilities

Callers using RDAPify must:

1. **Comply with RDAP ToS**: Each RDAP registry (ICANN, ARIN, RIPE, etc.) has Terms of Service restricting use for research, spam detection, security, and other specific purposes. Verify your use case is allowed.

2. **Handle PII appropriately**:
   - Do not log full responses to plaintext logs
   - Redact email addresses and phone numbers if recording data
   - Store cached responses only for the duration necessary
   - Honor GDPR / CCPA / similar regulation requirements

3. **User-Agent transparency**: RDAPify sends a User-Agent header identifying itself as "rdapify/[version]". Registries may use this to apply rate limits or policy. Do not disguise your client.

4. **Rate limiting**: Respect the registry's rate limits. RDAPify does not enforce global rate limiting (this is left to the application). Implement your own rate limiting in the application layer if required.

5. **Caching**: RDAPify caches responses in-memory. Ensure cache TTL is appropriate for your use case (default: no TTL in current implementation; future versions will add configurable TTL).

## Error Transparency

RdapError provides detailed information to help debug issues:

```rust
pub enum RdapError {
    InvalidInput(String),           // Input validation failed
    SsrfBlocked { url, reason },    // SSRF guard blocked the request
    InsecureScheme { scheme },      // URL is not HTTPS
    NoServerFound { query },        // No RDAP server for this TLD/IP range
    BootstrapFetch { resource, source },  // Failed to fetch bootstrap data
    Network(reqwest::Error),        // DNS, TCP, TLS, or I/O error
    HttpStatus { status, url },     // RDAP server returned error (404, 500, etc.)
    Timeout { millis, url },        // Request exceeded timeout threshold
    ParseError { reason },          // Response JSON invalid
    MissingObjectClass,             // Response missing required field
    UnknownObjectClass { class },   // Unknown RDAP object type
    Cache(String),                  // Internal cache error
    InvalidUrl { url, source },     // URL parsing failed
}
```

Error variants do not expose security-sensitive details (e.g., private IP addresses are not included in error messages).

## Responsible Disclosure

If you discover a security vulnerability in RDAPify (SSRF bypass, unsafe code, cryptographic flaw, etc.):

1. **Do not** open a public GitHub issue
2. **Do** email security@rdapify.com with:
   - Description of the vulnerability
   - Proof of concept (if applicable)
   - Affected version(s)
   - Suggested fix (if you have one)

3. **Allow 90 days** for the maintainers to release a patch before public disclosure
4. **Coordinate with maintainers** on timing and messaging

We will:
- Acknowledge receipt within 48 hours
- Provide status updates every 14 days
- Release a patch in a minor version bump
- Credit you in release notes (if desired)

## Cryptographic Considerations

RDAPify does not implement cryptographic signing or verification. RDAP responses are transmitted over HTTPS (TLS 1.3), ensuring:
- Confidentiality: encrypted in transit
- Integrity: tamper-detected by TLS
- Authenticity: server certificate validated against system CA bundle

For applications that need signed RDAP data or offline verification, implement separate signature validation above the RDAPify layer.

## Dependency Security

- **Minimal dependencies**: RDAPify uses only necessary, well-maintained crates
- **Workspace-local versions**: All crate versions pinned in `[workspace.dependencies]`
- **No wildcard versions**: Prevents surprise breaking changes
- **Audit-friendly**: The dependency graph is auditable via `cargo tree`

To audit all dependencies:
```bash
cargo tree --all-features
```

## Testing

RDAPify includes:
- **Unit tests** for input validation, SSRF guard logic, and error paths
- **Integration tests** using mocked RDAP servers (via mockito)
- **Live tests** marked `#[ignore]` (for manual testing against real IANA servers)

Tests cover:
- SSRF bypass attempts (confirming private IPs are blocked)
- Input validation edge cases (empty strings, invalid Unicode, etc.)
- Error handling paths
- Cache behavior

Run tests with:
```bash
cargo test --workspace
cargo test -- --ignored  # live tests (requires network)
```
