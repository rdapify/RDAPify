# Production Deployment Guide

> **Purpose:** Ship RDAPify to production in under 30 minutes  
> **Audience:** Operations engineers, platform teams  
> **Related:** [Docker Deployment](docker.md) | [Observability](observability.md) | [Performance](performance.md) | [Security](security-privacy.md)

---

## Deployment Modes

| Mode | Best For | Trade-off |
|------|----------|-----------|
| **CLI** | Manual ad-hoc queries | No automation, single-machine |
| **Library** | Embedded in Node.js apps | Must manage lifecycle, app-bound |
| **Service** | Dedicated API server | Separate process, network overhead |
| **Docker** | Isolated, reproducible | Container runtime dependency |
| **Monitoring Stack** | Production resilience | Prometheus + Grafana overhead |

**Recommendation:** Use Docker with monitoring stack for production. Provides isolation, observability, and reproducible deployments.

---

## Recommended Production Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│                    (Load Balancer / nginx)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ▼
        ┌────────────────────────────────────┐
        │      RDAPify Service (Port 8080)   │
        │  - API endpoints                   │
        │  - Health checks                   │
        │  - Webhook event emission          │
        └────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌──────────┐    ┌───────────┐
   │  RDAP   │    │ SQLite   │    │ Webhooks  │
   │ Servers │    │  Cache   │    │ Endpoints │
   │         │    │ & State  │    │           │
   └─────────┘    └──────────┘    └───────────┘
                         │
                         ▼
            ┌──────────────────────────┐
            │  File Backups (Daily)    │
            │  - *.db files            │
            │  - activation.rdap       │
            │  - license_state.db      │
            └──────────────────────────┘


    ┌─────────────────────────────────┐
    │  Prometheus (Port 9091)         │
    │  - Scrapes RDAPify metrics      │
    │  - 15s interval                 │
    │  - 15-day retention             │
    └──────────────┬──────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Grafana (Port 3000)         │
    │  - Dashboard queries         │
    │  - Alert rules               │
    │  - Team access controls      │
    └──────────────────────────────┘
```

---

## Docker Deployment

### Quick Start (5 minutes)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rdapify:
    image: rdapify/rdapify:0.4.0
    container_name: rdapify-api
    ports:
      - "8080:8080"    # API endpoint
      - "9090:9090"    # Metrics endpoint
    environment:
      RDAP_LICENSE_KEY: ${RDAP_LICENSE_KEY}
      RDAP_LOG_FORMAT: json
      RDAP_LOG_LEVEL: warn
      RDAP_SERVICE_PORT: "8080"
      RDAP_METRICS_PORT: "9090"
    volumes:
      - ./rdapify.toml:/app/rdapify.toml:ro
      - rdapify-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - rdapify-net
    user: "10001"
    read_only_root_filesystem: true
    security_opt:
      - no-new-privileges:true

  prometheus:
    image: prom/prometheus:latest
    container_name: rdapify-prometheus
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--storage.tsdb.retention.time=15d"
    restart: unless-stopped
    networks:
      - rdapify-net
    depends_on:
      - rdapify

  grafana:
    image: grafana/grafana:latest
    container_name: rdapify-grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana-dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana-datasources.yml:/etc/grafana/provisioning/datasources/prometheus.yml:ro
    restart: unless-stopped
    networks:
      - rdapify-net
    depends_on:
      - prometheus

volumes:
  rdapify-data:
  prometheus-data:
  grafana-data:

networks:
  rdapify-net:
    driver: bridge
```

### Launch

```bash
# Create .env file with secrets
cat > .env << EOF
RDAP_LICENSE_KEY=<LICENSE_KEY>
GRAFANA_PASSWORD=<STRONG_PASSWORD>
EOF

# Start all services
docker compose up -d

# Verify health
sleep 5
curl http://localhost:8080/health
curl http://localhost:8080/version

# Check logs
docker compose logs -f rdapify
```

---

## Configuration File

Create `rdapify.toml` in your project root:

```toml
# rdapify.toml - Production Configuration

[service]
# HTTP API server
port = 8080
bind_address = "0.0.0.0"
request_timeout_secs = 30
max_concurrent_requests = 100

[cache]
# Response caching strategy
type = "sqlite"           # sqlite (persistent) or memory (fast)
ttl_secs = 300           # Time-to-live for cached entries
max_size_mb = 500        # Maximum cache size
enable_compression = true # Compress cached entries

[sqlite]
# Local cache and state persistence
path = "/app/data/rdapify.db"
wal_mode = true          # Write-Ahead Logging for concurrent reads
journal_mode = "wal"
busy_timeout_ms = 5000
pool_size = 10

[monitoring]
# Prometheus metrics exposure
enabled = true
metrics_port = 9090
metrics_bind_address = "0.0.0.0"
metrics_path = "/metrics"

[webhooks]
# Event notifications
enabled = true
url = "https://your-webhook.example.com/rdapify-events"
secret = "<WEBHOOK_SECRET>"
timeout_secs = 10
retry_attempts = 3
retry_backoff_secs = 5
# Events: lookup_complete, lookup_failed, quota_exceeded, license_expiring
events = [
  "lookup_failed",
  "quota_exceeded",
  "license_expiring"
]

[license]
# License activation
key = "<LICENSE_KEY>"
activation_file = "/app/data/activation.rdap"
check_interval_secs = 3600

[logging]
# Structured logging
level = "warn"           # trace, debug, info, warn, error
format = "json"          # json (production) or text (development)
timestamp_format = "iso8601"

[metrics]
# Prometheus scrape configuration
bind_address = "0.0.0.0:9090"
path = "/metrics"
histogram_buckets = [0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]

[rdap_servers]
# Upstream RDAP server pools
[rdap_servers.iana]
url = "https://rdap.iana.org"
timeout_secs = 15
max_retries = 2

[rdap_servers.verisign]
url = "https://rdap.verisign.com"
timeout_secs = 15
max_retries = 2

[performance]
# Concurrency and connection pooling
worker_threads = 4       # Number of concurrent RDAP workers
batch_size = 50          # Bulk lookup batch size
connection_pool_size = 20
keepalive_secs = 30
```

---

## Backups and Recovery

### Backup Strategy

**Data to protect:**
- `rdapify.db` — cached responses and state
- `activation.rdap` — license activation token
- `license_state.db` — license metadata

### Backup Script

Create `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/rdapify"
DATA_DIR="/home/rdapify/.rdapify"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="rdapify_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

# Back up all relevant data files
tar -czf "$BACKUP_DIR/$BACKUP_NAME" \
  "$DATA_DIR/rdapify.db" \
  "$DATA_DIR/activation.rdap" \
  "$DATA_DIR/license_state.db" \
  /etc/rdapify/rdapify.toml \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_NAME"
  # Keep last 30 backups
  ls -t "$BACKUP_DIR"/rdapify_backup_*.tar.gz | tail -n +31 | xargs -r rm
else
  echo "Backup failed" >&2
  exit 1
fi
```

### Cron Job

```bash
# Run daily at 2 AM
0 2 * * * /usr/local/bin/backup.sh >> /var/log/rdapify-backup.log 2>&1
```

### Restore Procedure

```bash
# 1. Stop the service
docker compose down

# 2. Extract backup
tar -xzf /backups/rdapify/rdapify_backup_20260406_020000.tar.gz -C /

# 3. Fix permissions
chown -R rdapify:rdapify /home/rdapify/.rdapify

# 4. Restart
docker compose up -d

# 5. Verify
curl http://localhost:8080/health
```

---

## Monitoring and Alerts

### Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    environment: "production"
    service: "rdapify"

scrape_configs:
  - job_name: "rdapify"
    static_configs:
      - targets: ["rdapify:9090"]
    scrape_interval: 15s
    scrape_timeout: 5s
    metrics_path: "/metrics"
