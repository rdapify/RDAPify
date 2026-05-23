//! Typed configuration structs for RDAPify.
//!
//! All structs implement [`Default`] so RDAPify runs without any config file.
//! [`serde::Deserialize`] drives TOML parsing; absent keys use struct defaults.

use serde::{Deserialize, Serialize};

// ── Enumerations ──────────────────────────────────────────────────────────────

/// Storage backend used for RDAP response cache entries.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum CacheType {
    /// In-process hash-map (default, no external deps).
    #[default]
    Memory,
    /// SQLite file-based cache.
    Sqlite,
    /// PostgreSQL-backed cache.
    Postgres,
}

impl std::str::FromStr for CacheType {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "memory" => Ok(Self::Memory),
            "sqlite" => Ok(Self::Sqlite),
            "postgres" => Ok(Self::Postgres),
            _ => Err(()),
        }
    }
}

/// Minimum log severity emitted by RDAPify.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    #[default]
    Info,
    Warn,
    Error,
}

impl std::str::FromStr for LogLevel {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "trace" => Ok(Self::Trace),
            "debug" => Ok(Self::Debug),
            "info" => Ok(Self::Info),
            "warn" => Ok(Self::Warn),
            "error" => Ok(Self::Error),
            _ => Err(()),
        }
    }
}

/// Structured log output format.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    /// JSON (machine-readable, default for production).
    #[default]
    Json,
    /// Human-readable plain text.
    Text,
}

impl std::str::FromStr for LogFormat {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "json" => Ok(Self::Json),
            "text" => Ok(Self::Text),
            _ => Err(()),
        }
    }
}

// ── Section structs ───────────────────────────────────────────────────────────

/// RDAP HTTP client configuration.
///
/// ```toml
/// [rdap]
/// timeout_seconds = 5
/// max_response_size_mb = 5
/// user_agent = "RDAPify/0.x"
/// bootstrap_refresh_hours = 24
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct RdapConfig {
    /// Request timeout in seconds. Range: 1–30 (Stage F · F1 — see
    /// `rdap-core::MAX_TIMEOUT`).
    pub timeout_seconds: u64,
    /// Maximum allowed RDAP response size in MiB. Range: 1–20.
    pub max_response_size_mb: u64,
    /// `User-Agent` header sent with every RDAP request.
    pub user_agent: String,
    /// How often (hours) to refresh the IANA bootstrap registry.
    pub bootstrap_refresh_hours: u64,
}

impl Default for RdapConfig {
    fn default() -> Self {
        Self {
            // Stage F · F1 — production-safe default (was 15 s pre-1.0).
            // Aligned with `rdap-core::DEFAULT_TIMEOUT`. Operators with
            // very slow upstreams should raise this knowingly; the
            // validator caps it at 30 s.
            timeout_seconds: 5,
            max_response_size_mb: 5,
            user_agent: "RDAPify/0.x".to_string(),
            bootstrap_refresh_hours: 24,
        }
    }
}

/// Response cache configuration.
///
/// ```toml
/// [cache]
/// type = "memory"
/// ttl_seconds = 3600
/// max_entries = 100000
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct CacheConfig {
    /// Storage backend for cached entries.
    #[serde(rename = "type")]
    pub backend: CacheType,
    /// Cache entry TTL in seconds. Range: 60–86400.
    pub ttl_seconds: u64,
    /// Maximum number of entries to keep in the cache.
    pub max_entries: u64,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            backend: CacheType::Memory,
            ttl_seconds: 3600,
            max_entries: 100_000,
        }
    }
}

/// SQLite storage backend configuration.
///
/// ```toml
/// [sqlite]
/// path = "~/.rdapify/cache.db"
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct SqliteConfig {
    /// Path to the SQLite database file. `~` is expanded to `$HOME`.
    pub path: String,
}

impl Default for SqliteConfig {
    fn default() -> Self {
        Self {
            path: "~/.rdapify/cache.db".to_string(),
        }
    }
}

/// Background monitoring worker configuration (Pro).
///
/// ```toml
/// [monitoring]
/// workers = 4
/// interval_seconds = 300
/// batch_size = 50
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct MonitoringConfig {
    /// Number of background monitoring workers. Range: 1–32.
    pub workers: u32,
    /// How often (seconds) to run a monitoring sweep.
    pub interval_seconds: u64,
    /// Number of domains processed per monitoring batch.
    pub batch_size: u32,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            workers: 4,
            interval_seconds: 300,
            batch_size: 50,
        }
    }
}

