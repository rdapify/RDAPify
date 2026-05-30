//! Error types for the rdapify library.
//!
//! All public-facing errors implement `std::error::Error` via `thiserror`.
//! The [`RdapError`] enum is the single error type returned by every public API.

use std::time::Duration;

use thiserror::Error;

/// The unified error type for all rdapify operations.
///
/// # Examples
///
/// ```rust
/// use rdap_types::RdapError;
///
/// fn handle(err: RdapError) {
///     match err {
///         RdapError::InvalidInput(msg) => eprintln!("Bad input: {msg}"),
///         RdapError::NoServerFound { query } => eprintln!("No RDAP server for: {query}"),
///         RdapError::Network(e) => eprintln!("Network error: {e}"),
///         _ => {}
///     }
/// }
/// ```
#[derive(Debug, Error)]
pub enum RdapError {
    // ── Input validation ──────────────────────────────────────────────────────
    /// The supplied domain name, IP address, or ASN is not valid.
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    // ── SSRF protection ───────────────────────────────────────────────────────
    /// The resolved URL targets a private, loopback, or link-local address.
    #[error("SSRF protection blocked request to {url}: {reason}")]
    SsrfBlocked {
        /// The URL that was blocked.
        url: String,
        /// Explanation of why the address was blocked.
        reason: String,
    },

    /// The URL scheme is not HTTPS.
    #[error("Only HTTPS is allowed, got: {scheme}")]
    InsecureScheme {
        /// The disallowed scheme (e.g., "http").
        scheme: String,
    },

    // ── Bootstrap (IANA server discovery) ────────────────────────────────────
    /// No RDAP server was found for the given TLD / IP range / ASN range.
    #[error("No RDAP server found for: {query}")]
    NoServerFound {
        /// The query string for which no server was found.
        query: String,
    },

    /// The IANA bootstrap file could not be fetched or parsed.
    #[error("Bootstrap fetch failed for {resource}: {source}")]
    BootstrapFetch {
        /// The bootstrap resource type (e.g., "dns", "asn", "ipv4").
        resource: String,
        /// The underlying error that caused the bootstrap failure.
        #[source]
        source: Box<RdapError>,
    },

    // ── Network & HTTP ────────────────────────────────────────────────────────
    /// A network-level error occurred (DNS, TCP, TLS, timeout).
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    /// The RDAP server returned an HTTP error status.
    #[error("RDAP server returned HTTP {status} for {url}")]
    HttpStatus {
        /// The HTTP status code returned by the server.
        status: u16,
        /// The URL that returned the error status.
        url: String,
    },

    /// The request did not complete within the configured timeout.
    #[error("Request timed out after {millis}ms: {url}")]
    Timeout {
        /// The configured timeout budget, in milliseconds, that was exceeded.
        millis: u64,
        /// The URL that timed out.
        url: String,
    },

    // ── Response parsing ──────────────────────────────────────────────────────
    /// The response JSON could not be deserialized into a known RDAP type.
    #[error("Failed to parse RDAP response: {reason}")]
    ParseError {
        /// Description of the parse failure.
        reason: String,
    },

    /// The response is missing a required `objectClassName` field.
    #[error("RDAP response missing objectClassName")]
    MissingObjectClass,

    /// The response contains an `objectClassName` that this client does not
    /// recognise.
    #[error("Unknown RDAP objectClassName: {class}")]
    UnknownObjectClass {
        /// The unrecognised `objectClassName` value.
        class: String,
    },

    // ── Cache ─────────────────────────────────────────────────────────────────
    /// An internal cache operation failed (should be rare).
    #[error("Cache error: {0}")]
    Cache(String),

    // ── URL utilities ─────────────────────────────────────────────────────────
    /// A URL could not be parsed.
    #[error("Invalid URL '{url}': {source}")]
    InvalidUrl {
        /// The URL string that could not be parsed.
        url: String,
        /// The underlying URL parse error.
        #[source]
        source: url::ParseError,
    },

    // ── Rate limiting ─────────────────────────────────────────────────────────
    /// The outbound RDAP request was rejected by the local rate limiter.
    ///
    /// The caller should retry after `wait_time` has elapsed.
    #[error("Rate limited for {host}: retry after {wait_time:?}")]
    RateLimited {
        /// The hostname for which the rate limit applies.
        host: String,
        /// Duration the caller should wait before retrying.
        wait_time: Duration,
    },

    // ── Circuit breaker ───────────────────────────────────────────────────────
    /// The per-origin circuit breaker is open and rejected the call without
    /// contacting the upstream. The breaker re-tries the upstream after its
    /// cooldown elapses; callers should not retry this error directly.
    #[error("Circuit breaker open for {origin}; upstream presumed unhealthy")]
    CircuitOpen {
        /// The origin (hostname) whose circuit breaker is open.
        origin: String,
    },
}

impl RdapError {
    /// Returns an HTTP-like status code for the error, suitable for
    /// surfacing through FFI or REST bindings.
    pub fn status_code(&self) -> u16 {
        match self {
            RdapError::InvalidInput(_) => 400,
            RdapError::SsrfBlocked { .. } => 403,
            RdapError::InsecureScheme { .. } => 403,
            RdapError::NoServerFound { .. } => 404,
            RdapError::HttpStatus { status, .. } => *status,
            RdapError::Timeout { .. } => 408,
            RdapError::RateLimited { .. } => 429,
            RdapError::Network(_) => 502,
            RdapError::BootstrapFetch { .. } => 502,
            RdapError::ParseError { .. } => 500,
            RdapError::MissingObjectClass => 500,
            RdapError::UnknownObjectClass { .. } => 500,
            RdapError::Cache(_) => 500,
            RdapError::InvalidUrl { .. } => 400,
            RdapError::CircuitOpen { .. } => 503,
        }
    }

    /// Returns `true` if the error was generated by the local circuit breaker.
    pub fn is_circuit_open(&self) -> bool {
        matches!(self, RdapError::CircuitOpen { .. })
    }

    /// Returns `true` if the error is caused by invalid user input.
    pub fn is_invalid_input(&self) -> bool {
        matches!(self, RdapError::InvalidInput(_))
    }

    /// Returns `true` if the error is a network-level failure.
    pub fn is_network(&self) -> bool {
        matches!(
            self,
            RdapError::Network(_) | RdapError::Timeout { .. } | RdapError::HttpStatus { .. }
        )
    }

    /// Returns `true` if the request was blocked by SSRF protection.
    pub fn is_ssrf_blocked(&self) -> bool {
        matches!(
            self,
            RdapError::SsrfBlocked { .. } | RdapError::InsecureScheme { .. }
        )
    }

    /// Returns `true` if the request was rejected by the local rate limiter.
    pub fn is_rate_limited(&self) -> bool {
        matches!(self, RdapError::RateLimited { .. })
    }
}

/// Convenience alias used throughout the crate.
pub type Result<T> = std::result::Result<T, RdapError>;
