//! Security-layer error type.

use thiserror::Error;

/// Errors produced by the security layer.
///
/// Every outbound HTTP request that fails a security check returns one of these
/// variants. They are distinct from [`rdap_types::error::RdapError`] so that
/// callers can handle security violations separately from protocol errors.
#[derive(Debug, Error)]
pub enum SecurityError {
    // ── IP-level blocks ───────────────────────────────────────────────────────
    /// The resolved IP address falls within a blocked range (e.g., 0.0.0.0/8).
    #[error("Request blocked: IP address is in a blocked range")]
    BlockedIp,

    /// The resolved IP address is RFC 1918 / fc00::/7 private.
    #[error("Request blocked: IP address is private (RFC 1918 / fc00::/7)")]
    PrivateIp,

    /// The resolved IP address is a loopback address (127/8 or ::1).
    #[error("Request blocked: IP address is a loopback address")]
    LoopbackIp,

    /// The resolved IP address is link-local (169.254/16 or fe80::/10).
    #[error("Request blocked: IP address is link-local (169.254/16 or fe80::/10)")]
    LinkLocalIp,

    // ── URL validation ────────────────────────────────────────────────────────
    /// The URL scheme is not HTTPS (or HTTP when explicitly allowed by policy).
    #[error("Only HTTPS is allowed; got a different scheme")]
    InvalidScheme,

    /// The URL has no valid host, or the host is `localhost`.
    #[error("URL has an invalid or missing host")]
    InvalidHost,

    /// The URL contains embedded credentials (username and/or password).
    #[error("Credentials (username/password) in URLs are not allowed")]
    CredentialsInUrl,

    // ── DNS / rebinding ───────────────────────────────────────────────────────
    /// DNS resolution returned no addresses or failed.
    #[error("DNS resolution failed: {0}")]
    DnsResolutionFailed(String),

    /// The remote IP changed after the TCP connection was established,
    /// indicating a DNS rebinding attack.
    #[error("DNS rebinding detected: the remote IP changed after connection")]
    DnsRebindingDetected,

    // ── Redirect limits ───────────────────────────────────────────────────────
    /// The number of redirects exceeded `HttpSecurityPolicy::max_redirects`.
    #[error("Too many redirects")]
    TooManyRedirects,

    // ── Response limits ───────────────────────────────────────────────────────
    /// The response body exceeded `HttpSecurityPolicy::max_response_size`.
    #[error("Response body exceeds the maximum allowed size")]
    ResponseTooLarge,

    // ── Content-type ──────────────────────────────────────────────────────────
    /// The response `Content-Type` is not `application/rdap+json` or
    /// `application/json`.
    #[error("Response has an invalid or missing Content-Type header")]
    InvalidContentType,

    // ── Transport ─────────────────────────────────────────────────────────────
    /// The request did not complete within `HttpSecurityPolicy::timeout`.
    #[error("Request timed out")]
    Timeout,

    /// A network-level error occurred while sending the request or reading the
    /// response.
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),
}
