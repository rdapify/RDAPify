//! Stage D · D4 — canonical error classification.
//!
//! Single source of truth for mapping every [`RdapError`] variant onto a
//! coarse semantic class. Used in three places:
//!
//! 1. **Metrics labels** — [`ErrorClass::metric_label`] / [`RetryClass::metric_label`]
//!    are stable `&'static str` values used as the `class` label on
//!    `rdap_errors_total` and `rdap_retry_total`.
//! 2. **Tracing fields** — emitted as the `error_class` / `retry_class` field
//!    on `rdap.fetch` spans. The same string flows through both surfaces so
//!    a metric and a log line can be correlated by class.
//! 3. **Engine logic** — the same enums could (in a future refactor) drive
//!    `retry_limit()` and `is_breaker_failure()`. For now those two helpers
//!    live in `fetcher.rs` and are kept consistent by colocation.
//!
//! Adding a new error class is a deliberate change. The label values are part
//! of the public Prometheus contract (D-008 in `RDAPify-Internal/DECISIONS.md`)
//! — renaming a variant breaks dashboards.

use rdap_types::error::RdapError;

/// Coarse semantic class of an error returned to the caller.
#[derive(Copy, Clone, Eq, PartialEq, Debug, Hash)]
pub enum ErrorClass {
    /// Transport-level failure (DNS, TCP, TLS, broken pipe).
    Network,
    /// Per-request timeout fired before any response arrived.
    Timeout,
    /// Server returned 429 — back off and retry, but treat as healthy.
    RateLimited,
    /// Server replied with a non-success status that is not 429 (typically
    /// 4xx) **or** the response body failed validation.
    InvalidResponse,
    /// The local circuit breaker short-circuited the request.
    CircuitOpen,
    /// Internal engine error (bug, exhausted resource, unexpected state).
    Internal,
}

impl ErrorClass {
    /// Stable label string — part of the Prometheus contract. Don't rename
    /// without bumping the major version and updating dashboards.
    pub const fn metric_label(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::Timeout => "timeout",
            Self::RateLimited => "rate_limited",
            Self::InvalidResponse => "invalid_response",
            Self::CircuitOpen => "circuit_open",
            Self::Internal => "internal",
        }
    }
}

impl std::fmt::Display for ErrorClass {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.metric_label())
    }
}

/// Coarse class of failure that triggered a *retry attempt*. Distinct from
/// [`ErrorClass`] because the retry counter cares about HTTP status banding
/// (4xx vs 5xx) more than about network-vs-timeout distinctions, and it
/// excludes `CircuitOpen` and `Internal` (which never retry).
#[derive(Copy, Clone, Eq, PartialEq, Debug, Hash)]
pub enum RetryClass {
    Network,
    Timeout,
    RateLimited,
    Http5xx,
    Http4xx,
}

impl RetryClass {
    pub const fn metric_label(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::Timeout => "timeout",
            Self::RateLimited => "rate_limited",
            Self::Http5xx => "http_5xx",
            Self::Http4xx => "http_4xx",
        }
    }
}

impl std::fmt::Display for RetryClass {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.metric_label())
    }
}

/// Maps any [`RdapError`] onto its [`ErrorClass`].
///
/// **Exhaustive on purpose** — every `RdapError` variant has an explicit arm.
/// No `_` wildcard, so adding a new variant to `RdapError` produces a compile
/// error here, forcing a deliberate classification choice. A silent miscarriage
/// into `Internal` was the bug we hit in the first review pass.
pub fn classify_error(err: &RdapError) -> ErrorClass {
    match err {
        // Transport-class
        RdapError::Network(_) => ErrorClass::Network,
        RdapError::Timeout { .. } => ErrorClass::Timeout,

        // Rate-limit signals — both server-side (429) and client-side
        // (the engine's own `RdapRateLimiter` rejection) collapse to one
        // bucket so dashboards show a single "rate-limited" rate.
        RdapError::HttpStatus { status: 429, .. } => ErrorClass::RateLimited,
        RdapError::RateLimited { .. } => ErrorClass::RateLimited,

        // Other HTTP errors are upstream answers — bad responses, not
        // internal engine faults.
        RdapError::HttpStatus { .. } => ErrorClass::InvalidResponse,

        // Local breaker
        RdapError::CircuitOpen { .. } => ErrorClass::CircuitOpen,

        // Security / validation rejections — invalid input from caller or
        // upstream. Counted as `invalid_response` so they show up alongside
        // upstream 4xx in dashboards.
        RdapError::SsrfBlocked { .. } => ErrorClass::InvalidResponse,
        RdapError::InsecureScheme { .. } => ErrorClass::InvalidResponse,
        RdapError::ParseError { .. } => ErrorClass::InvalidResponse,
        RdapError::InvalidInput(_) => ErrorClass::InvalidResponse,
        RdapError::InvalidUrl { .. } => ErrorClass::InvalidResponse,
        RdapError::MissingObjectClass => ErrorClass::InvalidResponse,
        RdapError::UnknownObjectClass { .. } => ErrorClass::InvalidResponse,

        // Engine-internal failures — bootstrap path, cache backend, or
        // routing logic. Operators care about these because they indicate
        // the engine itself is the bottleneck, not a remote registry.
        RdapError::NoServerFound { .. } => ErrorClass::Internal,
        RdapError::BootstrapFetch { .. } => ErrorClass::Internal,
        RdapError::Cache(_) => ErrorClass::Internal,
    }
}

