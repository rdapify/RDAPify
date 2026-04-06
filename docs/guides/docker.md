# Docker Deployment

> **Purpose:** Run RDAPify Pro as a containerised service  
> **Package:** `@rdapify/pro` ≥ 0.4.0  
> **Related:** [Configuration](../configuration/rdapify-toml.md) | [Metrics](../metrics/prometheus.md) | [License Activation](../pro/license-activation.md)

---

## Quick Start

```bash
docker run \
  -e RDAP_LICENSE_KEY=your-license-key \
  -p 8080:8080 \
  -p 9090:9090 \
  rdapify/rdapify:0.4.0
```

---

## Ports

| Port | Endpoint | Description |
|------|---------|-------------|
| `8080` | `/health` | Health check — returns `200 OK` when ready |
| `8080` | `/version` | Version info JSON |
| `9090` | `/metrics` | Prometheus metrics |

---

## Health Check

```bash
curl http://localhost:8080/health
# → {"status":"ok","version":"0.4.0"}

curl http://localhost:8080/version
# → {"version":"0.4.0","rust":"1.77.0","build":"release"}
```

---

## Environment Variables

| Variable | Default | Description |
|---------|---------|-------------|
| `RDAP_LICENSE_KEY` | — | **Required.** Your @rdapify/pro license key |
| `RDAP_LOG_FORMAT` | `json` | Log format: `json` or `text` |
| `RDAP_LOG_LEVEL` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error` |
| `RDAP_SERVICE_PORT` | `8080` | HTTP API port |
| `RDAP_METRICS_PORT` | `9090` | Prometheus metrics port |
| `RDAP_CACHE_TTL_SECS` | `300` | Response cache TTL |
| `RDAP_CONFIG` | — | Path to `rdapify.toml` inside the container |

---

## Docker Compose

```yaml
version: '3.8'

services:
  rdapify:
    image: rdapify/rdapify:0.4.0
    ports:
      - "8080:8080"
      - "9090:9090"
    environment:
      RDAP_LICENSE_KEY: ${RDAP_LICENSE_KEY}
      RDAP_LOG_FORMAT: json
      RDAP_LOG_LEVEL: warn
    volumes:
      - ./rdapify.toml:/app/rdapify.toml:ro
      - rdapify-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9091:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    depends_on:
      - rdapify

volumes:
  rdapify-data:
```

---

## Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rdapify
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
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: rdapify
          image: rdapify/rdapify:0.4.0
          ports:
            - containerPort: 8080
            - containerPort: 9090
          env:
            - name: RDAP_LICENSE_KEY
              valueFrom:
                secretKeyRef:
                  name: rdapify-license
                  key: key
            - name: RDAP_LOG_FORMAT
              value: "json"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: rdapify
spec:
  selector:
    app: rdapify
  ports:
    - name: api
      port: 8080
      targetPort: 8080
    - name: metrics
      port: 9090
      targetPort: 9090
```

---

## Multi-stage Build (custom image)

If you need to customise the image:

```dockerfile
FROM rdapify/rdapify:0.4.0 AS base

# Add custom CA certificates
COPY ca-bundle.crt /usr/local/share/ca-certificates/custom.crt
RUN update-ca-certificates

# Override default config
COPY rdapify.toml /app/rdapify.toml
```

---

## Image Details

| Property | Value |
|---------|-------|
| Base image | `gcr.io/distroless/cc-debian12` |
| Architecture | `linux/amd64`, `linux/arm64` |
| User | non-root (`10001`) |
| Data directory | `/app/data` |
| Config path | `/app/rdapify.toml` |
| Binary | `/app/rdapify-pro-service` |
