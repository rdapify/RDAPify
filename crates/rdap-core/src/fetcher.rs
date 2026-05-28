//! HTTP fetcher — issues RDAP requests and returns validated JSON values.
//!
//! All URLs are validated by the [`SsrfGuard`] before the request is sent.
//! Response bodies are size-limited via [`rdap_security::read_limited`] and
//! then passed through the [`crate::validation`] layer before any `serde`
//! deserialization takes place.
//!
//! # Retry strategy
//!
//! | Error kind       | Max extra attempts | Notes                        |
//! |------------------|--------------------|------------------------------|
//! | Network / I/O    | 2                  | Exponential back-off         |
//! | Timeout          | 1                  | Single retry, then fail fast |
//! | 429 Rate-limited | 2                  | Exponential back-off         |
//! | 500 Internal     | 2                  | Exponential back-off         |
//! | 502/503/504      | 2                  | Exponential back-off         |
//! | 4xx client error | 0                  | Not retried                  |
//!
//! The full per-request timeout (default 10 s) is enforced by the underlying
//! HTTP client. Requests slower than
//! [`FetcherConfig::slow_request_threshold`] (default 500 ms) are counted in
//! `rdap_slow_requests_total` and — when tracing is sampled in — emit one
//! `info`-level event with a redacted origin.

use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use reqwest::header::{CACHE_CONTROL, RETRY_AFTER};
use serde_json::Value;
use tokio::sync::Semaphore;

use rdap_security::{read_limited, SecurityError, SsrfGuard};
use rdap_types::error::{RdapError, Result};

use crate::circuit_breaker::{CircuitBreakerRegistry, Origin};
use crate::validation::{validate_rdap_response, RdapValidationLimits};

// Stage D · D1/D2/D3 — observability. Hook calls compile to inline no-ops
// unless the `metrics` feature is enabled. Tracing spans are gated by
// per-call sampling and elide cheaply when the global subscriber has no
// interest in `rdap.fetch`.
use rdap_metrics::hooks as metrics_hooks;
use rdap_metrics::redact;
use rdap_metrics::sampling;

use crate::error_class::{classify_error, classify_retry};

/// Hard ceiling on `Retry-After` honoring. A malicious or misconfigured
/// server cannot park the client on a longer sleep than this.
const RETRY_AFTER_MAX: Duration = Duration::from_secs(60);

/// Default cap on the number of simultaneously-open upstream HTTP requests
/// across all fetchers sharing a registry. Tuned for typical RDAP workloads;
/// override via [`FetcherConfig::concurrency_limit`].
pub const DEFAULT_UPSTREAM_CONCURRENCY: usize = 256;

/// Default slow-request threshold (Stage D · D3). Requests whose total
/// elapsed time exceeds this duration are counted in
/// `rdap_slow_requests_total` and — when tracing is sampled in — emit one
/// structured `info`-level event. Override via
/// [`FetcherConfig::slow_request_threshold`].
pub const DEFAULT_SLOW_REQUEST_THRESHOLD: Duration = Duration::from_millis(500);

/// Default per-request timeout (Stage F · F1).
///
/// 5 s is the upper end of the production-safe window: long enough to
/// absorb the normal RTT to a real RDAP registry plus one TLS handshake
/// (~200–800 ms) and tail-latency from response parsing, short enough
/// that a single broken upstream cannot park resources for many seconds.
/// Operators with stricter SLOs can lower this; the
/// [validator](FetcherConfig::validate) caps it at
/// [`MAX_TIMEOUT`] to prevent accidentally disabling the protection.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(5);

/// Hard upper bound on the per-request timeout the validator will accept
/// (Stage F · F2). Anything above this is treated as a misconfiguration
/// and rejected — a 60 s timeout in front of an unhealthy upstream lets
/// failed calls hold permits and breaker state for a minute, which is
/// indistinguishable from "no timeout" under load.
pub const MAX_TIMEOUT: Duration = Duration::from_secs(30);

/// Hard upper bound on `max_attempts` accepted by the validator. Three
/// is the default; ten is the absolute ceiling — beyond that the retry
/// budget itself becomes a self-DoS vector.
pub const MAX_ATTEMPTS_CEILING: u32 = 10;

/// Hard upper bound on `concurrency_limit`. 4096 is a generous ceiling
/// for an in-process engine; concurrent upstream requests beyond that
/// run into the OS file-descriptor limit and the breaker registry's
/// useful working set saturates.
pub const MAX_CONCURRENCY_LIMIT: usize = 4096;

/// Default per-host concurrency cap (v0.6.1 · Task 1).
///
/// 16 simultaneous attempts against any single upstream origin. Sized
/// around typical RDAP registry behaviour: most registries comfortably
/// accept ~ 10 concurrent queries; ~ 16 is a small safety margin without
/// noticeably reducing throughput on multi-TLD workloads.
///
/// Set [`FetcherConfig::per_host_concurrency_limit`] to `None` to disable
/// per-host gating entirely (for example, in synthetic single-origin
/// load tests). Production deployments fanning across many TLDs should
/// keep the default.
pub const DEFAULT_PER_HOST_CONCURRENCY: usize = 16;

/// Hard cap on the number of distinct origins tracked by the per-host
/// semaphore registry. Bounded LRU-style admission via DashMap with a
/// soft ceiling: when the map is at capacity, new origins bypass the
/// per-host gate (fail-open) — the global semaphore still bounds them.
///
/// The same 1 024 figure is used for the circuit-breaker registry; the
/// two structures are sibling per-origin caches and we keep the cap
/// aligned so an attacker can't blow either one up while the other holds.
pub const PER_HOST_REGISTRY_CAPACITY: usize = 1024;

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
    /// Maximum number of simultaneously-open upstream HTTP requests.
    /// Permits are acquired per HTTP attempt and released as soon as the
    /// attempt completes — backoff sleeps do not hold a permit. Defaults
    /// to [`DEFAULT_UPSTREAM_CONCURRENCY`].
    pub concurrency_limit: usize,
    /// v0.6.1 · Task 1 — per-host concurrency cap. When `Some(n)`, at most
    /// `n` simultaneous attempts can target any single origin (`scheme://host:port`).
    /// Stacks under the global [`concurrency_limit`](Self::concurrency_limit):
    /// a request acquires the per-host permit first (so a slow host can't
    /// occupy global permits while waiting for its own quota), then the
    /// global permit. `None` disables per-host gating; the global cap
    /// alone applies.
    ///
    /// Default: `Some(`[`DEFAULT_PER_HOST_CONCURRENCY`]`)`. Set to `None` for
    /// synthetic single-origin load tests where the cap would distort
    /// throughput measurements.
    pub per_host_concurrency_limit: Option<usize>,
    /// Stage D · D3 — slow-request threshold. Requests whose total elapsed
    /// time exceeds this duration count in `rdap_slow_requests_total` and
    /// emit one sampled `info`-level event. Defaults to
    /// [`DEFAULT_SLOW_REQUEST_THRESHOLD`].
    pub slow_request_threshold: Duration,
    /// Stage D · D2 — fraction of queries (`0.0..=1.0`) that open a
    /// `rdap.fetch` tracing span. `0.0` (the default) disables tracing on
    /// the hot path entirely; with no subscriber attached, the only cost
    /// is a single `f32` comparison per call. `verbose_trace` and
    /// `RDAP_TRACE=1` both override this to `1.0`.
    pub trace_sample_rate: f32,
    /// Stage D · D6 — verbose debug-trace mode. When `true`, every fetch
    /// opens a `rdap.fetch` span regardless of `trace_sample_rate`, with
    /// the full retry chain captured. Sensitive fields are still redacted.
    /// Equivalent to setting the `RDAP_TRACE=1` environment variable; the
    /// env var is honoured by [`Fetcher::with_full_dependencies`] at
    /// construction time.
    pub verbose_trace: bool,
}

/// v0.6.2 · Task 4 — warn at most once per (key, process) about an
/// unparseable env-var value. Sampling here is "first occurrence wins":
/// an operator with a typo'd value sees one warn line, not a flood. The
/// per-key `OnceLock` lives forever — there's only one entry per env
/// var, so the static set is bounded at 5 items.
fn warn_invalid_env_once(key: &str, value: &str, expected: &str) {
    use std::sync::OnceLock;
    // Five env vars × one OnceLock each. Match on the key string so each
    // gets its own latch. Unknown keys (none in the current code path,
    // but defensive) share a generic latch.
    static T_TIMEOUT: OnceLock<()> = OnceLock::new();
    static T_MAX_ATT: OnceLock<()> = OnceLock::new();
    static T_CONC: OnceLock<()> = OnceLock::new();
    static T_PER_HOST: OnceLock<()> = OnceLock::new();
    static T_TRACE: OnceLock<()> = OnceLock::new();
    static T_OTHER: OnceLock<()> = OnceLock::new();
    let latch = match key {
        "RDAP_TIMEOUT_SECS" => &T_TIMEOUT,
        "RDAP_MAX_ATTEMPTS" => &T_MAX_ATT,
        "RDAP_CONCURRENCY_LIMIT" => &T_CONC,
        "RDAP_PER_HOST_CONCURRENCY" => &T_PER_HOST,
        "RDAP_TRACE_SAMPLE_RATE" => &T_TRACE,
        _ => &T_OTHER,
    };
    if latch.set(()).is_ok() {
        // First time we've seen this key be invalid in this process.
        // Truncate the offending value to 64 chars so a malicious huge
        // env value can't fill the log buffer.
        let display_value: String = value.chars().take(64).collect();
        tracing::warn!(
            event = "rdap_env_override_invalid",
            key = %key,
            value = %display_value,
            expected = %expected,
            "ignoring invalid env override; subsequent invalid values for this key will not be logged this process",
        );
    }
}

