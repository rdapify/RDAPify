# RDAPify — Docker

Run RDAPify as a container for consistent, isolated deployment.

---

## Quick Start

```bash
# One-shot query
docker run --rm ghcr.io/rdapify/rdapify domain github.com

# Run as HTTP service on port 7080
docker run -d -p 7080:7080 --name rdapify ghcr.io/rdapify/rdapify serve

# Query the service
curl http://localhost:7080/v1/domain/example.com
curl http://localhost:7080/health
```

---

## Image Details

| Tag | Base | Size | Notes |
|---|---|---|---|
| `latest` | distroless/cc-debian12:nonroot | < 40 MB | Production recommended |
| `0.3.x` | distroless/cc-debian12:nonroot | < 40 MB | Pinned version |
| `debug` | debian:12-slim | ~120 MB | Includes shell for debugging |

Images run as a non-root user (`nonroot:nonroot`, UID 65532) by default.

Platform support: `linux/amd64`, `linux/arm64`.

---

## Running as a Service

### Single container

```bash
docker run -d \
  --name rdapify \
  -p 7080:7080 \
  -e RDAPIFY_CACHE_TTL=300 \
  -e RDAPIFY_RATE_LIMIT_RPS=60 \
  -e LOG_LEVEL=info \
  -e LOG_FORMAT=json \
  --restart unless-stopped \
  ghcr.io/rdapify/rdapify serve
```

### Docker Compose

```yaml
# docker-compose.yml
version: "3.9"

services:
  rdapify:
    image: ghcr.io/rdapify/rdapify:latest
    command: serve
    ports:
      - "7080:7080"
    environment:
      LOG_LEVEL: info
      LOG_FORMAT: json
      RDAPIFY_CACHE_TTL: "300"
      RDAPIFY_CACHE_SIZE: "1000"
      RDAPIFY_TIMEOUT: "10"
      RDAPIFY_RATE_LIMIT_RPS: "60"
      RDAPIFY_RATE_LIMIT_BURST: "10"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:7080/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  # Optional: Prometheus scraper
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    depends_on:
      - rdapify
```

```bash
docker compose up -d
docker compose logs -f rdapify
```

---

## Building Locally

```dockerfile
# Dockerfile
FROM rust:1.77-slim AS builder

WORKDIR /build

COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/build/target \
    cargo build --release --bin rdapify-service

FROM gcr.io/distroless/cc-debian12:nonroot AS runtime

COPY --from=builder /build/target/release/rdapify-service /usr/local/bin/rdapify-service

EXPOSE 7080

USER nonroot:nonroot

ENTRYPOINT ["/usr/local/bin/rdapify-service"]
```

```bash
docker build -t rdapify:local .
docker run --rm rdapify:local domain github.com
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RDAPIFY_HOST` | `0.0.0.0` | Bind address |
| `RDAPIFY_PORT` | `7080` | Bind port |
| `RDAPIFY_CACHE_TTL` | `300` | Cache TTL (seconds) |
| `RDAPIFY_CACHE_SIZE` | `1000` | Max cache entries |
| `RDAPIFY_TIMEOUT` | `10` | HTTP request timeout (seconds) |
| `RDAPIFY_RATE_LIMIT_RPS` | `60` | Requests per second per IP |
| `RDAPIFY_RATE_LIMIT_BURST` | `10` | Burst capacity |
| `METRICS_TOKEN` | _(none)_ | Bearer token for `/metrics` endpoint |
| `LOG_LEVEL` | `info` | Tracing filter (`error`/`warn`/`info`/`debug`/`trace`) |
| `LOG_FORMAT` | `json` | Log format (`json` or `pretty`) |

---

## Health Checks

```bash
# Liveness: is the service running?
curl http://localhost:7080/health
# {"status":"ok","version":"0.3.0"}

# Readiness: is bootstrap data loaded?
curl http://localhost:7080/ready
# {"status":"ready"} or HTTP 503 if bootstrap not yet loaded
```

Kubernetes probe example:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 7080
  initialDelaySeconds: 5
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 7080
  initialDelaySeconds: 10
  periodSeconds: 10
```

---

## Prometheus Metrics

```bash
# Metrics endpoint (returns Prometheus text format)
curl http://localhost:7080/metrics

# With auth token
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:7080/metrics
```

See [MONITORING.md](MONITORING.md) for the full Grafana dashboard and alerting setup.

---

## Resource Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 0.1 vCPU | 0.5 vCPU |
| Memory | 32 MB | 128 MB |
| Disk | none | none |
| Network | Outbound HTTPS (443) | Outbound HTTPS (443) |

Memory usage scales with cache size: ~2 KB per entry. 1000 entries ≈ 2 MB of cache.

---

## Security Notes

- The container runs as `nonroot` (UID 65532) — no `sudo`, no `setuid` binaries
- The distroless image has no shell, no package manager, no `curl`
- SSRF protection is enabled by default — the service cannot be used to probe internal networks
- Rate limiting protects against abuse
- The `/metrics` endpoint should be protected by `METRICS_TOKEN` or network policy in production
