//! HTTP fetcher — issues RDAP requests and returns validated JSON values.
//!
//! All URLs are validated by the [`SsrfGuard`] before the request is sent.
//! Response bodies are size-limited via [`rdap_security::read_limited`] and
//! then passed through the [`crate::validation`] layer before any `serde`
//! deserialization takes place.  Retry logic with exponential back-off is
//! built in.

use std::time::Duration;

use serde_json::Value;

use rdap_security::{read_limited, SecurityError, SsrfGuard};
use rdap_types::error::{RdapError, Result};

use crate::validation::{validate_rdap_response, RdapValidationLimits};

/// Configuration for the HTTP fetcher.
#[derive(Debug, Clone)]
pub struct FetcherConfig {
    /// Per-request timeout.
    pub timeout: Duration,
    /// `User-Agent` header value.
    pub user_agent: String,
    /// Maximum number of retry attempts (1 = no retries).
    pub max_attempts: u32,
    /// Initial back-off delay before the first retry.
    pub initial_backoff: Duration,
    /// Maximum back-off delay cap.
    pub max_backoff: Duration,
    /// Keep TCP connections alive for reuse.
    pub reuse_connections: bool,
    /// Maximum number of idle keep-alive connections per host.
    pub max_connections_per_host: usize,
    /// Structural and RDAP-specific limits applied to every response before
    /// deserialization.  Adjust to tighten or relax validation.
    pub validation_limits: RdapValidationLimits,
}

impl Default for FetcherConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(10),
            user_agent: format!(
                "rdapify/{} (https://rdapify.com)",
                env!("CARGO_PKG_VERSION")
            ),
            max_attempts: 3,
            initial_backoff: Duration::from_millis(500),
            max_backoff: Duration::from_secs(8),
            reuse_connections: true,
            max_connections_per_host: 10,
            validation_limits: RdapValidationLimits::default(),
        }
    }
}

/// HTTP fetcher with SSRF protection and retry logic.
#[derive(Debug, Clone)]
pub struct Fetcher {
    client: reqwest::Client,
    ssrf: SsrfGuard,
    config: FetcherConfig,
}

impl Fetcher {
    /// Creates a fetcher using the default configuration.
    pub fn new(ssrf: SsrfGuard) -> Result<Self> {
        Self::with_config(ssrf, FetcherConfig::default())
    }

    /// Creates a fetcher with a custom configuration.
    pub fn with_config(ssrf: SsrfGuard, config: FetcherConfig) -> Result<Self> {
        let tcp_keepalive = if config.reuse_connections {
            Some(Duration::from_secs(60))
        } else {
            None
        };

        let client = reqwest::Client::builder()
            .timeout(config.timeout)
            .user_agent(&config.user_agent)
            .use_rustls_tls()
            .gzip(true)
            .tcp_keepalive(tcp_keepalive)
            .pool_max_idle_per_host(config.max_connections_per_host)
            .build()
            .map_err(RdapError::Network)?;

        Ok(Self {
            client,
            ssrf,
            config,
        })
    }

    /// Fetches and deserialises a JSON response from `url`.
    ///
    /// Validates the URL with the SSRF guard before sending, and retries on
    /// transient network errors using exponential back-off.
    pub async fn fetch(&self, url: &str) -> Result<Value> {
        self.ssrf.validate(url)?;

        let mut attempt = 0u32;
        loop {
            attempt += 1;
            match self.do_fetch(url).await {
                Ok(value) => return Ok(value),
                Err(err) if attempt < self.config.max_attempts && is_retryable(&err) => {
                    let delay = backoff(
                        attempt,
                        self.config.initial_backoff,
                        self.config.max_backoff,
                    );
                    tokio::time::sleep(delay).await;
                }
                Err(err) => return Err(err),
            }
        }
    }

    async fn do_fetch(&self, url: &str) -> Result<Value> {
        let response = self
            .client
            .get(url)
            .header("Accept", "application/rdap+json, application/json")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    RdapError::Timeout {
                        millis: self.config.timeout.as_millis() as u64,
                        url: url.to_string(),
                    }
                } else {
                    RdapError::Network(e)
                }
            })?;

        let status = response.status();

        if !status.is_success() {
            return Err(RdapError::HttpStatus {
                status: status.as_u16(),
                url: url.to_string(),
            });
        }

        // ── Step 1: read body with a hard size cap ────────────────────────────
        // read_limited streams the body in chunks and aborts as soon as the
        // accumulated size exceeds max_json_size, preventing memory exhaustion.
        let bytes = read_limited(response, self.config.validation_limits.max_json_size)
            .await
            .map_err(|e| match e {
                SecurityError::ResponseTooLarge => RdapError::ParseError {
                    reason: "RDAP response body exceeds the maximum allowed size".to_string(),
                },
                SecurityError::Network(inner) => RdapError::Network(inner),
                other => RdapError::ParseError {
                    reason: other.to_string(),
                },
            })?;

        // ── Step 2: validate structure + RDAP fields, then return the Value ──
        // Only the Value returned here is ever passed to serde; raw bytes are
        // never deserialized directly into RDAP structs.
        validate_rdap_response(&bytes, &self.config.validation_limits).map_err(RdapError::from)
    }

    /// Exposes the inner `reqwest::Client` so `Bootstrap` can reuse it.
    pub fn reqwest_client(&self) -> reqwest::Client {
        self.client.clone()
    }
}