/// Webhook delivery configuration (Pro).
///
/// ```toml
/// [webhooks]
/// workers = 2
/// timeout_seconds = 10
/// max_retries = 7
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct WebhookConfig {
    /// Number of webhook delivery workers. Range: 1–32.
    pub workers: u32,
    /// Per-delivery HTTP request timeout in seconds. Range: 1–60.
    pub timeout_seconds: u64,
    /// Maximum delivery retry attempts.
    pub max_retries: u32,
}

impl Default for WebhookConfig {
    fn default() -> Self {
        Self {
            workers: 2,
            timeout_seconds: 10,
            max_retries: 7,
        }
    }
}

/// License validation configuration (Pro).
///
/// ```toml
/// [license]
/// path = "~/.rdapify/activation.rdap"
/// grace_days = 7
/// revocation_check_hours = 24
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct LicenseConfig {
    /// Path to the offline activation record. `~` is expanded to `$HOME`.
    pub path: String,
    /// Days the activation cache remains valid without re-checking. Range: 0–30.
    pub grace_days: u32,
    /// How often (hours) to check for license revocation.
    pub revocation_check_hours: u64,
}

impl Default for LicenseConfig {
    fn default() -> Self {
        Self {
            path: "~/.rdapify/activation.rdap".to_string(),
            grace_days: 7,
            revocation_check_hours: 24,
        }
    }
}

/// Structured logging configuration.
///
/// ```toml
/// [logging]
/// level = "info"
/// format = "json"
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct LoggingConfig {
    /// Minimum log severity to emit.
    pub level: LogLevel,
    /// Log line output format.
    pub format: LogFormat,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: LogLevel::Info,
            format: LogFormat::Json,
        }
    }
}

/// Prometheus-compatible metrics endpoint configuration (Stage D · D1).
///
/// ```toml
/// [metrics]
/// enabled = true
/// port = 9090
/// slow_request_threshold_ms = 500
/// top_n_origins = 50
/// histogram_buckets = [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct MetricsConfig {
    /// Expose the `/metrics` endpoint.
    pub enabled: bool,
    /// Port to bind the metrics HTTP server. Range: 1–65535.
    pub port: u16,
    /// Threshold above which a request is counted as slow and logged once.
    /// Default 500 ms — chosen to align with the `p95 ≤ 300 ms` SLO target
    /// while leaving headroom for a quiet warning band.
    pub slow_request_threshold_ms: u64,
    /// Cap on the number of distinct origins exposed as labels on
    /// `rdap_circuit_breaker_state` and `rdap_circuit_breaker_open_total`.
    /// The breaker registry itself is bounded at 1024 origins; this is a
    /// further export-side cap to keep Prometheus series count sane.
    pub top_n_origins: u32,
    /// Histogram bucket boundaries (seconds) for `rdap_latency_seconds` and
    /// `rdap_retry_after_seconds`. `None` uses the engine default
    /// (`rdap-metrics::default_buckets`).
    pub histogram_buckets: Option<Vec<f64>>,
}

impl Default for MetricsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            port: 9090,
            slow_request_threshold_ms: 500,
            top_n_origins: 50,
            histogram_buckets: None,
        }
    }
}

/// HTTP service binding configuration (service mode).
///
/// ```toml
/// [server]
/// host = "0.0.0.0"
/// port = 8080
/// ```
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default)]
pub struct ServerConfig {
    /// Interface address to bind (e.g. `"0.0.0.0"` or `"127.0.0.1"`).
    pub host: String,
    /// TCP port to listen on. Range: 1–65535.
    pub port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 8080,
        }
    }
}

// ── Root config ───────────────────────────────────────────────────────────────

/// Complete RDAPify configuration.
///
/// All sections have safe defaults so RDAPify runs without any config file.
///
/// # Minimal example
///
/// ```toml
/// [cache]
/// type = "memory"
///
/// [logging]
/// level = "info"
/// ```
///
/// Everything else uses defaults.
#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(default)]
pub struct RdapifyConfig {
    /// RDAP HTTP client settings.
    pub rdap: RdapConfig,
    /// Response cache settings.
    pub cache: CacheConfig,
    /// SQLite storage settings.
    pub sqlite: SqliteConfig,
    /// Background monitoring settings (Pro).
    pub monitoring: MonitoringConfig,
    /// Webhook delivery settings (Pro).
    pub webhooks: WebhookConfig,
    /// License validation settings (Pro).
    pub license: LicenseConfig,
    /// Structured logging settings.
    pub logging: LoggingConfig,
    /// Metrics endpoint settings.
    pub metrics: MetricsConfig,
    /// HTTP service binding settings (service mode).
    pub server: ServerConfig,
}