impl FetcherConfig {
    /// v0.6.1 · Task 5 — overlay environment variables onto the config in
    /// place. Reads each variable below; ignores unparseable / unset
    /// values silently so an operator can leave variables empty without
    /// breaking the engine.
    ///
    /// | Variable | Field | Type |
    /// |---|---|---|
    /// | `RDAP_TIMEOUT_SECS` | `timeout` | `u64` seconds |
    /// | `RDAP_MAX_ATTEMPTS` | `max_attempts` | `u32` |
    /// | `RDAP_CONCURRENCY_LIMIT` | `concurrency_limit` | `usize` |
    /// | `RDAP_PER_HOST_CONCURRENCY` | `per_host_concurrency_limit` | `usize` (`0` ⇒ disable) |
    /// | `RDAP_TRACE_SAMPLE_RATE` | `trace_sample_rate` | `f32` |
    ///
    /// Combine with [`Self::validate`] to reject the resulting config if an
    /// env var pushes a field out of bounds.
    ///
    /// ```rust,no_run
    /// # use rdap_core::FetcherConfig;
    /// let cfg = FetcherConfig::default().with_env_overrides();
    /// cfg.validate().expect("validate after env overlay");
    /// ```
    pub fn with_env_overrides(mut self) -> Self {
        if let Ok(s) = std::env::var("RDAP_TIMEOUT_SECS") {
            match s.parse::<u64>() {
                Ok(n) => self.timeout = Duration::from_secs(n),
                Err(_) => warn_invalid_env_once("RDAP_TIMEOUT_SECS", &s, "u64 seconds"),
            }
        }
        if let Ok(s) = std::env::var("RDAP_MAX_ATTEMPTS") {
            match s.parse::<u32>() {
                Ok(n) => self.max_attempts = n,
                Err(_) => warn_invalid_env_once("RDAP_MAX_ATTEMPTS", &s, "u32"),
            }
        }
        if let Ok(s) = std::env::var("RDAP_CONCURRENCY_LIMIT") {
            match s.parse::<usize>() {
                Ok(n) => self.concurrency_limit = n,
                Err(_) => warn_invalid_env_once("RDAP_CONCURRENCY_LIMIT", &s, "usize"),
            }
        }
        if let Ok(s) = std::env::var("RDAP_PER_HOST_CONCURRENCY") {
            // `0` is the documented "disable per-host gating" sentinel
            // — distinct from leaving the variable unset (which leaves
            // the config field at whatever the caller set).
            match s.parse::<usize>() {
                Ok(n) => {
                    self.per_host_concurrency_limit = if n == 0 { None } else { Some(n) };
                }
                Err(_) => {
                    warn_invalid_env_once("RDAP_PER_HOST_CONCURRENCY", &s, "usize (0 ⇒ disable)")
                }
            }
        }
        if let Ok(s) = std::env::var("RDAP_TRACE_SAMPLE_RATE") {
            match s.parse::<f32>() {
                Ok(f) => self.trace_sample_rate = f,
                Err(_) => warn_invalid_env_once("RDAP_TRACE_SAMPLE_RATE", &s, "f32 in [0.0, 1.0]"),
            }
        }
        self
    }

    /// Stage F · F2 — validate the config against the production-safety
    /// bounds. Called from every `Fetcher::with_*` constructor; returns
    /// [`RdapError::InvalidInput`] on rejection so the consumer's existing
    /// `Result` plumbing surfaces the failure with a clear message.
    ///
    /// Caps enforced:
    /// - `timeout` ∈ (0 s, [`MAX_TIMEOUT`]] — non-zero, ≤ 30 s
    /// - `max_attempts` ∈ [1, [`MAX_ATTEMPTS_CEILING`]] — at least one attempt, ≤ 10
    /// - `concurrency_limit` ∈ [1, [`MAX_CONCURRENCY_LIMIT`]] — non-zero, ≤ 4096
    /// - `initial_backoff` ≤ `max_backoff` — invariant the retry loop relies on
    /// - `slow_request_threshold` non-zero — a 0 ms threshold would mark
    ///   every request as slow and is almost certainly a misconfiguration
    /// - `trace_sample_rate` finite and in `[0.0, 1.0]` — NaN / inf would
    ///   make the sampling decision undefined
    /// - `max_connections_per_host` non-zero
    pub fn validate(&self) -> Result<()> {
        if self.timeout.is_zero() {
            return Err(RdapError::InvalidInput(
                "FetcherConfig.timeout must be greater than zero".to_string(),
            ));
        }
        if self.timeout > MAX_TIMEOUT {
            return Err(RdapError::InvalidInput(format!(
                "FetcherConfig.timeout {}ms exceeds MAX_TIMEOUT {}ms — production-safety cap (Stage F · F1)",
                self.timeout.as_millis(),
                MAX_TIMEOUT.as_millis(),
            )));
        }
        if self.max_attempts == 0 {
            return Err(RdapError::InvalidInput(
                "FetcherConfig.max_attempts must be at least 1 (a 0 would never call upstream)"
                    .to_string(),
            ));
        }
        if self.max_attempts > MAX_ATTEMPTS_CEILING {
            return Err(RdapError::InvalidInput(format!(
                "FetcherConfig.max_attempts {} exceeds ceiling {} — beyond this the retry budget itself becomes a self-DoS vector",
                self.max_attempts, MAX_ATTEMPTS_CEILING,
            )));
        }
        if self.concurrency_limit == 0 {
            return Err(RdapError::InvalidInput(
                "FetcherConfig.concurrency_limit must be at least 1".to_string(),
            ));
        }
        if self.concurrency_limit > MAX_CONCURRENCY_LIMIT {
            return Err(RdapError::InvalidInput(format!(
                "FetcherConfig.concurrency_limit {} exceeds ceiling {} (file-descriptor exhaustion risk)",
                self.concurrency_limit, MAX_CONCURRENCY_LIMIT,
            )));
        }
        if self.initial_backoff > self.max_backoff {
            return Err(RdapError::InvalidInput(format!(
                "FetcherConfig.initial_backoff ({}ms) must be ≤ max_backoff ({}ms)",
                self.initial_backoff.as_millis(),
                self.max_backoff.as_millis(),
            )));
        }
        if self.slow_request_threshold.is_zero() {
            return Err(RdapError::InvalidInput(
                "FetcherConfig.slow_request_threshold must be greater than zero \
                (every request would be flagged as slow)"
                    .to_string(),
            ));
        }
        if !self.trace_sample_rate.is_finite()
            || self.trace_sample_rate < 0.0
            || self.trace_sample_rate > 1.0
        {
            return Err(RdapError::InvalidInput(format!(
                "FetcherConfig.trace_sample_rate {} is not in [0.0, 1.0]",
                self.trace_sample_rate
            )));
        }
        if self.max_connections_per_host == 0 {
            return Err(RdapError::InvalidInput(
                "FetcherConfig.max_connections_per_host must be at least 1".to_string(),
            ));
        }
        if let Some(n) = self.per_host_concurrency_limit {
            if n == 0 {
                return Err(RdapError::InvalidInput(
                    "FetcherConfig.per_host_concurrency_limit, when set, must be at least 1 \
                     (use `None` to disable per-host gating)"
                        .to_string(),
                ));
            }
            if n > self.concurrency_limit {
                return Err(RdapError::InvalidInput(format!(
                    "FetcherConfig.per_host_concurrency_limit ({n}) must not exceed \
                     concurrency_limit ({}) — a per-host cap above the global cap is meaningless",
                    self.concurrency_limit
                )));
            }
        }
        Ok(())
    }
}

impl Default for FetcherConfig {
    fn default() -> Self {
        Self {
            // Stage F · F1 — 5 s is the production-safe ceiling. See
            // [`DEFAULT_TIMEOUT`] for the rationale.
            timeout: DEFAULT_TIMEOUT,
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
            concurrency_limit: DEFAULT_UPSTREAM_CONCURRENCY,
            per_host_concurrency_limit: Some(DEFAULT_PER_HOST_CONCURRENCY),
            slow_request_threshold: DEFAULT_SLOW_REQUEST_THRESHOLD,
            trace_sample_rate: 0.0,
            verbose_trace: false,
        }
    }
}

/// v0.6.11 — RAII guard that increments `rdap_per_origin_inflight{origin}`
/// on construction and decrements it on drop, ensuring the gauge is
/// balanced across every fetch exit path (success / retry-with-drop /
/// error-final).
///
/// Zero-cost when the `metrics` feature is off: the struct has no
/// fields, `new()` is a no-op, and `Drop::drop` is a no-op. The compiler
/// elides it entirely under release + LTO.
///
/// Zero new metric series when per-host gating is disabled
/// (`per_host_concurrency_limit = None`): the guard is only constructed
/// in the `Some(_)` branch of the per-host acquire, so no labelled
/// gauge is emitted in single-origin synthetic-load runs.
struct OriginInflightGuard {
    #[cfg(feature = "metrics")]
    origin: String,
}

impl OriginInflightGuard {
    #[inline]
    #[cfg_attr(not(feature = "metrics"), allow(unused_variables))]
    fn new(origin: &Origin) -> Self {
        Self {
            #[cfg(feature = "metrics")]
            origin: {
                // Single allocation per fetch, only when metrics is on.
                // Off-feature: this whole block is elided.
                let s = origin.to_string();
                metrics_hooks::inflight_origin_inc(&s);
                s
            },
        }
    }
}

impl Drop for OriginInflightGuard {
    #[inline]
    fn drop(&mut self) {
        #[cfg(feature = "metrics")]
        metrics_hooks::inflight_origin_dec(&self.origin);
    }
}

/// HTTP fetcher with SSRF protection, retry logic, per-origin circuit
/// breakers, and a process-wide upstream-concurrency cap.
#[derive(Debug, Clone)]
pub struct Fetcher {
    client: reqwest::Client,
    ssrf: SsrfGuard,
    config: FetcherConfig,
    breakers: CircuitBreakerRegistry,
    /// Process-wide cap on simultaneously-open upstream HTTP requests.
    /// Cheap to clone; permits are acquired once per HTTP attempt.
    concurrency: Arc<Semaphore>,
    /// v0.6.1 · Task 1 — per-origin semaphore registry. `None` when
    /// [`FetcherConfig::per_host_concurrency_limit`] is `None`. Lazily
    /// populated: an origin's semaphore is created on first access. Soft-
    /// capped at [`PER_HOST_REGISTRY_CAPACITY`] entries; further origins
    /// fail-open (the global semaphore still gates them).
    per_host: Option<Arc<DashMap<Origin, Arc<Semaphore>>>>,
    /// Resolved value of `config.verbose_trace || RDAP_TRACE=1`, computed
    /// once at construction so the env-var dispatch isn't on the hot path.
    /// (Stage D · D6.)
    verbose_trace: bool,
}

impl Fetcher {
    /// Creates a fetcher using the default configuration.
    pub fn new(ssrf: SsrfGuard) -> Result<Self> {
        Self::with_config(ssrf, FetcherConfig::default())
    }

    /// Creates a fetcher with a custom configuration.
    pub fn with_config(ssrf: SsrfGuard, config: FetcherConfig) -> Result<Self> {
        Self::with_config_and_breakers(ssrf, config, CircuitBreakerRegistry::new())
    }

    /// Creates a fetcher that shares an existing circuit-breaker registry.
    /// Useful for wiring a single registry across multiple fetcher instances
    /// or for exposing breaker state to observability layers.
    pub fn with_config_and_breakers(
        ssrf: SsrfGuard,
        config: FetcherConfig,
        breakers: CircuitBreakerRegistry,
    ) -> Result<Self> {
        let concurrency = Arc::new(Semaphore::new(config.concurrency_limit.max(1)));
        Self::with_full_dependencies(ssrf, config, breakers, concurrency)
    }

