# RDAPify — Configuration Reference

RDAPify can be configured via a TOML file, environment variables, or the Rust API.
Priority order (highest first): environment variables > config file > defaults.

---

## Config File

By default RDAPify looks for `rdapify.toml` in the current directory.
Override with `--config path/to/rdapify.toml` or `RDAPIFY_CONFIG=/path/to/rdapify.toml`.

```toml
# rdapify.toml — full reference with defaults

[client]
# HTTP timeout per request (seconds)
timeout_secs = 10

# Maximum retry attempts on network error or 5xx
max_retries = 3

# Maximum number of redirects to follow per request
max_redirects = 5

# Maximum response body size (bytes). Responses larger than this are rejected.
max_response_bytes = 10_485_760  # 10 MB

# Enable in-memory response cache
cache = true

# Default cache TTL (seconds). Applied to all query types unless overridden below.
cache_ttl_secs = 300  # 5 minutes

# Per-type cache TTLs (optional — override cache_ttl_secs for specific types)
cache_domain_ttl_secs = 300   # 5 minutes
cache_ip_ttl_secs     = 900   # 15 minutes
cache_asn_ttl_secs    = 3600  # 1 hour
cache_ns_ttl_secs     = 300   # 5 minutes

# Maximum entries in the cache (LRU eviction when exceeded)
cache_max_entries = 1000

# Bootstrap data TTL (seconds). IANA files are refreshed at this interval.
bootstrap_ttl_secs = 86400  # 24 hours


[security]
# Enable SSRF protection (recommended: always true in production)
enabled = true

# Additional hostnames/domains to block (exact match or suffix)
# Example: ["internal.corp", "10.in-addr.arpa"]
blocked_domains = []

# Allowlist — if non-empty, ONLY these domains are permitted
# Takes priority over blocked_domains and all IP checks
# Example: ["rdap.verisign.com", "rdap.arin.net"]
allowed_domains = []


[service]
# Bind address for the HTTP service
host = "0.0.0.0"

# Bind port
port = 7080

# Requests per second per source IP (token bucket)
rate_limit_rps = 60

# Burst capacity above rate_limit_rps
rate_limit_burst = 10

# Bearer token for the /metrics endpoint (empty = no auth required)
# Recommended: set via environment variable METRICS_TOKEN instead
metrics_token = ""


[logging]
# Tracing filter: error, warn, info, debug, trace
level = "info"

# Output format: "json" (production) or "pretty" (development)
format = "json"
```

---

## Environment Variables

All configuration keys can also be set as environment variables by uppercasing and prefixing with `RDAPIFY_`:

| Variable | Config key | Default |
|---|---|---|
| `RDAPIFY_TIMEOUT` | `client.timeout_secs` | `10` |
| `RDAPIFY_MAX_RETRIES` | `client.max_retries` | `3` |
| `RDAPIFY_MAX_REDIRECTS` | `client.max_redirects` | `5` |
| `RDAPIFY_CACHE` | `client.cache` | `true` |
| `RDAPIFY_CACHE_TTL` | `client.cache_ttl_secs` | `300` |
| `RDAPIFY_CACHE_SIZE` | `client.cache_max_entries` | `1000` |
| `RDAPIFY_SECURITY_ENABLED` | `security.enabled` | `true` |
| `RDAPIFY_HOST` | `service.host` | `0.0.0.0` |
| `RDAPIFY_PORT` | `service.port` | `7080` |
| `RDAPIFY_RATE_LIMIT_RPS` | `service.rate_limit_rps` | `60` |
| `RDAPIFY_RATE_LIMIT_BURST` | `service.rate_limit_burst` | `10` |
| `METRICS_TOKEN` | `service.metrics_token` | _(none)_ |
| `LOG_LEVEL` | `logging.level` | `info` |
| `LOG_FORMAT` | `logging.format` | `json` |

---

## Rust API Configuration

For library users who configure via code:

```rust
use rdapify::{RdapClient, ClientConfig, CacheConfig, FetcherConfig};
use rdap_security::SsrfConfig;
use std::time::Duration;

let client = RdapClient::with_config(ClientConfig {
    // HTTP fetcher settings
    fetcher: FetcherConfig {
        timeout: Duration::from_secs(10),
        max_attempts: 3,
        max_redirects: 5,
        max_response_bytes: 10 * 1024 * 1024,
        ..Default::default()
    },

    // Cache settings
    cache: true,
    cache_config: CacheConfig {
        ttl: Duration::from_secs(300),
        max_entries: 1_000,
        ..Default::default()
    },

    // Security settings
    ssrf: SsrfConfig {
        enabled: true,
        blocked_domains: vec!["internal.corp".into()],
        allowed_domains: vec![],
    },

    // Bootstrap settings
    bootstrap_url: None,  // None = use official IANA endpoint

    ..Default::default()
})?;
```

---

## Common Configurations

### Development (fast, no security checks)

```toml
[client]
timeout_secs = 30
cache_ttl_secs = 60

[security]
enabled = false  # ONLY for local development testing

[logging]
level = "debug"
format = "pretty"
```

### Production (secure, high cache)

```toml
[client]
timeout_secs = 10
max_retries = 3
cache = true
cache_ttl_secs = 600
cache_max_entries = 5000

[security]
enabled = true

[service]
rate_limit_rps = 100
rate_limit_burst = 20

[logging]
level = "info"
format = "json"
```

### Domain monitoring (fresh data, low TTL)

```toml
[client]
cache_ttl_secs = 60
cache_domain_ttl_secs = 60
cache_max_entries = 500

[logging]
level = "warn"
```

### Locked-down (only query specific RDAP servers)

```toml
[security]
enabled = true
allowed_domains = [
    "rdap.verisign.com",
    "rdap.arin.net",
    "rdap.ripe.net",
    "rdap.apnic.net",
    "rdap.lacnic.net",
    "rdap.afrinic.net",
]
```

---

## Validate Config

```bash
# Check config file for errors
rdapify config validate

# Show effective config (merged: file + env vars)
rdapify config show

# With custom config file
rdapify --config /etc/rdapify/rdapify.toml config show
```