/// Maps an [`RdapError`] that triggered a retry onto its [`RetryClass`].
///
/// Caller is responsible for only invoking this on errors that the retry
/// logic actually retried — non-retryable variants (`CircuitOpen`,
/// validation failures, etc.) fall back to `Http4xx`, which is benign for
/// metrics but indicates a bug in the caller's gating logic.
pub fn classify_retry(err: &RdapError) -> RetryClass {
    match err {
        RdapError::Network(_) => RetryClass::Network,
        RdapError::Timeout { .. } => RetryClass::Timeout,
        RdapError::HttpStatus { status: 429, .. } => RetryClass::RateLimited,
        RdapError::HttpStatus { status, .. } if *status >= 500 => RetryClass::Http5xx,
        RdapError::HttpStatus { .. } => RetryClass::Http4xx,
        _ => RetryClass::Http4xx,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn http(status: u16) -> RdapError {
        RdapError::HttpStatus {
            status,
            url: "https://x/".to_string(),
        }
    }

    #[test]
    fn metric_labels_are_stable_lowercase_strings() {
        // The metric label values are part of the Prometheus contract.
        // Changing any of these is a major-version break.
        assert_eq!(ErrorClass::Network.metric_label(), "network");
        assert_eq!(ErrorClass::Timeout.metric_label(), "timeout");
        assert_eq!(ErrorClass::RateLimited.metric_label(), "rate_limited");
        assert_eq!(
            ErrorClass::InvalidResponse.metric_label(),
            "invalid_response"
        );
        assert_eq!(ErrorClass::CircuitOpen.metric_label(), "circuit_open");
        assert_eq!(ErrorClass::Internal.metric_label(), "internal");

        assert_eq!(RetryClass::Network.metric_label(), "network");
        assert_eq!(RetryClass::Timeout.metric_label(), "timeout");
        assert_eq!(RetryClass::RateLimited.metric_label(), "rate_limited");
        assert_eq!(RetryClass::Http5xx.metric_label(), "http_5xx");
        assert_eq!(RetryClass::Http4xx.metric_label(), "http_4xx");
    }

    #[test]
    fn classify_error_handles_client_side_rate_limit_explicitly() {
        // Regression for the D2-review finding: engine-side `RateLimited`
        // (returned by the rate limiter when the budget is exhausted) must
        // map to `RateLimited`, not silently fall into `Internal`.
        let err = RdapError::RateLimited {
            host: "rdap.example".into(),
            wait_time: std::time::Duration::from_millis(500),
        };
        assert_eq!(classify_error(&err), ErrorClass::RateLimited);
    }

    #[test]
    fn classify_error_engine_internal_paths_classified_as_internal() {
        // Bootstrap and cache failures are engine-internal; counted under
        // `internal` so an outbreak shows the engine itself is the issue.
        assert_eq!(
            classify_error(&RdapError::NoServerFound { query: "x".into() }),
            ErrorClass::Internal
        );
        assert_eq!(
            classify_error(&RdapError::Cache("disk full".into())),
            ErrorClass::Internal
        );
    }

    #[test]
    fn classify_error_covers_all_engine_error_variants() {
        // Network-class errors are mapped indirectly via reqwest; assert the
        // explicit `Timeout` arm is correct since `Network` requires a real
        // `reqwest::Error` value.
        assert_eq!(
            classify_error(&RdapError::Timeout {
                millis: 0,
                url: "x".into()
            }),
            ErrorClass::Timeout
        );
        assert_eq!(classify_error(&http(429)), ErrorClass::RateLimited);
        assert_eq!(classify_error(&http(500)), ErrorClass::InvalidResponse);
        assert_eq!(classify_error(&http(404)), ErrorClass::InvalidResponse);
        assert_eq!(
            classify_error(&RdapError::CircuitOpen {
                origin: "https://x:443".into()
            }),
            ErrorClass::CircuitOpen
        );
        assert_eq!(
            classify_error(&RdapError::ParseError {
                reason: "bad".into()
            }),
            ErrorClass::InvalidResponse
        );
        assert_eq!(
            classify_error(&RdapError::InvalidInput("bad".into())),
            ErrorClass::InvalidResponse
        );
    }

    #[test]
    fn classify_retry_buckets_http_status_into_4xx_5xx() {
        assert_eq!(classify_retry(&http(429)), RetryClass::RateLimited);
        assert_eq!(classify_retry(&http(500)), RetryClass::Http5xx);
        assert_eq!(classify_retry(&http(503)), RetryClass::Http5xx);
        assert_eq!(classify_retry(&http(404)), RetryClass::Http4xx);
        assert_eq!(
            classify_retry(&RdapError::Timeout {
                millis: 0,
                url: "x".into()
            }),
            RetryClass::Timeout
        );
    }

    #[test]
    fn display_matches_metric_label() {
        // Display is what tracing's `%` formatter uses — the field value in
        // a log line must match the Prometheus label exactly so an operator
        // can pivot from a metric query to a log search by copy-paste.
        assert_eq!(format!("{}", ErrorClass::CircuitOpen), "circuit_open");
        assert_eq!(format!("{}", RetryClass::Http5xx), "http_5xx");
    }
}