    /// Full constructor exposing every shared dependency.
    ///
    /// Useful for wiring a single concurrency semaphore across multiple
    /// fetcher instances (e.g. one per binding language) so the cap is
    /// truly process-wide.
    pub fn with_full_dependencies(
        ssrf: SsrfGuard,
        config: FetcherConfig,
        breakers: CircuitBreakerRegistry,
        concurrency: Arc<Semaphore>,
    ) -> Result<Self> {
        // Stage F · F2 — fail-fast on unsafe configuration. Every public
        // constructor funnels through this method, so this is the single
        // gate that enforces the production-safety bounds.
        config.validate()?;

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

        // Stage D · D6 — resolve verbose-trace once. Env var wins if set;
        // otherwise the config flag stands. After this point the hot path
        // never touches `std::env`.
        let verbose_trace = sampling::resolve_verbose(config.verbose_trace);

        // v0.6.1 · Task 1 — only allocate the per-host registry if the
        // operator opted in. `None` is the cheap path; the hot-path
        // acquire below short-circuits without touching the DashMap.
        let per_host = config
            .per_host_concurrency_limit
            .map(|_| Arc::new(DashMap::with_capacity(64)));

        Ok(Self {
            client,
            ssrf,
            config,
            breakers,
            concurrency,
            per_host,
            verbose_trace,
        })
    }

    /// Returns a clone of the underlying circuit-breaker registry. The returned
    /// handle shares state with this fetcher (cheap clone — internal `Arc`).
    pub fn breakers(&self) -> CircuitBreakerRegistry {
        self.breakers.clone()
    }

    /// Returns a clone of the upstream-concurrency semaphore. Cheap (Arc-clone).
    pub fn concurrency_limit(&self) -> Arc<Semaphore> {
        Arc::clone(&self.concurrency)
    }

    /// v0.6.1 · Task 1 — fetch (or lazily create) the per-host semaphore
    /// for this origin. Returns `None` when per-host gating is disabled
    /// (`per_host_concurrency_limit = None`) or when the registry is at
    /// the soft capacity (fail-open — the global semaphore still bounds
    /// the request).
    ///
    /// The registry is intentionally a flat DashMap rather than an LRU:
    /// per-host caps are sticky for the lifetime of the process, and the
    /// soft cap protects against unbounded-cardinality attacks. An LRU
    /// would risk dropping a semaphore while waiters held permits, which
    /// is harder to reason about than fail-open.
    fn per_host_semaphore(&self, origin: &Origin) -> Option<Arc<Semaphore>> {
        let limit = self.config.per_host_concurrency_limit?;
        let registry = self.per_host.as_ref()?;
        if let Some(existing) = registry.get(origin) {
            return Some(Arc::clone(existing.value()));
        }
        // Fail-open at the cap. DashMap::len is approximate under
        // contention; we don't need a strict bound, only a defensive one.
        if registry.len() >= PER_HOST_REGISTRY_CAPACITY {
            return None;
        }
        let new_sem = Arc::new(Semaphore::new(limit));
        // `entry().or_insert_with` is the atomic claim. Two racing tasks
        // converge on whichever insert lands first; the loser drops its
        // unused `new_sem` Arc.
        let entry = registry.entry(origin.clone()).or_insert(new_sem);
        Some(Arc::clone(entry.value()))
    }

    /// Borrow the resolved configuration. Useful for higher layers that want
    /// to read the slow-request threshold or trace-sample rate without
    /// duplicating those settings in their own structs.
    pub fn config(&self) -> &FetcherConfig {
        &self.config
    }

    /// Returns the **resolved** verbose-trace flag — the OR of
    /// `config.verbose_trace` and the `RDAP_TRACE=1` env var (read once at
    /// construction). Callers that want to mirror the fetcher's tracing
    /// decision should prefer this over `config().verbose_trace`, which
    /// returns the raw config flag and ignores the env override.
    pub fn verbose_trace_resolved(&self) -> bool {
        self.verbose_trace
    }

    /// Fetches and deserialises a JSON response from `url`.
    ///
    /// Validates the URL with the SSRF guard, consults the per-origin circuit
    /// breaker, retries on transient errors with exponential back-off, and
    /// records a single breaker event (success or failure) per logical call.
    pub async fn fetch(&self, url: &str) -> Result<Value> {
        let (value, _) = self.fetch_with_cache_hint(url).await?;
        Ok(value)
    }

    /// Like [`fetch`](Self::fetch) but also returns a `Cache-Control` hint
    /// extracted from the response headers.
    ///
    /// The hint is the `max-age` value, if present and parseable.  Callers
    /// should cap this against their own maximum allowed TTL.
    pub async fn fetch_with_cache_hint(&self, url: &str) -> Result<(Value, Option<Duration>)> {
        self.ssrf.validate(url)?;

        // Per-origin circuit breaker — one event per logical call.
        let origin = Origin::from_url(url).ok_or_else(|| {
            RdapError::InvalidInput(format!("URL has no derivable origin: {url}"))
        })?;
        let breaker: Arc<crate::circuit_breaker::CircuitBreaker> =
            self.breakers.get_or_create(&origin);

        // v0.6.1 · Task 2 — capture state before/after each breaker call
        // and emit a transition metric whenever the state actually changed.
        // The atomic `state()` load is cheap (Acquire load on a u8) so the
        // pre/post pattern doesn't add measurable overhead on the hot path.
        //
        // v0.6.2 · Task 2 — additionally, when the transition is
        // `Open→HalfOpen` (cooldown elapsed), accumulate the time the
        // breaker spent in Open into `rdap_circuit_breaker_open_seconds_total`.
        // The breaker's `opened_at_ms` is captured BEFORE the transition
        // because `before_call` may overwrite it on its next open.
        let pre_state = breaker.state();
        let opened_at_ms_pre = if pre_state == crate::circuit_breaker::CircuitState::Open {
            breaker.opened_at_ms()
        } else {
            0
        };
        let admit = breaker.before_call().await.is_ok();
        let post_state = breaker.state();
        if pre_state != post_state {
            metrics_hooks::record_breaker_transition(
                &origin.to_string(),
                pre_state.label(),
                post_state.label(),
            );
            // Only Open→HalfOpen carries a meaningful "time spent open"
            // duration. Other transitions (Closed→Open, HalfOpen→Closed,
            // HalfOpen→Open) start fresh windows and don't close one.
            if pre_state == crate::circuit_breaker::CircuitState::Open
                && post_state == crate::circuit_breaker::CircuitState::HalfOpen
                && opened_at_ms_pre > 0
            {
                let now = crate::circuit_breaker::CircuitBreaker::now_ms_public();
                let elapsed_ms = now.saturating_sub(opened_at_ms_pre);
                metrics_hooks::add_breaker_open_duration(
                    &origin.to_string(),
                    Duration::from_millis(elapsed_ms),
                );
            }
        }
        if !admit {
            // Stage D · D2 — origin field is redacted to `scheme://<tld>:hash`
            // so logs never carry full upstream hostnames. The full origin
            // is still useful as the metric label (bounded by the registry
            // LRU), but logs and traces only see the redacted form. The
            // redaction itself is computed inline on this branch only —
            // the happy path doesn't pay for it.
            let origin_str = origin.to_string();
            tracing::warn!(
                event = "rdap_circuit_open",
                origin = %redact::redact_url(&origin_str),
            );
            // Record the per-origin open event. The matching state-gauge is
            // refreshed lazily on `/metrics` scrape from the breaker registry
            // snapshot, not here on the hot path.
            metrics_hooks::observe_circuit_open(&origin_str);
            metrics_hooks::record_error(crate::error_class::ErrorClass::CircuitOpen.metric_label());
            return Err(RdapError::CircuitOpen { origin: origin_str });
        }

        let result = self.fetch_with_retry(url, &origin).await;

        // Update breaker exactly once per logical call. Domain-class errors
        // (4xx other than 429) do not move the breaker — see is_breaker_failure.
        // v0.6.1 · Task 2 — the on_success / on_failure paths can transition
        // the state (closed→open, half_open→closed, half_open→open). We
        // bracket each call with state reads and emit a transition metric
        // when the state actually moved.
        match &result {
            Ok(_) => {
                let pre = breaker.state();
                breaker.on_success().await;
                let post = breaker.state();
                if pre != post {
                    metrics_hooks::record_breaker_transition(
                        &origin.to_string(),
                        pre.label(),
                        post.label(),
                    );
                }
            }
            Err(err) if is_breaker_failure(err) => {
                let pre = breaker.state();
                breaker.on_failure().await;
                let post = breaker.state();
                if pre != post {
                    metrics_hooks::record_breaker_transition(
                        &origin.to_string(),
                        pre.label(),
                        post.label(),
                    );
                }
                // After the failure is recorded the breaker may have just
                // opened — emit the per-origin open counter event in that
                // case. Cheap state read; safe to call frequently.
                if post == crate::circuit_breaker::CircuitState::Open {
                    metrics_hooks::observe_circuit_open(&origin.to_string());
                }
            }
            Err(_) => { /* non-transport error — leave breaker untouched */ }
        }

        // Per-request error counter (excluding CircuitOpen, which was already
        // recorded above when we short-circuited).
        if let Err(err) = &result {
            metrics_hooks::record_error(classify_error(err).metric_label());
        }

        result
    }

