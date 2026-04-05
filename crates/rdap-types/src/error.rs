//! Error types for the rdapify library.
//!
//! All public-facing errors implement `std::error::Error` via `thiserror`.
//! The [`RdapError`] enum is the single error type returned by every public API.

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
    SsrfBlocked { url: String, reason: String },

    /// The URL scheme is not HTTPS.
    #[error("Only HTTPS is allowed, got: {scheme}")]
    InsecureScheme { scheme: String },

    // ── Bootstrap (IANA server discovery) ────────────────────────────────────
    /// No RDAP server was found for the given TLD / IP range / ASN range.
    #[error("No RDAP server found for: {query}")]
    NoServerFound { query: String },

    /// The IANA bootstrap file could not be fetched or parsed.
    #[error("Bootstrap fetch failed for {resource}: {source}")]
    BootstrapFetch {
        resource: String,
        #[source]
        source: Box<RdapError>,
    },

    // ── Network & HTTP ────────────────────────────────────────────────────────
    /// A network-level error occurred (DNS, TCP, TLS, timeout).
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    /// The RDAP server returned an HTTP error status.
    #[error("RDAP server returned HTTP {status} for {url}")]
    HttpStatus { status: u16, url: String },

    /// The request did not complete within the configured timeout.
    #[error("Request timed out after {millis}ms: {url}")]
    Timeout { millis: u64, url: String },

    // ── Response parsing ──────────────────────────────────────────────────────
    /// The response JSON could not be deserialized into a known RDAP type.
    #[error("Failed to parse RDAP response: {reason}")]
    ParseError { reason: String },

    /// The response is missing a required `objectClassName` field.
    #[error("RDAP response missing objectClassName")]
    MissingObjectClass,

    /// The response contains an `objectClassName` that this client does not
    /// recognise.
    #[error("Unknown RDAP objectClassName: {class}")]
    UnknownObjectClass { class: String },

    // ── Cache ─────────────────────────────────────────────────────────────────
    /// An internal cache operation failed (should be rare).
    #[error("Cache error: {0}")]
    Cache(String),

    // ── URL utilities ─────────────────────────────────────────────────────────
    /// A URL could not be parsed.
    #[error("Invalid URL '{url}': {source}")]
    InvalidUrl {
        url: String,
        #[source]
        source: url::ParseError,
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
            RdapError::Network(_) => 502,
            RdapError::BootstrapFetch { .. } => 502,
            RdapError::ParseError { .. } => 500,
            RdapError::MissingObjectClass => 500,
            RdapError::UnknownObjectClass { .. } => 500,
            RdapError::Cache(_) => 500,
            RdapError::InvalidUrl { .. } => 400,
        }
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
}

/// Convenience alias used throughout the crate.
pub type Result<T> = std::result::Result<T, RdapError>;
