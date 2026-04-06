# Prometheus Metrics

> **Purpose:** Monitor RDAPify Pro performance and health via Prometheus  
> **Package:** `@rdapify/pro` ≥ 0.4.0  
> **Related:** [Configuration](../configuration/rdapify-toml.md) | [Docker](../guides/docker.md)

---

## Overview

`@rdapify/pro` exposes a Prometheus-compatible metrics endpoint on port `9090` at `/metrics`.

```bash
curl http://localhost:9090/metrics
```

---

## Endpoint

| Endpoint | Port | Format |
|---------|------|--------|
| `/metrics` | `9090` | Prometheus text (OpenMetrics) |

---

## Available Metrics

### RDAP Query Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rdapify_queries_total` | Counter | Total RDAP queries executed, labelled by `type` (domain/ip/asn/nameserver/entity) |
| `rdapify_queries_duration_seconds` | Histogram | Query execution time in seconds |
| `rdapify_queries_errors_total` | Counter | Total query errors, labelled by `error_type` |
| `rdapify_queries_cache_hits_total` | Counter | Total cache hits |
| `rdapify_queries_cache_misses_total` | Counter | Total cache misses |

### License Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rdapify_license_valid` | Gauge | `1` if the active license is valid, `0` otherwise |
| `rdapify_license_expiry_seconds` | Gauge | Seconds until license expiry (`-1` if perpetual) |
| `rdapify_license_activations_total` | Counter | Total activation attempts |
| `rdapify_license_heartbeat_total` | Counter | Total heartbeat validations |

### Webhook Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rdapify_webhooks_delivered_total` | Counter | Total webhook deliveries, labelled by `status` (success/failure) |
| `rdapify_webhooks_retries_total` | Counter | Total retry attempts |
| `rdapify_webhooks_dlq_size` | Gauge | Current dead letter queue size |
| `rdapify_webhooks_delivery_duration_seconds` | Histogram | Webhook delivery latency |

### Monitoring Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rdapify_monitors_active` | Gauge | Number of active domain monitors |
| `rdapify_monitor_checks_total` | Counter | Total monitor checks executed |
| `rdapify_monitor_alerts_total` | Counter | Total alerts fired, labelled by `alert_type` |

### System Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `rdapify_uptime_seconds` | Counter | Service uptime in seconds |
| `rdapify_build_info` | Gauge | Build metadata (version, commit, date) as labels |

---

## Prometheus Scrape Config

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'rdapify-pro'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
    metrics_path: /metrics
```

---

## Grafana Dashboard

A sample Grafana dashboard JSON is available at `docs/grafana/rdapify-dashboard.json` in the `@rdapify/pro` repository.

Key panels:
- Query rate and error rate (queries/sec)
- P50/P95/P99 query latency
- Cache hit ratio
- Webhook delivery success rate
- License status and expiry

---

## Docker

The metrics port is exposed as `9090` in the official Docker image:

```bash
docker run \
  -p 8080:8080 \
  -p 9090:9090 \
  rdapify/rdapify:0.4.0
```

To change the metrics port:

```bash
docker run \
  -e RDAP_METRICS_PORT=9091 \
  -p 8080:8080 \
  -p 9091:9091 \
  rdapify/rdapify:0.4.0
```