// ── Retry utilities ───────────────────────────────────────────────────────────

fn is_retryable(err: &RdapError) -> bool {
    match err {
        RdapError::Network(_) | RdapError::Timeout { .. } => true,
        RdapError::HttpStatus { status, .. } => {
            matches!(status, 429 | 500 | 502 | 503 | 504)
        }
        _ => false,
    }
}

fn backoff(attempt: u32, initial: Duration, max: Duration) -> Duration {
    let millis = initial.as_millis() as u64 * 2u64.saturating_pow(attempt - 1);
    Duration::from_millis(millis).min(max)
}

#[cfg(test)]
mod tests {
    use super::{backoff, is_retryable, Fetcher, FetcherConfig};
    use rdap_security::{SsrfConfig, SsrfGuard};
    use rdap_types::error::RdapError;
    use std::time::Duration;

    #[test]
    fn backoff_grows_exponentially() {
        let base = Duration::from_millis(500);
        let cap = Duration::from_secs(8);
        assert_eq!(backoff(1, base, cap), Duration::from_millis(500));
        assert_eq!(backoff(2, base, cap), Duration::from_millis(1000));
        assert_eq!(backoff(3, base, cap), Duration::from_millis(2000));
        assert_eq!(backoff(4, base, cap), Duration::from_millis(4000));
        assert_eq!(backoff(5, base, cap), Duration::from_millis(8000));
        assert_eq!(backoff(6, base, cap), Duration::from_secs(8));
    }

    #[test]
    fn backoff_saturates_on_very_large_attempt() {
        let base = Duration::from_millis(1);
        let cap = Duration::from_secs(30);
        let result = backoff(64, base, cap);
        assert_eq!(result, cap);
    }

    #[test]
    fn retryable_http_statuses() {
        for status in [429u16, 500, 502, 503, 504] {
            let err = RdapError::HttpStatus {
                status,
                url: "https://example.com/".to_string(),
            };
            assert!(is_retryable(&err));
        }
    }

    #[test]
    fn non_retryable_http_statuses() {
        for status in [400u16, 401, 403, 404, 422] {
            let err = RdapError::HttpStatus {
                status,
                url: "https://example.com/".to_string(),
            };
            assert!(!is_retryable(&err));
        }
    }

    #[test]
    fn default_config_values() {
        let cfg = FetcherConfig::default();
        assert_eq!(cfg.timeout, Duration::from_secs(10));
        assert_eq!(cfg.max_attempts, 3);
        assert!(cfg.user_agent.starts_with("rdapify/"));
    }

    #[tokio::test]
    async fn fetch_rejects_ssrf_before_network() {
        let ssrf = SsrfGuard::new();
        let fetcher = Fetcher::new(ssrf).unwrap();
        let err = fetcher.fetch("https://192.168.1.1/rdap").await.unwrap_err();
        assert!(matches!(err, RdapError::SsrfBlocked { .. }));
    }

    #[tokio::test]
    async fn fetch_rejects_http_scheme() {
        let ssrf = SsrfGuard::new();
        let fetcher = Fetcher::new(ssrf).unwrap();
        let err = fetcher.fetch("http://example.com/rdap").await.unwrap_err();
        assert!(matches!(err, RdapError::InsecureScheme { .. }));
    }

    fn disabled_ssrf_fetcher() -> Fetcher {
        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                ..Default::default()
            },
        )
        .unwrap()
    }

    #[tokio::test]
    async fn fetch_returns_parsed_json_on_200() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/rdap/domain")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(r#"{"objectClassName":"domain","ldhName":"EXAMPLE.COM"}"#)
            .create_async()
            .await;

        let url = format!("{}/rdap/domain", server.url());
        let result = disabled_ssrf_fetcher().fetch(&url).await.unwrap();
        assert_eq!(result["ldhName"], "EXAMPLE.COM");
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn fetch_returns_http_status_error_on_404() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/rdap/missing")
            .with_status(404)
            .with_body("{}")
            .create_async()
            .await;

        let url = format!("{}/rdap/missing", server.url());
        let err = disabled_ssrf_fetcher().fetch(&url).await.unwrap_err();
        assert!(matches!(err, RdapError::HttpStatus { status: 404, .. }));
        mock.assert_async().await;
    }
}