    /// Internal retry loop. Caller is responsible for SSRF validation and
    /// circuit-breaker bookkeeping.
    ///
    /// The upstream-concurrency semaphore is acquired *per attempt* so that
    /// retry backoffs do not hold a permit — backoff is "not actively using
    /// upstream" and shouldn't count against the cap.
    async fn fetch_with_retry(
        &self,
        url: &str,
        origin: &Origin,
    ) -> Result<(Value, Option<Duration>)> {
        let start = std::time::Instant::now();
        let mut attempt = 0u32;
        // Stage D · D2 — sampling decision is taken once per logical call.
        // When `traced` is false, every span macro below resolves to
        // `Span::none()` and the field-recording calls are no-ops; in steady
        // state with no subscriber the cost is one branch on a `bool`.
        let traced = sampling::should_sample(self.verbose_trace, self.config.trace_sample_rate);
        // Compute the redacted origin only when we're actually going to log
        // it. With tracing off this saves a `String` alloc + URL parse on
        // every call. The slow-event path also reuses this value — that's
        // fine because the slow-event log is itself gated on `traced`.
        let origin_redacted = if traced {
            redact::redact_url(&origin.to_string())
        } else {
            String::new()
        };

        loop {
            attempt += 1;

            // Stage D · D2 — `rdap.fetch` span (per attempt). Fields:
            //   - origin: redacted, never the raw upstream URL
            //   - attempt: 1-based attempt number
            //   - retry_class: filled if this attempt fails into a retry
            //   - status_code: filled if the response had an HTTP status
            let span = if traced {
                tracing::info_span!(
                    "rdap.fetch",
                    origin = %origin_redacted,
                    attempt = attempt,
                    retry_class = tracing::field::Empty,
                    status_code = tracing::field::Empty,
                )
            } else {
                tracing::Span::none()
            };
            let _enter = span.enter();

            // v0.6.1 · Task 1 — per-host gate FIRST. Acquired before the
            // global semaphore so a slow host can't park global permits
            // while waiting for its own quota. Returns `None` when per-host
            // gating is off or when the registry is at capacity (fail-open).
            //
            // v0.6.2 · Task 1 + Task 3 — also observe the wait time and
            // the per-host queue depth at acquire time. `total_permits()`
            // and `available_permits()` are both `usize` reads (Acquire
            // load on a u64); `observe_per_host_queue_depth` is a no-op
            // when metrics are off.
            // v0.6.11 — alongside the per-host permit, hold an
            // `OriginInflightGuard` whose Drop balances the per-origin
            // inflight gauge. The guard is created only when the
            // per-host gate is active, keeping cardinality bounded by
            // the per-host registry cap (≤ 1024 origins) and emitting
            // no labelled series in opt-out deployments.
            let (_per_host_permit, _origin_inflight) = match self.per_host_semaphore(origin) {
                Some(sem) => {
                    let total = self.config.per_host_concurrency_limit.unwrap_or(0);
                    let available = sem.available_permits();
                    let depth_pre_acquire = total.saturating_sub(available);
                    metrics_hooks::observe_per_host_queue_depth(depth_pre_acquire);
                    let wait_start = std::time::Instant::now();
                    match sem.acquire_owned().await {
                        Ok(p) => {
                            metrics_hooks::observe_semaphore_wait("per_host", wait_start.elapsed());
                            // Increment per-origin gauge AFTER successful
                            // acquire. The guard's Drop decrements on every
                            // exit path (success / retry / error).
                            let guard = OriginInflightGuard::new(origin);
                            (Some(p), Some(guard))
                        }
                        Err(_) => {
                            return Err(RdapError::ParseError {
                                reason: "per-host concurrency semaphore closed".to_string(),
                            });
                        }
                    }
                }
                None => (None, None),
            };

            // Acquire a permit for this HTTP attempt only. Released when
            // `_permit` drops at the end of this iteration; the next retry
            // (if any) re-acquires after the backoff sleep.
            // v0.6.2 · Task 1 — observe global semaphore wait time too.
            let global_wait_start = std::time::Instant::now();
            let _permit = match Arc::clone(&self.concurrency).acquire_owned().await {
                Ok(p) => {
                    metrics_hooks::observe_semaphore_wait("global", global_wait_start.elapsed());
                    p
                }
                Err(_) => {
                    // Semaphore closed — should not happen in practice.
                    return Err(RdapError::ParseError {
                        reason: "upstream-concurrency semaphore closed".to_string(),
                    });
                }
            };
            // The permit represents one inflight upstream HTTP attempt.
            // We bracket the actual network I/O — backoff sleeps drop the
            // permit (and the gauge) before suspending.
            metrics_hooks::inflight_inc();

            match self.do_fetch_with_headers(url).await {
                AttemptResult::Ok { value, cache_hint } => {
                    metrics_hooks::inflight_dec();
                    span.record("status_code", 200u16);
                    let elapsed = start.elapsed();
                    // Stage D · D3 — slow-request signal. Counter is always
                    // incremented (cheap, label-free); the structured event
                    // fires only when the call has been sampled in for
                    // tracing, so logs are not spammed in steady state.
                    if elapsed > self.config.slow_request_threshold {
                        metrics_hooks::record_slow_request();
                        if traced {
                            tracing::info!(
                                event = "rdap_slow_request",
                                origin = %origin_redacted,
                                duration_ms = elapsed.as_millis() as u64,
                                threshold_ms = self.config.slow_request_threshold.as_millis() as u64,
                            );
                        }
                    }
                    return Ok((value, cache_hint));
                }
                AttemptResult::Err { error, retry_after } => {
                    let max_retries = retry_limit(&error);
                    if let RdapError::HttpStatus { status, .. } = &error {
                        span.record("status_code", *status);
                    }
                    if attempt <= max_retries && attempt < self.config.max_attempts {
                        let backoff_delay = backoff(
                            attempt,
                            self.config.initial_backoff,
                            self.config.max_backoff,
                        );
                        // Honour Retry-After if the server sent one. Effective
                        // delay is the larger of (parsed_retry_after, backoff)
                        // so we never undercut the server's request.
                        let delay = match retry_after {
                            Some(server) => server.min(RETRY_AFTER_MAX).max(backoff_delay),
                            None => backoff_delay,
                        };
                        let retry_class = classify_retry(&error);
                        span.record("retry_class", tracing::field::display(&retry_class));
                        tracing::debug!(
                            event = "rdap_retry",
                            attempt = attempt,
                            wait_ms = delay.as_millis() as u64,
                            retry_after_ms = retry_after.map(|d| d.as_millis() as u64),
                            retry_class = %retry_class,
                        );
                        // Each retry attempt is one event on rdap_retry_total.
                        // The Retry-After histogram observes the server-supplied
                        // hint (not the effective delay) so dashboards reflect
                        // upstream behaviour, not our own backoff.
                        metrics_hooks::record_retry(retry_class.metric_label(), retry_after);
                        // v0.6.1 · Task 4 — observe the actual computed
                        // delay (max of backoff jitter and Retry-After).
                        // Distinct from the existing `rdap_retry_after_seconds`
                        // histogram, which records only the server's hint:
                        // this captures what the engine *actually waited*.
                        metrics_hooks::observe_retry_delay(delay);
                        // Drop the permits *before* sleeping so backoff
                        // doesn't hold a slot against the global cap or
                        // the per-host cap. The next attempt re-acquires
                        // both fresh after the sleep.
                        // v0.6.11 — also drop the per-origin gauge guard
                        // here so the gauge reflects "inflight against
                        // upstream", not "inflight including backoff".
                        metrics_hooks::inflight_dec();
                        drop(_permit);
                        drop(_origin_inflight);
                        drop(_per_host_permit);
                        // Drop the span guard before suspending so the span's
                        // duration only covers the actual HTTP attempt, not
                        // the backoff sleep.
                        drop(_enter);
                        tokio::time::sleep(delay).await;
                    } else {
                        metrics_hooks::inflight_dec();
                        return Err(error);
                    }
                }
            }
        }
    }

    async fn do_fetch_with_headers(&self, url: &str) -> AttemptResult {
        let response = match self
            .client
            .get(url)
            .header("Accept", "application/rdap+json, application/json")
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                let error = if e.is_timeout() {
                    RdapError::Timeout {
                        millis: self.config.timeout.as_millis() as u64,
                        url: url.to_string(),
                    }
                } else {
                    RdapError::Network(e)
                };
                return AttemptResult::Err {
                    error,
                    retry_after: None, // no headers — connection failed
                };
            }
        };

        let status = response.status();

        if !status.is_success() {
            // Capture Retry-After before consuming/discarding the response.
            let retry_after = parse_retry_after(response.headers());
            // Stage D · D2 — never log the raw URL. The `rdap.fetch` span
            // already carries the redacted origin; this event adds the
            // status code and Retry-After hint.
            tracing::debug!(
                event = "rdap_http_error",
                status = status.as_u16(),
                retry_after_ms = retry_after.map(|d| d.as_millis() as u64),
            );
            return AttemptResult::Err {
                error: RdapError::HttpStatus {
                    status: status.as_u16(),
                    url: url.to_string(),
                },
                retry_after,
            };
        }

        // Extract Cache-Control: max-age before consuming the response body
        let cache_hint = parse_cache_control(response.headers());

        // ── Step 1: read body with a hard size cap ────────────────────────────
        let bytes = match read_limited(response, self.config.validation_limits.max_json_size).await
        {
            Ok(b) => b,
            Err(e) => {
                let error = match e {
                    SecurityError::ResponseTooLarge => RdapError::ParseError {
                        reason: "RDAP response body exceeds the maximum allowed size".to_string(),
                    },
                    SecurityError::Network(inner) => RdapError::Network(inner),
                    other => RdapError::ParseError {
                        reason: other.to_string(),
                    },
                };
                return AttemptResult::Err {
                    error,
                    retry_after: None,
                };
            }
        };

        // ── Step 2: validate structure + RDAP fields, then return the Value ──
        match validate_rdap_response(&bytes, &self.config.validation_limits) {
            Ok(value) => AttemptResult::Ok { value, cache_hint },
            Err(e) => AttemptResult::Err {
                error: RdapError::from(e),
                retry_after: None,
            },
        }
    }

    /// Exposes the inner `reqwest::Client` so `Bootstrap` can reuse it.
    pub fn reqwest_client(&self) -> reqwest::Client {
        self.client.clone()
    }
}

// ── Retry utilities ───────────────────────────────────────────────────────────

/// Returns how many additional retry attempts are allowed for this error.
///
/// `0` means no retries; the request fails on the first attempt.
fn retry_limit(err: &RdapError) -> u32 {
    match err {
        // Transient network failures — allow up to 2 extra attempts
        RdapError::Network(_) => 2,
        // Timeouts are expensive; retry only once
        RdapError::Timeout { .. } => 1,
        RdapError::HttpStatus { status, .. } => match status {
            // 429 Rate-Limited — hard cap of 3 retries (was unbounded — fixed for B2.3)
            429 => 3,
            // 500 Internal Server Error — allow 2 retries
            500 => 2,
            // 502/503/504 Gateway errors — allow 2 retries
            502..=504 => 2,
            // All other 4xx client errors — do not retry
            _ => 0,
        },
        // Circuit-open is the local breaker speaking — retrying would just
        // hit it again. Wait for the cooldown elsewhere.
        RdapError::CircuitOpen { .. } => 0,
        _ => 0,
    }
}

/// Classifies an error as a transport-class failure that should move the
/// circuit breaker.
///
/// - 5xx (server-side brokenness) → yes
/// - Network / Timeout (transport-level) → yes
/// - 429 (server saying "slow down") → no (use rate-limit, not breaker)
/// - 4xx other than 429 (domain answer) → no
/// - CircuitOpen (the breaker itself) → no (don't double-count)
fn is_breaker_failure(err: &RdapError) -> bool {
    match err {
        RdapError::Network(_) => true,
        RdapError::Timeout { .. } => true,
        RdapError::HttpStatus { status, .. } => *status >= 500,
        _ => false,
    }
}