```

### Key Metrics to Monitor

| Metric | Purpose | Alert Threshold |
|--------|---------|-----------------|
| `rdapify_requests_total` | Request volume | Baseline + 50% |
| `rdapify_cache_hits_total` | Cache effectiveness | Track trend |
| `rdapify_cache_misses_total` | Upstream load | High = more cost |
| `rdapify_errors_total` | Error rate | > 1% is concerning |
| `rdapify_response_duration_seconds` | Latency | p95 > 2s is slow |
| `rdapify_license_expiry_days` | License status | < 30 days warning |

### Prometheus Alert Rules

Create `prometheus-alerts.yml`:

```yaml
groups:
  - name: rdapify_alerts
    interval: 30s
    rules:
      - alert: RDAPIFyHighErrorRate
        expr: |
          (increase(rdapify_errors_total[5m]) / increase(rdapify_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RDAPify error rate > 1%"
          description: "Error rate: {{ $value | humanizePercentage }}"

      - alert: RDAPIFyHighLatency
        expr: histogram_quantile(0.95, rdapify_response_duration_seconds_bucket) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "RDAPify p95 latency > 2 seconds"

      - alert: RDAPIFyLicenseExpiring
        expr: rdapify_license_expiry_days < 30
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "RDAPify license expires in {{ $value }} days"

      - alert: RDAPIFyDown
        expr: up{job="rdapify"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "RDAPify service is down"
```

### Webhook Events

RDAPify emits webhook events for operational events:

```json
{
  "event_type": "lookup_failed",
  "timestamp": "2026-04-06T10:30:00Z",
  "query": {
    "type": "domain",
    "value": "example.com"
  },
  "error": "RDAP server timeout",
  "retry_count": 2
}
```

**Events:**
- `lookup_complete` — successful query
- `lookup_failed` — all retries exhausted
- `quota_exceeded` — rate limit hit
- `license_expiring` — < 30 days to expiry

---

## Security Recommendations

### Reverse Proxy (nginx)

```nginx
upstream rdapify {
  server rdapify:8080;
}

server {
  listen 443 ssl http2;
  server_name rdapify.example.com;

  ssl_certificate /etc/letsencrypt/live/rdapify.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/rdapify.example.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;

  # API endpoint
  location /api/ {
    proxy_pass http://rdapify;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 30s;
  }

  # Health check only from LB
  location /health {
    allow 10.0.0.0/8;
    deny all;
    proxy_pass http://rdapify;
  }

  # Metrics: firewall or require auth
  location /metrics {
    deny all;
    # Or use ngx_http_auth_basic_module with API key
  }
}
```

### Security Checklist

- **Never expose metrics publicly.** Firewall port 9090, or put behind authentication.
- **Protect license files.** File permissions: `600`, owned by service user.
  ```bash
  chmod 600 /app/data/activation.rdap
  chmod 600 /app/data/license_state.db
  chown rdapify:rdapify /app/data/*.rdap /app/data/*.db
  ```
- **Use HTTPS.** Terminate SSL at reverse proxy, enforce TLS 1.2+.
- **Run as non-root.** Docker image uses user `10001`.
- **Restrict egress.** Only allow outbound traffic to RDAP servers:
  ```bash
  iptables -A OUTPUT -d 199.43.135.53 -p tcp --dport 443 -j ACCEPT
  iptables -A OUTPUT -j REJECT
  ```
- **Secret rotation.** Rotate `RDAP_LICENSE_KEY` and webhook secrets quarterly.

---

## Performance Tuning

### Key Configuration Parameters

| Parameter | Recommendation | Rationale |
|-----------|-----------------|-----------|
| `worker_threads` | `2 × CPU_CORES` | Allows overlapping I/O |
| `batch_size` | `50` (start), tune up to `200` | Balance memory vs throughput |
| `cache_type` | `sqlite` (prod), `memory` (dev) | SQLite survives restarts |
| `cache_ttl_secs` | `300–3600` | Balance freshness vs load |
| `max_concurrent_requests` | `100–500` | Depends on available memory |

### SQLite Optimization

```toml
[sqlite]
wal_mode = true           # Critical: enables concurrent reads
journal_mode = "wal"
busy_timeout_ms = 5000
synchronous = "normal"    # Faster than "full" without sacrificing safety
```

### Connection Reuse

Keep-alive to upstream RDAP servers:

```toml
[performance]
keepalive_secs = 30       # Reuse TCP connections for 30s
connection_pool_size = 20 # Maintain 20 persistent connections
```

### Cache Hit Rate Target

Monitor `rdapify_cache_hits_total / rdapify_requests_total`:

- **Target:** 70%+ for typical workloads
- **If < 50%:** Increase `cache_ttl_secs` or `cache_size_mb`
- **If hits plateau:** Workload is naturally uncacheable (unique domains)

### Benchmark Your Setup

```bash
# Load test with curl
for i in {1..100}; do
  curl -s "http://localhost:8080/api/domain/example${i}.com" &
done
wait

# Check metrics
curl http://localhost:9091/api/v1/query?query=rdapify_requests_total
curl http://localhost:9091/api/v1/query?query=rate%28rdapify_errors_total%5B5m%5D%29
```

---

## Upgrading RDAPify

### Pre-Upgrade Checklist

- [ ] Backup all databases (see §5)
- [ ] Review [CHANGELOG](../../CHANGELOG.md) for breaking changes
- [ ] Test in staging environment first
- [ ] Notify on-call team

### Upgrade Steps

```bash
# 1. Backup current state
./backup.sh

# 2. Stop service
docker compose down

# 3. Pull new image
docker pull rdapify/rdapify:0.4.1

# 4. Update docker-compose.yml
# Change: image: rdapify/rdapify:0.4.0 → image: rdapify/rdapify:0.4.1

# 5. Start service
docker compose up -d

# 6. Wait for health check
sleep 10

# 7. Verify health
curl http://localhost:8080/health
# Expected: {"status":"ok","version":"0.4.1"}

# 8. Verify metrics
curl http://localhost:9091/api/v1/query?query=rdapify_up

# 9. Monitor error rate for 10 minutes
watch -n 2 'curl -s http://localhost:9091/api/v1/query?query=rate%28rdapify_errors_total%5B5m%5D%29'

# 10. If issues, rollback:
docker compose down
docker pull rdapify/rdapify:0.4.0
# Update docker-compose.yml back to 0.4.0
docker compose up -d
```

### Verifying Upgrade Success

```bash
# Check version
curl http://localhost:8080/version | jq .version

# Check no error spikes (compare with baseline)
curl http://localhost:9091/api/v1/query?query=increase%28rdapify_errors_total%5B5m%5D%29

# Verify license still active
curl http://localhost:9090/metrics | grep rdapify_license_expiry_days
```

---

## Troubleshooting

### Service won't start

```bash
# Check logs
docker compose logs rdapify

# Common: License key not set
# Fix: Set RDAP_LICENSE_KEY in .env file

# Common: Port 8080 already in use
# Fix: Change port in docker-compose.yml or kill conflicting process
```

### High error rate

```bash
# Check RDAP server connectivity
curl -v https://rdap.iana.org/

# Check cache status
docker compose exec rdapify sqlite3 /app/data/rdapify.db ".tables"

# Check license
docker compose exec rdapify curl http://localhost:8080/api/license
```

### Slow responses

```bash
# Check cache hit ratio
curl http://localhost:9091/api/v1/query?query=rdapify_cache_hits_total

# Check latency distribution
curl http://localhost:9091/api/v1/query?query=histogram_quantile%280.99%2C+rdapify_response_duration_seconds_bucket%29
```

---

## Next Steps

- [Observability Guide](observability.md) — Set up detailed tracing and profiling
- [Performance Guide](performance.md) — Tune for 10k+ RPS
- [Security Guide](security-privacy.md) — Harden against PII leaks
- [Caching Strategies](caching-strategies.md) — Optimize cache policies
