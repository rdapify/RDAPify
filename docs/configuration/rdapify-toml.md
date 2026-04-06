# Configuration — rdapify.toml

> **Purpose:** Configure rdapify behaviour via a TOML file or environment variables  
> **Crate:** `rdap-config` (feature: default in service builds)  
> **Related:** [Logging](../guides/logging.md) | [Metrics](../metrics/prometheus.md) | [Docker](../guides/docker.md)

---

## Overview

RDAPify reads configuration from `rdapify.toml` in the current working directory. Every setting can be overridden with an environment variable (uppercase, `RDAP_` prefix).

---

## Full Example

```toml
# rdapify.toml

[client]
# Maximum concurrent connections per RDAP registry
max_connections = 10

# Request timeout in milliseconds
timeout_ms = 10000

# Follow redirects (up to redirect_limit hops)
follow_redirects = true
redirect_limit = 5

# Maximum response body size in bytes (default 1 MB)
max_response_bytes = 1048576

[cache]
# Enable in-memory response cache
enabled = true

# Maximum number of cached entries
max_entries = 1000

# TTL for cached responses in seconds
ttl_secs = 300

[security]
# Block requests to private IP ranges (SSRF protection)
block_private_ips = true

# Resolve DNS before connecting (DNS rebinding protection)
pre_resolve_dns = true

# Allowed redirect schemes
allowed_redirect_schemes = ["https"]

[logging]
# Format: "json" or "text"
format = "json"

# Level: "trace", "debug", "info", "warn", "error"
level = "info"

# Output: "stdout" or "stderr"
output = "stdout"

[service]
# HTTP API port (/health, /version)
port = 8080

# Metrics port (Prometheus /metrics endpoint)
metrics_port = 9090

# Bind address
bind = "0.0.0.0"

[rate_limit]
# Enable per-registry rate limiting
enabled = false

# Maximum requests per second per registry
requests_per_second = 10

# Burst capacity
burst = 20
```

---

## Environment Variable Overrides

Every setting maps to an environment variable:

| Setting | Environment Variable | Example |
|---------|---------------------|---------|
| `client.timeout_ms` | `RDAP_CLIENT_TIMEOUT_MS` | `RDAP_CLIENT_TIMEOUT_MS=5000` |
| `client.max_connections` | `RDAP_CLIENT_MAX_CONNECTIONS` | `RDAP_CLIENT_MAX_CONNECTIONS=20` |
| `cache.enabled` | `RDAP_CACHE_ENABLED` | `RDAP_CACHE_ENABLED=false` |
| `cache.ttl_secs` | `RDAP_CACHE_TTL_SECS` | `RDAP_CACHE_TTL_SECS=600` |
| `logging.format` | `RDAP_LOG_FORMAT` | `RDAP_LOG_FORMAT=json` |
| `logging.level` | `RDAP_LOG_LEVEL` | `RDAP_LOG_LEVEL=debug` |
| `service.port` | `RDAP_SERVICE_PORT` | `RDAP_SERVICE_PORT=8080` |
| `service.metrics_port` | `RDAP_METRICS_PORT` | `RDAP_METRICS_PORT=9090` |
| `security.block_private_ips` | `RDAP_BLOCK_PRIVATE_IPS` | `RDAP_BLOCK_PRIVATE_IPS=true` |

---

## Configuration File Location

RDAPify searches for `rdapify.toml` in this order:

1. Path from `RDAP_CONFIG` environment variable
2. `./rdapify.toml` (current working directory)
3. `~/.config/rdapify/rdapify.toml` (user config)
4. Built-in defaults (no file required)

---

## Minimal Production Config

```toml
[logging]
format = "json"
level = "warn"

[security]
block_private_ips = true
pre_resolve_dns = true

[cache]
enabled = true
ttl_secs = 300
```

---

## Docker Usage

Mount your config file as a volume:

```bash
docker run \
  -v $(pwd)/rdapify.toml:/app/rdapify.toml \
  -p 8080:8080 \
  -p 9090:9090 \
  rdapify/rdapify:0.4.0
```

Or use environment variables directly:

```bash
docker run \
  -e RDAP_LOG_FORMAT=json \
  -e RDAP_LOG_LEVEL=warn \
  -e RDAP_CACHE_TTL_SECS=600 \
  -p 8080:8080 \
  rdapify/rdapify:0.4.0
```
