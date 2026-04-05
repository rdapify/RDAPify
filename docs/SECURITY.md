# RDAPify Security Model

## Overview

RDAPify is designed for production use in environments where RDAP server queries must be strictly controlled and validated. The security model focuses on: SSRF protection, input validation, network policy, and PII handling.

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

**Custom rules**: add domains to `blocked_domains` for internal registries that should not be accessed from this application. Use `allowed_domains` to allowlist only specific RDAP endpoints (e.g., `allowed_domains: vec!["rdap.arin.net", "rdap.lacnic.net"]`).

The allowlist takes absolute priority: if `allowed_domains` is non-empty, *only* those domains are accepted, regardless of IP blocks.

## Network Policy

RDAPify enforces a strict outbound network policy for all connections:

- **HTTPS only**: All RDAP queries use HTTPS (port 443). Plain HTTP is rejected at the scheme-validation stage.
- **SSRF guard active by default**: Every URL is validated before the HTTP client opens a connection.
- **No internal network access**: Private IPv4 (RFC 1918) and IPv6 unique-local ranges are unconditionally blocked.
- **Bootstrap trust boundary**: IANA bootstrap data is fetched from `data.iana.org` only. Custom server overrides must be explicitly configured.
- **No redirect to HTTP**: HTTP redirects that downgrade from HTTPS are not followed.
- **Connection pool limits**: Per-host connection limits (default: 10) prevent inadvertent denial-of-service against RDAP registries.
- **Timeout enforcement**: Every outbound request has a configurable deadline (default: 10 seconds). Requests that exceed the deadline are cancelled, not retried indefinitely.

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

## Webhook Security

RDAPify-Pro supports outbound webhooks for domain event notifications. The following controls apply:

- **URL validation**: Webhook target URLs are validated through the same SSRF guard used for RDAP queries. Private/internal addresses cannot be used as webhook targets.
- **HTTPS required**: Only HTTPS webhook endpoints are accepted.
- **Signature verification**: Each webhook delivery is signed with an HMAC-SHA256 signature. Receivers should verify the `X-RDAPify-Signature` header before processing.
- **Retry policy**: Failed deliveries are retried with exponential backoff (max 5 attempts). After all attempts fail, the event is logged as undelivered.
- **Secrets storage**: Webhook signing secrets are stored encrypted at rest and are never returned via API after initial creation.

## License Security

License validation for RDAPify-Pro uses Ed25519 cryptographic signatures:

- **Offline-first validation**: License tokens are verified locally using the Ed25519 public key embedded in the binary. No network round-trip is required for standard validation.
- **Online activation**: Initial license activation contacts the license server to bind the license to a machine fingerprint. The activation token is signed by the signing service.
- **Tamper detection**: License tokens are structured JWTs signed with Ed25519. Any modification to the payload invalidates the signature.
- **Key hygiene**: The Ed25519 private key lives exclusively in `RDAPify-Internal/rust-services/signing-service` and is never embedded in any public artifact.
- **Revocation**: The license server can revoke licenses. Offline tokens respect a maximum 24-hour grace period before requiring re-validation.
- **No PII in tokens**: License keys encode capability flags and expiry only — never personal data.

## SQLite Security

RDAPify-Pro uses SQLite for local persistence (domain history, monitoring state, cached results):

- **File permissions**: Database file is created with `0600` permissions (owner read/write only).
- **Default location**: `$XDG_DATA_HOME/rdapify/` on Linux, platform equivalent on macOS/Windows.
- **No network exposure**: SQLite is strictly local — never exposed over a network socket.
- **Parameterized queries**: All SQL queries use bound parameters. String interpolation into SQL is forbidden.
- **WAL mode**: Write-Ahead Logging is enabled for safe concurrent access and crash recovery.
- **Encryption**: At-rest encryption is not provided by default. For sensitive environments, use filesystem-level encryption (LUKS, FileVault) or SQLCipher.
- **Migrations**: Schema migrations run at startup via embedded SQL scripts. Migrations are append-only — columns are never dropped from existing tables.
- **Sensitive fields**: API keys, tokens, and signing secrets are never stored in the SQLite database.

## PII Awareness

RDAP responses contain Personally Identifiable Information (PII):
- Domain registrant data (name, email, phone)
- Registrar/administrative contact details
- Name server administrator information
- ISP/ASN holder contact information

### Caller Responsibilities

Callers using RDAPify must:

1. **Comply with RDAP ToS**: Each RDAP registry (ICANN, ARIN, RIPE, etc.) has Terms of Service restricting use to research, spam detection, security, and other specific purposes. Verify your use case is allowed.

2. **Handle PII appropriately**:
   - Do not log full responses to plaintext logs
   - Redact email addresses and phone numbers if recording data
   - Store cached responses only for the duration necessary
   - Honor GDPR / CCPA / similar regulation requirements

3. **User-Agent transparency**: RDAPify sends a User-Agent header identifying itself as `rdapify/[version]`. Registries may use this to apply rate limits or policy. Do not disguise your client.

4. **Rate limiting**: Respect registry rate limits. RDAPify does not enforce global rate limiting — implement application-level rate limiting if required.

5. **Caching**: RDAPify caches responses in-memory. Ensure cache TTL is appropriate for your use case.

## Error Transparency

`RdapError` provides detailed information to help debug issues:

```rust
pub enum RdapError {
    InvalidInput(String),                       // Input validation failed
    SsrfBlocked { url, reason },                // SSRF guard blocked the request
    InsecureScheme { scheme },                  // URL is not HTTPS
    NoServerFound { query },                    // No RDAP server for this TLD/IP range
    BootstrapFetch { resource, source },        // Failed to fetch bootstrap data
    Network(reqwest::Error),                    // DNS, TCP, TLS, or I/O error
    HttpStatus { status, url },                 // RDAP server returned error (404, 500, etc.)
    Timeout { millis, url },                    // Request exceeded timeout threshold
    ParseError { reason },                      // Response JSON invalid
    MissingObjectClass,                         // Response missing required field
    UnknownObjectClass { class },               // Unknown RDAP object type
    Cache(String),                              // Internal cache error
    InvalidUrl { url, source },                 // URL parsing failed
}
```

Error variants do not expose security-sensitive details (e.g., private IP addresses are not included in error messages).

## Dependency Security

- **Minimal dependencies**: RDAPify uses only necessary, well-maintained crates
- **Workspace-local versions**: All crate versions pinned in `[workspace.dependencies]`
- **No wildcard versions**: Prevents surprise breaking changes
- **Audit-friendly**: The dependency graph is auditable via `cargo tree`

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

```bash
cargo test --workspace
cargo test -- --ignored  # live tests (requires network)
```

## Responsible Disclosure

If you discover a security vulnerability in RDAPify (SSRF bypass, unsafe code, cryptographic flaw, etc.):

1. **Do not** open a public GitHub issue
2. **Email** security@rdapify.com with:
   - Description of the vulnerability
   - Proof of concept (if applicable)
   - Affected version(s)
   - Suggested fix (if you have one)
3. **Allow 90 days** for the maintainers to release a patch before public disclosure
4. **Coordinate** with maintainers on timing and messaging

We will:
- Acknowledge receipt within 48 hours
- Provide status updates every 14 days
- Release a patch in a minor version bump
- Credit you in release notes (if desired)

## Security Contact

| | |
|---|---|
| **Email** | security@rdapify.com |
| **Response SLA** | Acknowledgement within 48 hours |
| **Status updates** | Every 14 days |
| **Disclosure policy** | 90-day coordinated disclosure |
| **PGP key** | Available on request via email |

Do not open public GitHub issues for security vulnerabilities.
