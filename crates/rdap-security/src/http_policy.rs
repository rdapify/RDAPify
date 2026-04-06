//! HTTP security policy configuration.

use std::time::Duration;

/// Policy controlling security constraints for every outbound HTTP request.
///
/// Pass this to [`crate::secure_fetch`] to customise limits. All fields are
/// public so callers can use struct-update syntax:
///
/// ```rust
/// use rdap_security::HttpSecurityPolicy;
/// use std::time::Duration;
///
/// let policy = HttpSecurityPolicy {
///     timeout: Duration::from_secs(30),
///     ..HttpSecurityPolicy::default()
/// };
/// ```
#[derive(Debug, Clone)]
pub struct HttpSecurityPolicy {
    /// Maximum time allowed for the complete request (connect + transfer).
    ///
    /// Default: **15 seconds**.
    pub timeout: Duration,

    /// Maximum number of HTTP redirects to follow before returning
    /// [`crate::error::SecurityError::TooManyRedirects`].
    ///
    /// Default: **5**.
    pub max_redirects: usize,

    /// Maximum number of bytes read from the response body before returning
    /// [`crate::error::SecurityError::ResponseTooLarge`].
    ///
    /// Default: **5 MiB** (5 × 1 024 × 1 024 bytes).
    pub max_response_size: usize,

    /// When `true` (default), only `https://` URLs are accepted.  Set to
    /// `false` only in test environments where HTTPS is unavailable.
    pub require_https: bool,
}

impl Default for HttpSecurityPolicy {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(15),
            max_redirects: 5,
            max_response_size: 5 * 1024 * 1024,
            require_https: true,
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_values() {
        let p = HttpSecurityPolicy::default();
        assert_eq!(p.timeout, Duration::from_secs(15));
        assert_eq!(p.max_redirects, 5);
        assert_eq!(p.max_response_size, 5 * 1024 * 1024);
        assert!(p.require_https);
    }

    #[test]
    fn struct_update_syntax() {
        let p = HttpSecurityPolicy {
            timeout: Duration::from_secs(30),
            ..HttpSecurityPolicy::default()
        };
        assert_eq!(p.timeout, Duration::from_secs(30));
        assert_eq!(p.max_redirects, 5);
    }
}
