# RDAPify — Monitoring with Prometheus + Grafana

RDAPify exposes Prometheus metrics at `/metrics` when running in service mode.

---

## Enabling Metrics

```bash
# Service automatically exposes /metrics
rdapify serve

# Or with Docker
docker run -d -p 7080:7080 ghcr.io/rdapify/rdapify serve

# Scrape
curl http://localhost:7080/metrics
```

To protect the metrics endpoint with a token:

```bash
METRICS_TOKEN=your-secret-token rdapify serve

# Access with token
curl -H "Authorization: Bearer your-secret-token" http://localhost:7080/metrics
```

---

## Available Metrics

### Query Counters

**`rdapify_queries_total`** — Counter  
Total RDAP queries, by type and outcome.

| Label | Values |
|---|---|
| `type` | `domain`, `ip`, `asn`, `nameserver`, `entity` |
| `status` | `success`, `error` |

```promql
# Queries per second (all types)
rate(rdapify_queries_total[5m])

# Error rate
rate(rdapify_queries_total{status="error"}[5m])
  / rate(rdapify_queries_total[5m])

# Domain query success rate
rate(rdapify_queries_total{type="domain",status="success"}[5m])
```

---

**`rdapify_query_duration_seconds`** — Histogram  
End-to-end query latency from request received to response sent.

Buckets: `0.001 0.005 0.01 0.05 0.1 0.5 1.0 5.0`

| Label | Values |
|---|---|
| `type` | `domain`, `ip`, `asn`, `nameserver`, `entity` |

```promql
# P50 latency
histogram_quantile(0.5, rate(rdapify_query_duration_seconds_bucket[5m]))

# P95 latency
histogram_quantile(0.95, rate(rdapify_query_duration_seconds_bucket[5m]))

# P99 latency
histogram_quantile(0.99, rate(rdapify_query_duration_seconds_bucket[5m]))
```

---

### Cache Metrics

**`rdapify_cache_hits_total`** — Counter  
Cache hits per query type.

**`rdapify_cache_misses_total`** — Counter  
Cache misses per query type.

**`rdapify_cache_size`** — Gauge  
Current number of entries in the cache.

```promql
# Cache hit rate (overall)
rate(rdapify_cache_hits_total[5m])
  / (rate(rdapify_cache_hits_total[5m]) + rate(rdapify_cache_misses_total[5m]))

# Cache utilization (fraction of max capacity)
rdapify_cache_size / <RDAPIFY_CACHE_SIZE>
```

---

### Error Metrics

**`rdapify_http_errors_total`** — Counter  
HTTP errors from upstream RDAP servers.

| Label | Values |
|---|---|
| `status_code` | `404`, `429`, `500`, `502`, `503`, etc. |

**`rdapify_security_blocks_total`** — Counter  
Security checks that blocked a request.

| Label | Values |
|---|---|
| `reason` | `ssrf`, `redirect_loop`, `content_type`, `size_limit`, `dns_rebinding` |

**`rdapify_rate_limit_hits_total`** — Counter  
Requests rejected by the rate limiter.

```promql
# Security block rate
rate(rdapify_security_blocks_total[5m])

# Top blocked reason
topk(3, sum by (reason) (rdapify_security_blocks_total))
```

---

### Infrastructure Metrics

**`rdapify_bootstrap_age_seconds`** — Gauge  
Age of each cached bootstrap file since last refresh.

| Label | Values |
|---|---|
| `type` | `dns`, `ipv4`, `ipv6`, `asn`, `object_tags` |

```promql
# Alert: bootstrap data older than 48 hours
rdapify_bootstrap_age_seconds > 172800
```

---

## Prometheus Scrape Config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: rdapify
    static_configs:
      - targets: ['rdapify:7080']
    # If METRICS_TOKEN is set:
    authorization:
      credentials: your-secret-token
    scrape_interval: 15s
    scrape_timeout: 10s
```

---

## Grafana Dashboard

Import the pre-built dashboard from [rdapify/grafana-dashboards](https://github.com/rdapify/grafana-dashboards) or build your own using the panels below.

### Recommended Panels

#### Row 1: Throughput

| Panel | Query |
|---|---|
| Queries/sec | `sum(rate(rdapify_queries_total[5m]))` |
| Error rate % | `100 * sum(rate(rdapify_queries_total{status="error"}[5m])) / sum(rate(rdapify_queries_total[5m]))` |
| Cache hit rate % | `100 * sum(rate(rdapify_cache_hits_total[5m])) / (sum(rate(rdapify_cache_hits_total[5m])) + sum(rate(rdapify_cache_misses_total[5m])))` |

#### Row 2: Latency

| Panel | Query |
|---|---|
| P50 latency (ms) | `1000 * histogram_quantile(0.5, sum(rate(rdapify_query_duration_seconds_bucket[5m])) by (le))` |
| P95 latency (ms) | `1000 * histogram_quantile(0.95, sum(rate(rdapify_query_duration_seconds_bucket[5m])) by (le))` |
| P99 latency (ms) | `1000 * histogram_quantile(0.99, sum(rate(rdapify_query_duration_seconds_bucket[5m])) by (le))` |
| Latency by type | `histogram_quantile(0.95, sum(rate(rdapify_query_duration_seconds_bucket[5m])) by (le, type))` |

#### Row 3: Cache

| Panel | Query |
|---|---|
| Cache size | `rdapify_cache_size` |
| Cache hit rate by type | `sum by (type) (rate(rdapify_cache_hits_total[5m])) / (sum by (type) (rate(rdapify_cache_hits_total[5m])) + sum by (type) (rate(rdapify_cache_misses_total[5m])))` |

#### Row 4: Health

| Panel | Query |
|---|---|
| Security blocks/min | `sum(rate(rdapify_security_blocks_total[1m])) * 60` |
| Rate limit hits/min | `rate(rdapify_rate_limit_hits_total[1m]) * 60` |
| Bootstrap age (hours) | `rdapify_bootstrap_age_seconds / 3600` |

---

## Alerting Rules

```yaml
# alerts/rdapify.yaml
groups:
  - name: rdapify
    rules:
      - alert: RDAPifyHighErrorRate
        expr: |
          rate(rdapify_queries_total{status="error"}[5m])
            / rate(rdapify_queries_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RDAPify error rate > 5%"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: RDAPifyHighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(rdapify_query_duration_seconds_bucket[5m])) by (le)
          ) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "RDAPify P99 latency > 1 second"

      - alert: RDAPifyBootstrapStale
        expr: rdapify_bootstrap_age_seconds > 172800
        for: 0m
        labels:
          severity: warning
        annotations:
          summary: "RDAPify bootstrap data is stale (> 48h)"
          description: "Bootstrap type={{ $labels.type }} age={{ $value | humanizeDuration }}"

      - alert: RDAPifyHighSecurityBlocks
        expr: rate(rdapify_security_blocks_total[5m]) > 10
        for: 2m
        labels:
          severity: info
        annotations:
          summary: "RDAPify blocking many requests (possible attack)"
```

---

## Benchmark Numbers (Reference)

These are code-path benchmarks with a mock HTTP server. Add your network latency for real estimates.

| Operation | Latency |
|---|---|
| Domain query (cache hit) | ~2.3 µs |
| Domain query (no cache) | ~183 µs |
| IP query (no cache) | ~176 µs |
| ASN query (no cache) | ~176 µs |
| Batch 100 domains (c=10) | ~2.1 s |
| SSRF URL validation | ~141 ns |

See [PERFORMANCE_SPEC.md](PERFORMANCE_SPEC.md) for the full specification and CI targets.