/// Computes the back-off delay for the given (1-based) retry `attempt`.
///
/// Implements **full jitter** (AWS "Exponential Backoff and Jitter", 2015):
/// `delay = random(0, min(initial × 2^(attempt-1), max))`.
///
/// Full jitter is preferred over plain exponential or equal jitter because it
/// disperses retry attempts uniformly across the back-off window — N clients
/// failing at the same instant retry at uniformly-distributed times, not in
/// synchronized waves. This converts a thundering herd into smooth load.
///
/// `attempt` must be ≥ 1; passing 0 returns `Duration::ZERO`.
fn backoff(attempt: u32, initial: Duration, max: Duration) -> Duration {
    if attempt == 0 {
        return Duration::ZERO;
    }
    let exp_millis = (initial.as_millis() as u64).saturating_mul(2u64.saturating_pow(attempt - 1));
    let cap_millis = max.as_millis() as u64;
    let upper = exp_millis.min(cap_millis);
    if upper == 0 {
        return Duration::ZERO;
    }
    // Inclusive of upper would let `attempt=1` still produce `initial` —
    // which is fine but the spec says random(0, X). Use 0..=upper to keep
    // both endpoints reachable.
    let jittered = rand::Rng::gen_range(&mut rand::thread_rng(), 0..=upper);
    Duration::from_millis(jittered)
}

/// Internal result type that lets `do_fetch_with_headers` propagate a
/// `Retry-After` hint to the retry loop without changing the public
/// `RdapError` schema.
#[derive(Debug)]
enum AttemptResult {
    Ok {
        value: Value,
        cache_hint: Option<Duration>,
    },
    Err {
        error: RdapError,
        /// Server-supplied wait hint. Honoured by the retry loop as a floor
        /// on the backoff delay (see RFC 7231 §7.1.3). Capped at
        /// [`RETRY_AFTER_MAX`] regardless of value.
        retry_after: Option<Duration>,
    },
}

/// Parses the `Retry-After` header per RFC 7231 §7.1.3.
///
/// Supports both forms:
/// - **delta-seconds**: integer number of seconds (e.g. `Retry-After: 30`)
/// - **HTTP-date**: RFC 7231 IMF-fixdate (e.g. `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT`)
///
/// Returns `None` if the header is absent or unparseable. Returned durations
/// are not yet capped by [`RETRY_AFTER_MAX`]; the retry loop applies that cap.
fn parse_retry_after(headers: &reqwest::header::HeaderMap) -> Option<Duration> {
    let value = headers.get(RETRY_AFTER)?.to_str().ok()?.trim();

    // Form 1 — delta-seconds
    if let Ok(secs) = value.parse::<u64>() {
        return Some(Duration::from_secs(secs));
    }

    // Form 2 — HTTP-date (IMF-fixdate, RFC 850, asctime). chrono::DateTime
    // covers RFC 2822 / RFC 7231 IMF-fixdate.
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(value) {
        let now = chrono::Utc::now();
        let then = dt.with_timezone(&chrono::Utc);
        if then > now {
            let secs = (then - now).num_seconds().max(0) as u64;
            return Some(Duration::from_secs(secs));
        }
        // Past dates → wait zero.
        return Some(Duration::ZERO);
    }

    None
}

