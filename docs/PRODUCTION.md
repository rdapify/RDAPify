# RDAPify — Production Deployment Guide

Running RDAPify reliably at scale.

---

## Deployment Options

| Option | Best for | Complexity |
|---|---|---|
| CLI in cron | Scheduled lookups, monitoring scripts | Low |
| Rust library embedded | Applications with direct Rust deps | Low |
| Node.js / Python binding | Web apps, APIs | Low |
| Docker container (service) | Microservices, Kubernetes | Medium |
| Direct binary (service) | VM/bare-metal, systemd | Medium |

---

## Service Mode

The `rdapify-service` binary exposes RDAP queries over HTTP, making RDAPify accessible to any language.

### systemd unit

```ini
# /etc/systemd/system/rdapify.service
[Unit]
Description=RDAPify RDAP Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=rdapify
Group=rdapify
ExecStart=/usr/local/bin/rdapify-service
Restart=on-failure
RestartSec=5s

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=

# Environment
Environment=RDAPIFY_PORT=7080
Environment=LOG_LEVEL=info
Environment=LOG_FORMAT=json
Environment=RDAPIFY_CACHE_TTL=300
Environment=RDAPIFY_RATE_LIMIT_RPS=60
EnvironmentFile=-/etc/rdapify/env

[Install]
WantedBy=multi-user.target
```

```bash
# Create service user
useradd -r -s /bin/false rdapify

# Install binary
install -m 755 target/release/rdapify-service /usr/local/bin/

# Enable and start
systemctl daemon-reload
systemctl enable rdapify
systemctl start rdapify
journalctl -u rdapify -f
```

---

## Reverse Proxy (nginx)

Put nginx in front of `rdapify-service` for TLS termination and rate limiting.

```nginx
# /etc/nginx/sites-available/rdapify
upstream rdapify {
    server 127.0.0.1:7080;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name rdap.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/rdap.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rdap.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # Rate limiting (per IP)
    limit_req_zone $binary_remote_addr zone=rdapify:10m rate=30r/m;
    limit_req zone=rdapify burst=10 nodelay;

    location / {
        proxy_pass         http://rdapify;
        proxy_http_version 1.1;
        proxy_set_header   Connection "";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 30s;
    }

    # Do not expose metrics publicly
    location /metrics {
        deny all;
    }
}
```

---

## Kubernetes Deployment

```yaml
# rdapify-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rdapify
  namespace: tools
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rdapify
  template:
    metadata:
      labels:
        app: rdapify
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "7080"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        fsGroup: 65532
      containers:
        - name: rdapify
          image: ghcr.io/rdapify/rdapify:0.3.0
          ports:
            - containerPort: 7080
          env:
            - name: LOG_FORMAT
              value: json
            - name: RDAPIFY_CACHE_TTL
              value: "300"
            - name: RDAPIFY_RATE_LIMIT_RPS
              value: "60"
            - name: METRICS_TOKEN
              valueFrom:
                secretKeyRef:
                  name: rdapify-secrets
                  key: metrics-token
          resources:
            requests:
              cpu: "100m"
              memory: "64Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
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
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]

---
apiVersion: v1
kind: Service
metadata:
  name: rdapify
  namespace: tools
spec:
  selector:
    app: rdapify
  ports:
    - port: 7080
      targetPort: 7080
```

```bash
kubectl apply -f rdapify-deployment.yaml
kubectl rollout status deployment/rdapify -n tools
kubectl logs -l app=rdapify -n tools -f
```

---

## Cache Tuning

| Scenario | `RDAPIFY_CACHE_TTL` | `RDAPIFY_CACHE_SIZE` |
|---|---|---|
| Low traffic, many unique queries | 300 (5 min) | 1000 |
| High traffic, repeated domains | 900 (15 min) | 5000 |
| Domain monitoring (fresh data) | 60 (1 min) | 500 |
| Read-heavy, stable domain set | 3600 (1 hr) | 10000 |

Memory footprint: approximately 2 KB per cached entry.

---

## Connection Pool Sizing

RDAPify creates one `reqwest::Client` shared across all queries. The client uses Tokio's async I/O with connection pooling.

| Variable | Notes |
|---|---|
| Connection pool | Auto-managed by `hyper` (per host) |
| TLS session reuse | Yes (via `rustls`) |
| Concurrent requests | Bounded by `RDAPIFY_RATE_LIMIT_RPS` |

No manual tuning required for most workloads. The service scales horizontally — run multiple instances behind a load balancer if you need more throughput.

---

## Outbound Network Requirements

RDAPify makes HTTPS (port 443) requests to:
- `data.iana.org` — IANA bootstrap files (DNS, IP, ASN, NS, objects)
- Various RDAP servers (e.g., `rdap.verisign.com`, `rdap.arin.net`, etc.)

Ensure your firewall or security group allows outbound TCP 443 to `0.0.0.0/0` from the RDAPify process/pod.

SSRF protection is enabled by default and prevents RDAPify from querying internal or private addresses.

---

## Graceful Shutdown

The service responds to `SIGTERM` and `SIGINT`:
1. Stops accepting new connections.
2. Waits up to 30 seconds for in-flight requests to complete.
3. Exits with code `0`.

For rolling deployments (Kubernetes, Docker Swarm), rely on the standard `SIGTERM` → drain → stop lifecycle. No special configuration needed.

---

## Log Format

In `LOG_FORMAT=json` mode (production default), each log line is a JSON object:

```json
{
  "timestamp": "2026-04-06T12:00:00.000Z",
  "level": "INFO",
  "target": "rdap_service::routes",
  "message": "query completed",
  "fields": {
    "query_type": "domain",
    "input": "example.com",
    "duration_ms": 87,
    "cache": "miss",
    "status": "success"
  }
}
```

Ingest into your log aggregator (ELK, Loki, Datadog, etc.) for analysis.

---

## Alerting

| Alert | Condition | Action |
|---|---|---|
| High error rate | `rdapify_http_errors_total` rate > 10/min for 5 min | Investigate RDAP server outage |
| Cache starvation | `rdapify_cache_size` < 100 with high traffic | Increase `RDAPIFY_CACHE_SIZE` |
| Bootstrap stale | `rdapify_bootstrap_age_seconds > 172800` (48h) | Check outbound network to data.iana.org |
| Latency spike | P99 > 500ms | Check upstream RDAP servers |
| Rate limit abuse | `rdapify_rate_limit_hits_total` > 100/min | Review calling patterns, adjust `RDAPIFY_RATE_LIMIT_BURST` |

See [MONITORING.md](MONITORING.md) for the full Prometheus + Grafana setup.