/// Extracts `max-age` from a `Cache-Control` response header, if present.
fn parse_cache_control(headers: &reqwest::header::HeaderMap) -> Option<Duration> {
    let value = headers.get(CACHE_CONTROL)?.to_str().ok()?;
    for part in value.split(',') {
        let part = part.trim();
        if let Some(age_str) = part.strip_prefix("max-age=") {
            if let Ok(secs) = age_str.trim().parse::<u64>() {
                return Some(Duration::from_secs(secs));
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{
        backoff, is_breaker_failure, parse_cache_control, parse_retry_after, retry_limit, Fetcher,
        FetcherConfig, DEFAULT_TIMEOUT, MAX_ATTEMPTS_CEILING, MAX_CONCURRENCY_LIMIT, MAX_TIMEOUT,
    };
    use crate::circuit_breaker::CircuitState;
    use rdap_security::{SsrfConfig, SsrfGuard};
    use rdap_types::error::RdapError;
    use std::sync::Arc;
    use std::time::Duration;

    #[test]
    fn backoff_full_jitter_within_window() {
        // Full jitter: each draw is in [0, min(base*2^(n-1), cap)].
        let base = Duration::from_millis(500);
        let cap = Duration::from_secs(8);
        for attempt in 1..=10u32 {
            let exp = (base.as_millis() as u64).saturating_mul(2u64.saturating_pow(attempt - 1));
            let upper = exp.min(cap.as_millis() as u64);
            for _ in 0..50 {
                let d = backoff(attempt, base, cap).as_millis() as u64;
                assert!(d <= upper, "attempt={attempt} produced {d} > upper {upper}");
            }
        }
    }

    #[test]
    fn backoff_zero_attempt_returns_zero() {
        assert_eq!(
            backoff(0, Duration::from_millis(500), Duration::from_secs(8)),
            Duration::ZERO
        );
    }

    #[test]
    fn backoff_distribution_is_dispersed() {
        // Statistical sanity: 1000 draws against a fixed window should span
        // a meaningful fraction of the range and not cluster on a single value.
        // We don't run a chi-square here — that's a heavy test. We do verify:
        //   1. min(samples) is meaningfully below upper/8 (at least one short draw)
        //   2. max(samples) is meaningfully above 7*upper/8 (at least one long draw)
        //   3. distinct values count is large (> 100 out of 1000) — proves jitter
        let base = Duration::from_millis(100);
        let cap = Duration::from_millis(800);
        let attempt = 4u32; // upper = min(100*8, 800) = 800
        let upper = 800u64;
        let mut min = u64::MAX;
        let mut max = 0u64;
        let mut seen = std::collections::HashSet::new();
        for _ in 0..1000 {
            let d = backoff(attempt, base, cap).as_millis() as u64;
            min = min.min(d);
            max = max.max(d);
            seen.insert(d);
        }
        assert!(
            min < upper / 8,
            "min draw too high: {min} (expected < {})",
            upper / 8
        );
        assert!(
            max > 7 * upper / 8,
            "max draw too low: {max} (expected > {})",
            7 * upper / 8
        );
        assert!(
            seen.len() > 100,
            "too few distinct values: {} (expected > 100)",
            seen.len()
        );
    }

    #[test]
    fn backoff_saturates_on_very_large_attempt() {
        let base = Duration::from_millis(1);
        let cap = Duration::from_secs(30);
        // Full jitter: result must be ≤ cap. Sample many times.
        for _ in 0..50 {
            let result = backoff(64, base, cap);
            assert!(result <= cap, "backoff overran cap: {result:?}");
        }
    }

    #[test]
    fn retry_limit_timeout() {
        let err = RdapError::Timeout {
            millis: 400,
            url: "https://example.com/".to_string(),
        };
        assert_eq!(retry_limit(&err), 1);
    }

    #[tokio::test]
    async fn retry_limit_network_error() {
        // Connect to a port that is not listening to produce a real network error.
        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                timeout: Duration::from_millis(200),
                ..Default::default()
            },
        )
        .unwrap();
        // Port 1 is almost certainly closed; reqwest will return a Network error.
        let err = fetcher.fetch("https://127.0.0.1:1/rdap").await.unwrap_err();
        // Network or Timeout — both should trigger retries
        assert!(retry_limit(&err) >= 1, "network-class errors must retry");
    }

    #[test]
    fn retry_limit_retryable_http_statuses() {
        // 429 — hard cap of 3 retries (B2.3; was unbounded prior to that fix)
        let err_429 = RdapError::HttpStatus {
            status: 429,
            url: "https://example.com/".to_string(),
        };
        assert_eq!(retry_limit(&err_429), 3);

        // 500/502/503/504 have a hard cap of 2 retries
        for status in [500u16, 502, 503, 504] {
            let err = RdapError::HttpStatus {
                status,
                url: "https://example.com/".to_string(),
            };
            assert_eq!(retry_limit(&err), 2, "status {status} should retry 2 times");
        }
    }

    #[test]
    fn retry_limit_non_retryable_http_statuses() {
        for status in [400u16, 401, 403, 404, 422] {
            let err = RdapError::HttpStatus {
                status,
                url: "https://example.com/".to_string(),
            };
            assert_eq!(retry_limit(&err), 0, "status {status} should not retry");
        }
    }

    // Stage F · F2 — validator unit tests.

    #[test]
    fn validator_accepts_default_config() {
        FetcherConfig::default()
            .validate()
            .expect("default config must always validate");
    }

    #[test]
    fn validator_rejects_zero_timeout() {
        let cfg = FetcherConfig {
            timeout: Duration::ZERO,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_timeout_above_max() {
        let cfg = FetcherConfig {
            timeout: MAX_TIMEOUT + Duration::from_secs(1),
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_zero_max_attempts() {
        let cfg = FetcherConfig {
            max_attempts: 0,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_max_attempts_above_ceiling() {
        let cfg = FetcherConfig {
            max_attempts: MAX_ATTEMPTS_CEILING + 1,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_zero_concurrency_limit() {
        let cfg = FetcherConfig {
            concurrency_limit: 0,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_concurrency_above_ceiling() {
        let cfg = FetcherConfig {
            concurrency_limit: MAX_CONCURRENCY_LIMIT + 1,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_initial_backoff_greater_than_max() {
        let cfg = FetcherConfig {
            initial_backoff: Duration::from_secs(10),
            max_backoff: Duration::from_secs(1),
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_zero_slow_request_threshold() {
        let cfg = FetcherConfig {
            slow_request_threshold: Duration::ZERO,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_invalid_trace_sample_rate() {
        for bad in [-0.1, 1.5, f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            let cfg = FetcherConfig {
                trace_sample_rate: bad,
                ..Default::default()
            };
            assert!(
                cfg.validate().is_err(),
                "trace_sample_rate {bad} should be rejected"
            );
        }
    }

    #[test]
    fn validator_accepts_valid_trace_sample_rate_range() {
        for good in [0.0, 0.01, 0.5, 1.0] {
            let cfg = FetcherConfig {
                trace_sample_rate: good,
                ..Default::default()
            };
            assert!(
                cfg.validate().is_ok(),
                "trace_sample_rate {good} should be accepted"
            );
        }
    }

    #[test]
    fn validator_rejects_zero_max_connections_per_host() {
        let cfg = FetcherConfig {
            max_connections_per_host: 0,
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn fetcher_constructor_propagates_validator_error() {
        // The `with_*` constructors must surface the validation failure
        // through their `Result` rather than panic or build an unsafe
        // engine.
        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let cfg = FetcherConfig {
            timeout: Duration::ZERO,
            ..Default::default()
        };
        let err = Fetcher::with_config(ssrf, cfg).unwrap_err();
        assert!(matches!(err, RdapError::InvalidInput(_)));
    }

    #[test]
    fn default_config_values() {
        // Stage F · F1 — production-safe defaults. Changing any of these
        // affects every downstream consumer that uses `FetcherConfig::default()`,
        // so the regression must be deliberate.
        let cfg = FetcherConfig::default();
        assert_eq!(cfg.timeout, Duration::from_secs(5));
        assert_eq!(cfg.max_attempts, 3);
        assert_eq!(cfg.concurrency_limit, 256);
        assert!(cfg.user_agent.starts_with("rdapify/"));
        assert!(cfg.reuse_connections);
        // Tracing / verbose-mode default OFF (Stage D · D6).
        assert!(!cfg.verbose_trace);
        assert_eq!(cfg.trace_sample_rate, 0.0);
    }

    #[test]
    fn parse_cache_control_max_age() {
        let mut map = reqwest::header::HeaderMap::new();
        map.insert(
            reqwest::header::CACHE_CONTROL,
            "public, max-age=3600".parse().unwrap(),
        );
        assert_eq!(parse_cache_control(&map), Some(Duration::from_secs(3600)));
    }

    #[test]
    fn parse_cache_control_no_cache() {
        let mut map = reqwest::header::HeaderMap::new();
        map.insert(
            reqwest::header::CACHE_CONTROL,
            "no-cache, no-store".parse().unwrap(),
        );
        assert_eq!(parse_cache_control(&map), None);
    }

    #[test]
    fn parse_cache_control_absent() {
        let map = reqwest::header::HeaderMap::new();
        assert_eq!(parse_cache_control(&map), None);
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

    // ── B2.1 — Circuit breaker integration ─────────────────────────────────

    #[test]
    fn breaker_classification() {
        assert!(is_breaker_failure(&RdapError::Timeout {
            millis: 0,
            url: "x".into()
        }));
        assert!(is_breaker_failure(&RdapError::HttpStatus {
            status: 500,
            url: "x".into()
        }));
        assert!(is_breaker_failure(&RdapError::HttpStatus {
            status: 503,
            url: "x".into()
        }));
        // 429 = "slow down", not "broken" — handled by rate limit, not breaker.
        assert!(!is_breaker_failure(&RdapError::HttpStatus {
            status: 429,
            url: "x".into()
        }));
        // 404 = domain answer — does not move breaker.
        assert!(!is_breaker_failure(&RdapError::HttpStatus {
            status: 404,
            url: "x".into()
        }));
        // CircuitOpen is the breaker speaking — never feed it back to itself.
        assert!(!is_breaker_failure(&RdapError::CircuitOpen {
            origin: "https://x:443".into()
        }));
    }

    #[test]
    fn retry_limit_429_is_capped_at_3() {
        let err = RdapError::HttpStatus {
            status: 429,
            url: "https://example.com/".into(),
        };
        assert_eq!(
            retry_limit(&err),
            3,
            "429 retries must be hard-capped (B2.3)"
        );
    }

    #[test]
    fn retry_limit_circuit_open_is_zero() {
        let err = RdapError::CircuitOpen {
            origin: "https://example.com:443".into(),
        };
        assert_eq!(retry_limit(&err), 0);
    }

    #[tokio::test]
    async fn breaker_opens_after_repeated_5xx_against_one_origin() {
        // 5 logical 500s → breaker should open. Use max_attempts=1 so each
        // logical call is one HTTP request.
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(500)
            .with_body("{}")
            .expect_at_least(5)
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1, // one HTTP call per logical call
                ..Default::default()
            },
        )
        .unwrap();

        let url = format!("{}/rdap/x", server.url());
        for _ in 0..5 {
            let _ = fetcher.fetch(&url).await;
        }

        // The next call should fail-fast with CircuitOpen.
        let err = fetcher.fetch(&url).await.unwrap_err();
        assert!(
            matches!(err, RdapError::CircuitOpen { .. }),
            "expected CircuitOpen, got {err:?}"
        );

        // Registry should hold exactly one breaker, in Open state.
        let breakers = fetcher.breakers();
        let snap = breakers.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].1, CircuitState::Open);
    }

    #[tokio::test]
    async fn breaker_isolates_distinct_origins() {
        // Spin up two mock servers — each is its own origin. Fail server A
        // 5 times, verify A's breaker opens but B's stays closed and B still
        // serves successfully.
        let mut server_a = mockito::Server::new_async().await;
        let _bad = server_a
            .mock("GET", "/rdap/x")
            .with_status(500)
            .with_body("{}")
            .expect_at_least(5)
            .create_async()
            .await;

        let mut server_b = mockito::Server::new_async().await;
        let _good = server_b
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_body(r#"{"objectClassName":"domain","ldhName":"OK"}"#)
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                ..Default::default()
            },
        )
        .unwrap();

        let url_a = format!("{}/rdap/x", server_a.url());
        let url_b = format!("{}/rdap/x", server_b.url());

        for _ in 0..5 {
            let _ = fetcher.fetch(&url_a).await;
        }

        // A is open.
        let err_a = fetcher.fetch(&url_a).await.unwrap_err();
        assert!(matches!(err_a, RdapError::CircuitOpen { .. }));

        // B is closed and still works.
        let value_b = fetcher.fetch(&url_b).await.unwrap();
        assert_eq!(value_b["ldhName"], "OK");
    }

    // ── C3 — Global concurrency semaphore ─────────────────────────────────

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn semaphore_caps_concurrent_upstream_fetches() {
        // Spawn 50 concurrent client.fetch() calls against a server that
        // sleeps before responding. Track the peak in-flight count via an
        // AtomicI64 incremented in the mock's response callback. With a
        // concurrency cap of 4, the peak should be ≤ 4.
        use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};

        let peak = Arc::new(AtomicI64::new(0));
        let in_flight = Arc::new(AtomicI64::new(0));
        let peak_for_mock = Arc::clone(&peak);
        let in_flight_for_mock = Arc::clone(&in_flight);

        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(move |w| {
                let now = in_flight_for_mock.fetch_add(1, AtomicOrdering::SeqCst) + 1;
                // Update peak without a CAS loop — this monotonically rises;
                // a small race here is harmless.
                let prev_peak = peak_for_mock.load(AtomicOrdering::Relaxed);
                if now > prev_peak {
                    peak_for_mock.store(now, AtomicOrdering::Relaxed);
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
                in_flight_for_mock.fetch_sub(1, AtomicOrdering::SeqCst);
                w.write_all(br#"{"objectClassName":"domain","ldhName":"X"}"#)
            })
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let cap = 4usize;
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                concurrency_limit: cap,
                // v0.6.1 — opt out of per-host gating so the global cap
                // is what's measured. Default per-host (16) would exceed
                // this test's `cap = 4` and the validator (correctly)
                // rejects that combination.
                per_host_concurrency_limit: None,
                ..Default::default()
            },
        )
        .unwrap();

        let url = format!("{}/rdap/x", server.url());
        let n = 50usize;
        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let f = fetcher.clone();
            let u = url.clone();
            handles.push(tokio::spawn(async move { f.fetch(&u).await }));
        }
        for h in handles {
            let _ = h.await.unwrap();
        }

        let observed_peak = peak.load(AtomicOrdering::Relaxed);
        assert!(
            observed_peak <= cap as i64,
            "concurrency cap {cap} exceeded — peak in-flight was {observed_peak}"
        );
        // Sanity: with 50 queries the cap *should* have been pressed.
        assert!(
            observed_peak >= 1,
            "expected nonzero peak, got {observed_peak}"
        );
    }

    // ── v0.6.1 · Task 1 — per-host concurrency tests ───────────────────────

    #[test]
    fn validator_rejects_zero_per_host_when_set() {
        let cfg = FetcherConfig {
            per_host_concurrency_limit: Some(0),
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_rejects_per_host_above_global() {
        let cfg = FetcherConfig {
            concurrency_limit: 8,
            per_host_concurrency_limit: Some(16),
            ..Default::default()
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn validator_accepts_per_host_none() {
        let cfg = FetcherConfig {
            per_host_concurrency_limit: None,
            ..Default::default()
        };
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn validator_accepts_per_host_equal_to_global() {
        let cfg = FetcherConfig {
            concurrency_limit: 16,
            per_host_concurrency_limit: Some(16),
            ..Default::default()
        };
        assert!(cfg.validate().is_ok());
    }

    // ── v0.6.1 · Task 5 — env-override tests ──────────────────────────────
    //
    // These run sequentially because `std::env::set_var` mutates global
    // state. Each test sets the vars it needs, runs the override pass, and
    // unsets the vars at the end so adjacent tests see a clean env. We
    // avoid `serial_test` — adding a dev-dep just for two tests isn't
    // worth it; the test bodies clean up after themselves and read only
    // namespaced `RDAP_*` variables.

    /// Serialise the env-override tests against each other. Cargo runs
    /// `#[test]` functions in parallel by default, and `std::env::set_var`
    /// is process-global, so without this guard we'd race.
    fn env_test_lock() -> std::sync::MutexGuard<'static, ()> {
        use std::sync::{Mutex, OnceLock};
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            // PoisonError just means a previous test panicked while
            // holding the lock; the env state is fine to recover from
            // because every test in this group calls `clear_env` first.
            .unwrap_or_else(|p| p.into_inner())
    }

    fn clear_env() {
        for var in [
            "RDAP_TIMEOUT_SECS",
            "RDAP_MAX_ATTEMPTS",
            "RDAP_CONCURRENCY_LIMIT",
            "RDAP_PER_HOST_CONCURRENCY",
            "RDAP_TRACE_SAMPLE_RATE",
        ] {
            std::env::remove_var(var);
        }
    }

    #[test]
    fn env_overrides_apply_when_set() {
        let _g = env_test_lock();
        clear_env();
        std::env::set_var("RDAP_TIMEOUT_SECS", "7");
        std::env::set_var("RDAP_MAX_ATTEMPTS", "2");
        std::env::set_var("RDAP_CONCURRENCY_LIMIT", "32");
        std::env::set_var("RDAP_PER_HOST_CONCURRENCY", "8");
        std::env::set_var("RDAP_TRACE_SAMPLE_RATE", "0.05");

        let cfg = FetcherConfig::default().with_env_overrides();
        assert_eq!(cfg.timeout, Duration::from_secs(7));
        assert_eq!(cfg.max_attempts, 2);
        assert_eq!(cfg.concurrency_limit, 32);
        assert_eq!(cfg.per_host_concurrency_limit, Some(8));
        assert!((cfg.trace_sample_rate - 0.05).abs() < 1e-6);

        clear_env();
    }

    #[test]
    fn env_overrides_per_host_zero_disables_gating() {
        let _g = env_test_lock();
        clear_env();
        std::env::set_var("RDAP_PER_HOST_CONCURRENCY", "0");
        let cfg = FetcherConfig::default().with_env_overrides();
        assert_eq!(
            cfg.per_host_concurrency_limit, None,
            "RDAP_PER_HOST_CONCURRENCY=0 must disable per-host gating"
        );
        clear_env();
    }

    #[test]
    fn env_overrides_ignore_unparseable_values() {
        let _g = env_test_lock();
        clear_env();
        std::env::set_var("RDAP_TIMEOUT_SECS", "not_a_number");
        std::env::set_var("RDAP_MAX_ATTEMPTS", "");
        std::env::set_var("RDAP_TRACE_SAMPLE_RATE", "wat");
        // Defaults must survive an unparseable env value — an operator
        // accidentally setting a malformed value should not crash the
        // engine.
        let cfg = FetcherConfig::default().with_env_overrides();
        assert_eq!(cfg.timeout, DEFAULT_TIMEOUT);
        assert_eq!(cfg.max_attempts, 3);
        assert_eq!(cfg.trace_sample_rate, 0.0);
        clear_env();
    }

    #[test]
    fn env_overrides_unset_leaves_caller_value() {
        let _g = env_test_lock();
        clear_env();
        let mut cfg = FetcherConfig::default();
        cfg.timeout = Duration::from_secs(11);
        cfg.max_attempts = 7;
        let cfg = cfg.with_env_overrides();
        // Without the env vars set, the caller's explicit values stand.
        assert_eq!(cfg.timeout, Duration::from_secs(11));
        assert_eq!(cfg.max_attempts, 7);
        clear_env();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn per_host_cap_binds_against_single_origin() {
        // 50 concurrent calls against a slow mock with `per_host = 4` and
        // a global cap of 256: the peak concurrent inflight against THIS
        // origin should never exceed 4.
        use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};

        let peak = Arc::new(AtomicI64::new(0));
        let in_flight = Arc::new(AtomicI64::new(0));
        let peak_for_mock = Arc::clone(&peak);
        let in_flight_for_mock = Arc::clone(&in_flight);

        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(move |w| {
                let now = in_flight_for_mock.fetch_add(1, AtomicOrdering::SeqCst) + 1;
                let prev = peak_for_mock.load(AtomicOrdering::Relaxed);
                if now > prev {
                    peak_for_mock.store(now, AtomicOrdering::Relaxed);
                }
                std::thread::sleep(std::time::Duration::from_millis(40));
                in_flight_for_mock.fetch_sub(1, AtomicOrdering::SeqCst);
                w.write_all(br#"{"objectClassName":"domain","ldhName":"X"}"#)
            })
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let per_host_cap = 4usize;
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                concurrency_limit: 256,
                per_host_concurrency_limit: Some(per_host_cap),
                ..Default::default()
            },
        )
        .unwrap();

        let url = format!("{}/rdap/x", server.url());
        let n = 50usize;
        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let f = fetcher.clone();
            let u = url.clone();
            handles.push(tokio::spawn(async move { f.fetch(&u).await }));
        }
        for h in handles {
            let _ = h.await.unwrap();
        }

        let observed_peak = peak.load(AtomicOrdering::Relaxed);
        assert!(
            observed_peak <= per_host_cap as i64,
            "per-host cap {per_host_cap} exceeded — peak in-flight was {observed_peak}"
        );
        assert!(
            observed_peak >= 1,
            "expected nonzero peak, got {observed_peak}"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn per_host_disabled_means_no_per_host_gate() {
        // Same workload as the previous test but with per-host = None.
        // Now only the global cap (50) gates concurrency, so the peak can
        // (and likely will) climb above any per-host value we'd otherwise
        // expect to bind.
        use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};

        let peak = Arc::new(AtomicI64::new(0));
        let in_flight = Arc::new(AtomicI64::new(0));
        let peak_for_mock = Arc::clone(&peak);
        let in_flight_for_mock = Arc::clone(&in_flight);

        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(move |w| {
                let now = in_flight_for_mock.fetch_add(1, AtomicOrdering::SeqCst) + 1;
                let prev = peak_for_mock.load(AtomicOrdering::Relaxed);
                if now > prev {
                    peak_for_mock.store(now, AtomicOrdering::Relaxed);
                }
                std::thread::sleep(std::time::Duration::from_millis(40));
                in_flight_for_mock.fetch_sub(1, AtomicOrdering::SeqCst);
                w.write_all(br#"{"objectClassName":"domain","ldhName":"X"}"#)
            })
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                concurrency_limit: 50,
                per_host_concurrency_limit: None,
                ..Default::default()
            },
        )
        .unwrap();

        let url = format!("{}/rdap/x", server.url());
        let n = 30usize;
        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let f = fetcher.clone();
            let u = url.clone();
            handles.push(tokio::spawn(async move { f.fetch(&u).await }));
        }
        for h in handles {
            let _ = h.await.unwrap();
        }

        let observed_peak = peak.load(AtomicOrdering::Relaxed);
        // With per-host disabled and a global cap of 50, 30 concurrent
        // queries should produce a peak well above any small per-host
        // figure. We assert ≥ 5 — generous bound that still catches a
        // bug where per-host gating sneaks in by mistake.
        assert!(
            observed_peak >= 5,
            "with per-host=None, expected concurrent peak ≥ 5; got {observed_peak}"
        );
    }

    #[tokio::test]
    async fn breaker_404_does_not_open() {
        // 100 consecutive 404s should NOT open the breaker — this is a
        // legitimate domain answer from a healthy registry.
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(404)
            .with_body("{}")
            .expect_at_least(10)
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                ..Default::default()
            },
        )
        .unwrap();
        let url = format!("{}/rdap/x", server.url());

        for _ in 0..10 {
            let err = fetcher.fetch(&url).await.unwrap_err();
            assert!(matches!(err, RdapError::HttpStatus { status: 404, .. }));
        }

        // Breaker should still be closed.
        let breakers = fetcher.breakers();
        let snap = breakers.snapshot();
        assert_eq!(snap.len(), 1);
        assert_eq!(snap[0].1, CircuitState::Closed);
    }

    // ── B2.3 — Retry-After parsing ─────────────────────────────────────────

    #[test]
    fn parse_retry_after_delta_seconds() {
        let mut h = reqwest::header::HeaderMap::new();
        h.insert(reqwest::header::RETRY_AFTER, "30".parse().unwrap());
        assert_eq!(parse_retry_after(&h), Some(Duration::from_secs(30)));
    }

    #[test]
    fn parse_retry_after_with_whitespace() {
        let mut h = reqwest::header::HeaderMap::new();
        h.insert(reqwest::header::RETRY_AFTER, "  45  ".parse().unwrap());
        assert_eq!(parse_retry_after(&h), Some(Duration::from_secs(45)));
    }

    #[test]
    fn parse_retry_after_http_date_future() {
        // 1 hour from now in RFC 2822 / IMF-fixdate format.
        let then = chrono::Utc::now() + chrono::Duration::seconds(3600);
        let formatted = then.to_rfc2822();
        let mut h = reqwest::header::HeaderMap::new();
        h.insert(reqwest::header::RETRY_AFTER, formatted.parse().unwrap());
        let parsed = parse_retry_after(&h).expect("should parse HTTP-date");
        // Allow a small clock-skew tolerance.
        assert!(
            parsed.as_secs() > 3500 && parsed.as_secs() <= 3600,
            "expected ~3600s, got {}",
            parsed.as_secs()
        );
    }

    #[test]
    fn parse_retry_after_http_date_past_returns_zero() {
        let then = chrono::Utc::now() - chrono::Duration::seconds(3600);
        let mut h = reqwest::header::HeaderMap::new();
        h.insert(
            reqwest::header::RETRY_AFTER,
            then.to_rfc2822().parse().unwrap(),
        );
        assert_eq!(parse_retry_after(&h), Some(Duration::ZERO));
    }

    #[test]
    fn parse_retry_after_unparseable_returns_none() {
        let mut h = reqwest::header::HeaderMap::new();
        h.insert(reqwest::header::RETRY_AFTER, "tomorrow".parse().unwrap());
        assert_eq!(parse_retry_after(&h), None);
    }

    #[test]
    fn parse_retry_after_absent_returns_none() {
        let h = reqwest::header::HeaderMap::new();
        assert_eq!(parse_retry_after(&h), None);
    }

    #[tokio::test]
    async fn retry_after_floor_is_honored_on_429() {
        // Server responds 429 with Retry-After: 1 (1s). Backoff would be 50ms.
        // Effective delay must be at least 1000ms. We measure elapsed wall-clock.
        let mut server = mockito::Server::new_async().await;
        let _bad = server
            .mock("GET", "/rdap/x")
            .with_status(429)
            .with_header("retry-after", "1")
            .with_body("{}")
            .expect_at_least(2)
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 2,
                initial_backoff: Duration::from_millis(50),
                max_backoff: Duration::from_millis(100),
                ..Default::default()
            },
        )
        .unwrap();

        let url = format!("{}/rdap/x", server.url());
        let start = std::time::Instant::now();
        let _ = fetcher.fetch(&url).await;
        let elapsed = start.elapsed();
        assert!(
            elapsed >= Duration::from_secs(1),
            "Retry-After=1s ignored — elapsed only {}ms",
            elapsed.as_millis()
        );
    }

    #[tokio::test]
    async fn fetch_with_cache_hint_returns_max_age() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/rdap/domain")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_header("Cache-Control", "public, max-age=7200")
            .with_body(r#"{"objectClassName":"domain","ldhName":"EXAMPLE.COM"}"#)
            .create_async()
            .await;

        let url = format!("{}/rdap/domain", server.url());
        let (value, hint) = disabled_ssrf_fetcher()
            .fetch_with_cache_hint(&url)
            .await
            .unwrap();
        assert_eq!(value["ldhName"], "EXAMPLE.COM");
        assert_eq!(hint, Some(Duration::from_secs(7200)));
        mock.assert_async().await;
    }

    // ── T4 · Case 4 — no retry storm under concurrent failures ───────────

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn concurrent_failures_do_not_synchronize_into_retry_storm() {
        // T4 Case 4 — when N concurrent requests all fail simultaneously,
        // their retries must be temporally distributed (jittered), not
        // synchronized into a thundering herd against the upstream.
        //
        // Setup:
        //   100 concurrent requests, max_attempts=2, every response is 500.
        //   Each call → 1 first attempt + 1 retry = 200 requests at the mock.
        //   The mock callback records a timestamp per request.
        //
        // Asserts:
        //   - The 100 first attempts cluster early (sanity: they all
        //     started together).
        //   - The 100 retry attempts are spread across at least
        //     `initial_backoff / 4` of wall-clock time. Backoff with full
        //     jitter draws uniform in [0, initial_backoff], so 100 samples
        //     would span essentially the full range — anything less than
        //     1/4 indicates synchronisation rather than jittered backoff.
        use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};
        use std::sync::Mutex;

        let timestamps: Arc<Mutex<Vec<std::time::Instant>>> =
            Arc::new(Mutex::new(Vec::with_capacity(256)));
        let counter = Arc::new(AtomicI64::new(0));
        let ts_for_mock = Arc::clone(&timestamps);
        let counter_for_mock = Arc::clone(&counter);

        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(500)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(move |w| {
                ts_for_mock.lock().unwrap().push(std::time::Instant::now());
                counter_for_mock.fetch_add(1, AtomicOrdering::SeqCst);
                w.write_all(br#"{}"#)
            })
            .expect_at_least(150)
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let initial_backoff = Duration::from_millis(100);
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 2, // 1 first attempt + 1 retry
                initial_backoff,
                max_backoff: Duration::from_millis(400),
                concurrency_limit: 256,
                per_host_concurrency_limit: None,
                ..Default::default()
            },
        )
        .unwrap();

        let url = format!("{}/rdap/x", server.url());
        let n = 100usize;
        let barrier = Arc::new(tokio::sync::Barrier::new(n));
        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let f = fetcher.clone();
            let u = url.clone();
            let b = Arc::clone(&barrier);
            handles.push(tokio::spawn(async move {
                b.wait().await;
                f.fetch(&u).await
            }));
        }
        for h in handles {
            let _ = h.await.unwrap();
        }

        // Pull recorded timestamps. Sort and split into first attempts
        // (earliest n) and retry attempts (the rest).
        let mut ts = timestamps.lock().unwrap().clone();
        ts.sort();
        assert!(
            ts.len() >= 2 * n,
            "expected ≥{} requests at the mock, observed {}",
            2 * n,
            ts.len()
        );
        let first_attempts = &ts[..n];
        let retry_attempts = &ts[n..2 * n];

        // First-attempt cluster sanity — they all started within a small
        // window after the barrier release.
        let first_spread = first_attempts
            .last()
            .unwrap()
            .duration_since(*first_attempts.first().unwrap());

        // Retry-attempt spread — the test's main assertion.
        let retry_spread = retry_attempts
            .last()
            .unwrap()
            .duration_since(*retry_attempts.first().unwrap());
        let min_required_spread = initial_backoff / 4;
        assert!(
            retry_spread >= min_required_spread,
            "retry storm detected: 100 retries spread over only {}ms \
             (need ≥ {}ms = initial_backoff/4) — first-attempt spread \
             was {}ms",
            retry_spread.as_millis(),
            min_required_spread.as_millis(),
            first_spread.as_millis()
        );
    }

    // ── T3 · Cases 3+4 — multi-origin fairness + slow-host isolation ─────

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn slow_host_does_not_starve_fast_host_under_per_host_caps() {
        // T3 Case 3 (fairness, no starvation) + Case 4 (slow-host isolation).
        //
        // Two origins:
        //   A — slow (50 ms response time per request)
        //   B — fast (5 ms response time per request)
        //
        // Concurrent workload of 30 each, with `per_host = 4` and a global
        // cap of 32 (so per-host is the binding constraint, not global).
        //
        // Asserts:
        //   1. Both workloads complete (no starvation).
        //   2. B's wall-clock is materially less than A's — the slow origin
        //      did not drag the fast one. Concretely, B finishes at least
        //      4× faster than A (the difference between B's tight 5 ms
        //      bottleneck and A's 50 ms bottleneck).
        //   3. A's per-host inflight peak ≤ 4 (per-host cap honoured).
        use std::sync::atomic::{AtomicI64, Ordering as AtomicOrdering};

        let peak_a = Arc::new(AtomicI64::new(0));
        let inflight_a = Arc::new(AtomicI64::new(0));
        let pa = Arc::clone(&peak_a);
        let ia = Arc::clone(&inflight_a);

        let mut server_a = mockito::Server::new_async().await;
        let _mock_a = server_a
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(move |w| {
                let now = ia.fetch_add(1, AtomicOrdering::SeqCst) + 1;
                let prev = pa.load(AtomicOrdering::Relaxed);
                if now > prev {
                    pa.store(now, AtomicOrdering::Relaxed);
                }
                std::thread::sleep(Duration::from_millis(50));
                ia.fetch_sub(1, AtomicOrdering::SeqCst);
                w.write_all(br#"{"objectClassName":"domain","ldhName":"A"}"#)
            })
            .create_async()
            .await;

        let mut server_b = mockito::Server::new_async().await;
        let _mock_b = server_b
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(|w| {
                std::thread::sleep(Duration::from_millis(5));
                w.write_all(br#"{"objectClassName":"domain","ldhName":"B"}"#)
            })
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                concurrency_limit: 32,
                per_host_concurrency_limit: Some(4),
                ..Default::default()
            },
        )
        .unwrap();

        let url_a = format!("{}/rdap/x", server_a.url());
        let url_b = format!("{}/rdap/x", server_b.url());
        let n = 30usize;

        // Spawn A and B concurrently and time each cohort separately.
        let fa = fetcher.clone();
        let ua = url_a.clone();
        let a_handle = tokio::spawn(async move {
            let start = std::time::Instant::now();
            let mut tasks = Vec::with_capacity(n);
            for _ in 0..n {
                let f = fa.clone();
                let u = ua.clone();
                tasks.push(tokio::spawn(async move { f.fetch(&u).await }));
            }
            let mut ok = 0usize;
            for t in tasks {
                if t.await.unwrap().is_ok() {
                    ok += 1;
                }
            }
            (ok, start.elapsed())
        });

        let fb = fetcher.clone();
        let ub = url_b.clone();
        let b_handle = tokio::spawn(async move {
            let start = std::time::Instant::now();
            let mut tasks = Vec::with_capacity(n);
            for _ in 0..n {
                let f = fb.clone();
                let u = ub.clone();
                tasks.push(tokio::spawn(async move { f.fetch(&u).await }));
            }
            let mut ok = 0usize;
            for t in tasks {
                if t.await.unwrap().is_ok() {
                    ok += 1;
                }
            }
            (ok, start.elapsed())
        });

        let (ok_a, elapsed_a) = a_handle.await.unwrap();
        let (ok_b, elapsed_b) = b_handle.await.unwrap();

        // Fairness: both cohorts completed in full.
        assert_eq!(ok_a, n, "origin A starved or failed: {ok_a}/{n}");
        assert_eq!(ok_b, n, "origin B starved or failed: {ok_b}/{n}");

        // Isolation: B is much faster than A. Theoretical lower bound for
        // each cohort is `(n / per_host) * latency`:
        //   A ≈ 30/4 * 50 ms ≈ 375 ms
        //   B ≈ 30/4 * 5  ms ≈ 38 ms
        // We assert B finishes in less than A/2, leaving margin for noise.
        assert!(
            elapsed_b * 2 < elapsed_a,
            "slow origin A dragged fast origin B: A={}ms B={}ms",
            elapsed_a.as_millis(),
            elapsed_b.as_millis()
        );

        // Per-host cap honoured for A.
        let pa = peak_a.load(AtomicOrdering::Relaxed);
        assert!(
            pa <= 4,
            "per-host cap violated for origin A: peak inflight = {pa}"
        );
    }

    // ── T3 · Case 6 — cancellation safety / no permit leak ───────────────

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn cancellation_releases_global_permits_no_leak() {
        // T3 Case 6 — when in-flight fetches are aborted, the global
        // semaphore must reclaim every permit. Concretely:
        //
        //   1. Capture `available_permits()` before any work.
        //   2. Spawn N >> cap fetch tasks against a slow mock.
        //   3. Sleep briefly so cap permits are acquired and inflight.
        //   4. Abort all task handles.
        //   5. Drain the abort by awaiting each handle (returns Err on abort).
        //   6. Assert `available_permits()` returned to its baseline.
        //
        // If any permit were `forget()`'d on cancellation, the baseline
        // would not be restored.
        let mut server = mockito::Server::new_async().await;
        let _mock = server
            .mock("GET", "/rdap/x")
            .with_status(200)
            .with_header("content-type", "application/rdap+json")
            .with_chunked_body(|w| {
                std::thread::sleep(Duration::from_millis(500));
                w.write_all(br#"{"objectClassName":"domain","ldhName":"X"}"#)
            })
            .expect_at_least(0)
            .create_async()
            .await;

        let ssrf = SsrfGuard::with_config(SsrfConfig {
            enabled: false,
            ..Default::default()
        });
        let cap = 4usize;
        let fetcher = Fetcher::with_config(
            ssrf,
            FetcherConfig {
                max_attempts: 1,
                concurrency_limit: cap,
                per_host_concurrency_limit: None,
                ..Default::default()
            },
        )
        .unwrap();

        let sem = fetcher.concurrency_limit();
        let baseline = sem.available_permits();
        assert_eq!(baseline, cap, "expected baseline available_permits == cap");

        let url = format!("{}/rdap/x", server.url());
        let n = 32usize;
        let mut handles = Vec::with_capacity(n);
        for _ in 0..n {
            let f = fetcher.clone();
            let u = url.clone();
            handles.push(tokio::spawn(async move { f.fetch(&u).await }));
        }

        // Allow time for cap permits to be acquired and inflight.
        tokio::time::sleep(Duration::from_millis(100)).await;
        let mid = sem.available_permits();
        assert!(
            mid < baseline,
            "expected fewer permits available mid-flight (got {mid} ≥ baseline {baseline})"
        );

        // Cancel every task.
        for h in &handles {
            h.abort();
        }
        for h in handles {
            // Aborted handles return JoinError. Either outcome (early-success,
            // aborted, or cancelled mid-fetch) is fine — we only care about
            // permit accounting.
            let _ = h.await;
        }

        // Give tokio a moment to run cleanup (`drop(_permit)` on each
        // cancelled future).
        tokio::time::sleep(Duration::from_millis(50)).await;

        let after = sem.available_permits();
        assert_eq!(
            after, baseline,
            "permit leak: expected {baseline} available, got {after}"
        );
    }
}
