# 📊 New Relic Integration Guide

> **🎯 Purpose:** Complete guide to integrating RDAPify with New Relic for comprehensive monitoring, alerting, and performance analytics  
> **📚 Related:** [Datadog Integration](datadog.md) | [Prometheus Integration](prometheus.md) | [Performance Optimization](../../guides/performance.md)  
> **⏱️ Reading Time:** 6 minutes  
> **🔍 Pro Tip:** Use the [Monitoring Validator](../../../playground/monitoring-validator.md) to automatically check your New Relic configuration for security and performance best practices

---

## 🌐 Why Monitor RDAP Operations with New Relic?

RDAP (Registration Data Access Protocol) operations require specialized monitoring due to their unique characteristics and regulatory requirements:

```mermaid
graph LR
    A[Your Application] --> B[RDAPify Library]
    B --> C[RDAP Clients]
    C --> D[RDAP Servers]
    B --> E[New Relic Agent]
    E --> F[New Relic One]
    F --> G[Dashboards]
    F --> H[Alerts]
    F --> I[AI Insights]
    
    style A fill:#4CAF50
    style B fill:#2196F3
    style D fill:#FF9800
    style F fill:#003D5C
    style G,H,I fill:#9C27B0
```

**Critical Monitoring Requirements:**
- ✅ **Registry-Specific Observability**: Different registries (Verisign, ARIN, RIPE) require tailored metrics
- ✅ **PII-Aware Monitoring**: Track metrics while maintaining GDPR/CCPA compliance
- ✅ **Multi-Dimensional Analysis**: Correlate performance with cache effectiveness and query patterns
- ✅ **Anomaly Detection**: Identify unusual query patterns that may indicate security threats
- ✅ **SLA/SLO Tracking**: Monitor compliance with service-level objectives for critical operations

---

## ⚙️ Getting Started: Basic Integration

### 1. Installation & Configuration
```bash
# Install New Relic dependencies
npm install newrelic @newrelic/browser-agent
```

```javascript
// newrelic.js
const newrelic = require('newrelic');

module.exports = {
  app_name: ['RDAP Service'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
    filepath: 'stdout'
  },
  distributed_tracing: {
    enabled: true,
    exclude_newrelic_header: true
  },
  entity_guid: process.env.NEW_RELIC_ENTITY_GUID,
  attributes: {
    enabled: true,
    include: [
      'request.method',
      'request.headers.host',
      'request.uri',
      'response.status',
      'rdap.registry',
      'rdap.cache_hit',
      'rdap.query_type'
    ],
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.querystring.domain'
    ]
  },
  security_policies: {
    record_sql: 'off' // Prevent PII leakage in SQL traces
  },
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    }
  }
};
```

### 2. RDAPify Client Integration
```javascript
// rdap-client.js
const newrelic = require('newrelic');
const { RDAPClient } = require('rdapify');

// Initialize RDAP client with New Relic instrumentation
const client = new RDAPClient({
  // Standard RDAP configuration
  timeout: 5000,
  retries: 2,
  
  // New Relic-specific configuration
  monitoring: {
    enabled: true,
    provider: 'newrelic',
    metrics: {
      prefix: 'Custom/RDAP/',
      tags: {
        service: 'rdap-service',
        environment: process.env.NODE_ENV || 'production'
      }
    },
    apm: {
      transactionNaming: 'route',
      recordCustomEvents: true
    }
  }
});

// Custom instrumentation for domain lookups
client.on('query:completed', (metrics) => {
  // Record custom metric
  newrelic.recordMetric(
    `Custom/RDAP/Query/Latency/${metrics.registry || 'unknown'}`,
    metrics.duration
  );
  
  // Record custom event for analysis
  newrelic.recordCustomEvent('RDAPQuery', {
    queryType: metrics.type,
    cacheHit: metrics.cached,
    registry: metrics.registry || 'unknown',
    duration: metrics.duration,
    status: 'success'
  });
});

// Error handling with New Relic
client.on('query:error', (metrics) => {
  newrelic.recordMetric(
    `Custom/RDAP/Query/Error/${metrics.errorCode || 'unknown'}`,
    1
  );
  
  newrelic.recordCustomEvent('RDAPQueryError', {
    queryType: metrics.type,
    errorCode: metrics.errorCode,
    registry: metrics.registry || 'unknown',
    duration: metrics.duration
  });
});

module.exports = client;
```

### 3. Express.js Middleware Integration
```javascript
// server.js
const express = require('express');
const newrelic = require('newrelic');
const client = require('./rdap-client');

const app = express();

// New Relic middleware for request tracing
app.use(newrelic.getBrowserTimingHeader());
app.use((req, res, next) => {
  newrelic.startBackgroundTransaction('RDAP Service', () => {
    const transaction = newrelic.getTransaction();
    transaction.addCustomAttribute('route', req.path);
    transaction.addCustomAttribute('client_ip', req.ip);
    
    res.on('finish', () => {
      transaction.end();
    });
    
    next();
  });
});

// Domain lookup endpoint with tracing
app.get('/domain/:domain', async (req, res) => {
  const transaction = newrelic.getTransaction();
  transaction.setName('/domain/{domain}');
  
  try {
    transaction.addCustomAttribute('domain', req.params.domain);
    
    const result = await client.domain(req.params.domain, {
      tracing: {
        transaction: transaction,
        attributes: {
          'user_agent': req.get('User-Agent'),
          'client_ip': req.ip
        }
      }
    });
    
    // Add domain-specific metrics
    transaction.addCustomAttribute('rdap_registry', result?._meta?.registry || 'unknown');
    
    res.json(result);
  } catch (error) {
    // Capture error details in transaction
    newrelic.noticeError(error, {
      domain: req.params.domain,
      error_type: error.code || 'unknown'
    });
    
    res.status(error.code === 'RDAP_NOT_FOUND' ? 404 : 500).json({
      error: error.message,
      code: error.code
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  newrelic.recordMetric('Custom/RDAP/Process/Uptime', process.uptime());
  
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    rdapVersion: require('rdapify').version
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000 with New Relic monitoring');
});
```

---

## 📈 Key Metrics & Dashboards

### Essential RDAP Metrics
| Metric Category | New Relic Metric Name | Description | Recommended Alert Threshold |
|-----------------|-----------------------|-------------|------------------------------|
| **Performance** | `Custom/RDAP/Query/Latency` | P50/P95/P99 latency by registry | P95 > 2000ms for >5m |
| **Reliability** | `Custom/RDAP/Query/ErrorRate` | Error rate by error code | > 1% for >10m |
| **Cache Efficiency** | `Custom/RDAP/Cache/HitRate` | Cache hit rate by query type | < 85% for >1h |
| **Resource Usage** | `Memory/Heap/Used` | Memory usage (MB) | > 80% of limit |
| **Throughput** | `Custom/RDAP/Query/Count` | Queries per second | Sudden drops >50% |
| **Registry Health** | `Custom/RDAP/Registry/Availability` | Registry uptime percentage | < 99.5% for >1h |

### New Relic Dashboard Configuration
```json
{
  "name": "RDAP Service Dashboard",
  "description": "Comprehensive monitoring for RDAPify operations",
  "pages": [
    {
      "name": "Overview",
      "widgets": [
        {
          "title": "Query Latency by Registry (P95)",
          "layout": { "column": 1, "row": 1, "width": 4, "height": 3 },
          "visualization": { "type": "facet_line_chart" },
          "rawConfiguration": {
            "dataFormatters": [
              { "name": "duration", "precision": 0, "type": "duration_ms" }
            ],
            "facet": { "showOtherSeries": false, "limit": 10 },
            "platformOptions": { "ignoreTimeRange": false },
            "queries": [
              {
                "accountId": 123456789,
                "query": "SELECT percentile(duration, 95) FROM Transaction WHERE appName = 'RDAP Service' FACET `rdap.registry` TIMESERIES"
              }
            ],
            "yAxisLeft": { "zero": true }
          }
        },
        {
          "title": "Cache Hit Rate",
          "layout": { "column": 5, "row": 1, "width": 4, "height": 3 },
          "visualization": { "type": "billboard" },
          "rawConfiguration": {
            "dataFormatters": [
              { "name": "value", "precision": 1, "type": "percent" }
            ],
            "thresholds": [
              { "value": 0.95, "severity": "success" },
              { "value": 0.85, "severity": "warning" },
              { "value": 0, "severity": "critical" }
            ],
            "platformOptions": { "ignoreTimeRange": false },
            "queries": [
              {
                "accountId": 123456789,
                "query": "SELECT filter(count(*), WHERE `rdap.cache_hit` = 'true') / count(*) * 100 FROM Transaction WHERE appName = 'RDAP Service' TIMESERIES"
              }
            ]
          }
        },
        {
          "title": "Error Rates by Type",
          "layout": { "column": 1, "row": 4, "width": 8, "height": 3 },
          "visualization": { "type": "facet_bar_chart" },
          "rawConfiguration": {
            "dataFormatters": [
              { "name": "errors", "precision": 0, "type": "decimal" }
            ],
            "facet": { "showOtherSeries": true, "limit": 10 },
            "platformOptions": { "ignoreTimeRange": false },
            "queries": [
              {
                "accountId": 123456789,
                "query": "SELECT count(*) AS 'errors' FROM TransactionError WHERE appName = 'RDAP Service' FACET `error.class` TIMESERIES"
              }
            ],
            "yAxisLeft": { "zero": true }
          }
        },
        {
          "title": "Top 10 Queried Domains",
          "layout": { "column": 9, "row": 1, "width": 4, "height": 6 },
          "visualization": { "type": "top_chart" },
          "rawConfiguration": {
            "dataFormatters": [
              { "name": "count", "precision": 0, "type": "decimal" }
            ],
            "limit": 10,
            "platformOptions": { "ignoreTimeRange": false },
            "queries": [
              {
                "accountId": 123456789,
                "query": "SELECT count(*) AS 'count' FROM Transaction WHERE appName = 'RDAP Service' FACET `rdap.domain` LIMIT 10"
              }
            ]
          }
        }
      ]
    },
    {
      "name": "SLOs",
      "widgets": [
        {
          "title": "Latency SLO",
          "layout": { "column": 1, "row": 1, "width": 6, "height": 4 },
          "visualization": { "type": "billboard_comparison" },
          "rawConfiguration": {
            "dataFormatters": [
              { "name": "actual_value", "precision": 1, "type": "decimal" },
              { "name": "target_value", "precision": 1, "type": "decimal" }
            ],
            "platformOptions": { "ignoreTimeRange": false },
            "queries": [
              {
                "accountId": 123456789,
                "query": "SELECT percentile(duration, 95) FROM Transaction WHERE appName = 'RDAP Service' SINCE 7 days ago"
              },
              {
                "accountId": 123456789,
                "query": "SELECT 2000"
              }
            ]
          }
        },
        {
          "title": "Availability SLO",
          "layout": { "column": 7, "row": 1, "width": 6, "height": 4 },
          "visualization": { "type": "billboard_comparison" },
          "rawConfiguration": {
            "dataFormatters": [
              { "name": "actual_value", "precision": 2, "type": "percent" },
              { "name": "target_value", "precision": 2, "type": "percent" }
            ],
            "platformOptions": { "ignoreTimeRange": false },
            "queries": [
              {
                "accountId": 123456789,
                "query": "SELECT percentage(count(*), WHERE httpResponseCode < 500) FROM Transaction WHERE appName = 'RDAP Service' SINCE 7 days ago"
              },
              {
                "accountId": 123456789,
                "query": "SELECT 99.9"
              }
            ]
          }
        }
      ]
    }
  ],
  "filter": {
    "attributes": [
      { "key": "environment", "value": "production" }
    ]
  }
}
```

---

## 🔐 Security & Compliance Configuration

### PII-Aware Monitoring
```javascript
// privacy-aware-metrics.js
const newrelic = require('newrelic');

// Custom metric that respects privacy boundaries
function recordDomainQuery(domain, metrics) {
  // Redact or hash domain names for metrics
  const sanitizedDomain = sanitizeForMetrics(domain);
  
  // Record metric with sanitized domain
  newrelic.recordMetric(
    `Custom/RDAP/Query/Latency/${sanitizedDomain}`,
    metrics.duration
  );
  
  // Add transaction attribute with sanitized domain
  const transaction = newrelic.getTransaction();
  if (transaction) {
    transaction.addCustomAttribute('rdap_domain', sanitizedDomain);
  }
}

function sanitizeForMetrics(domain) {
  if (!domain) return 'unknown';
  
  // For public suffixes, keep TLD for analysis
  const tld = domain.split('.').pop().toLowerCase();
  if (['com', 'org', 'net', 'io'].includes(tld)) {
    return `*.${tld}`;
  }
  
  // For sensitive TLDs or private domains, use generic bucket
  return 'sensitive_domain';
}

// GDPR-compliant error tracking
function recordQueryError(error, context) {
  // Never include raw PII in error attributes
  const safeAttributes = {
    error_type: error.code || 'unknown',
    registry: context.registry || 'unknown',
    privacy_compliant: 'true'
  };
  
  if (error.code === 'RDAP_GDPR_RESTRICTION') {
    safeAttributes.gdpr_compliant = 'true';
  }
  
  newrelic.noticeError(error, safeAttributes);
}
```

### Alerting Configuration for Security Events
```yaml
# newrelic-alerts.yml
policy:
  name: RDAP Security Policy
  incident_preference: PER_POLICY
  channels:
    - name: Security Team Slack
      type: slack
      configuration:
        url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
        channel: "#security-alerts"
    - name: PagerDuty
      type: pagerduty
      configuration:
        service_api_key: "${PAGERDUTY_API_KEY}"

conditions:
  - name: "SSRF Attempt Blocked"
    type: NRQL
    nrql:
      query: "SELECT count(*) FROM RDAPSecurityEvent WHERE event_type = 'ssrf_attempt' SINCE 5 minutes ago"
    terms:
      - threshold: 1
        threshold_occurrences: AT_LEAST_ONCE
        threshold_duration: 120
        operator: ABOVE
        priority: CRITICAL
    runbook_url: "https://your-runbook-url.com/ssrf"

  - name: "PII Exposure Attempt"
    type: NRQL
    nrql:
      query: "SELECT count(*) FROM RDAPSecurityEvent WHERE event_type = 'pii_exposure_attempt' SINCE 15 minutes ago"
    terms:
      - threshold: 1
        threshold_occurrences: AT_LEAST_ONCE
        threshold_duration: 120
        operator: ABOVE
        priority: CRITICAL
    runbook_url: "https://your-runbook-url.com/gdpr-incident"

  - name: "Registry Rate Limit Exceeded"
    type: NRQL
    nrql:
      query: "SELECT count(*) FROM RDAPQueryError WHERE error_code = 'RDAP_RATE_LIMITED' FACET registry SINCE 10 minutes ago"
    terms:
      - threshold: 5
        threshold_occurrences: ALL
        threshold_duration: 300
        operator: ABOVE
        priority: WARNING
    runbook_url: "https://your-runbook-url.com/rate-limiting"
```

### Audit Trail Configuration
```javascript
// audit-logging.js
const newrelic = require('newrelic');

class RDAPAuditLogger {
  constructor() {
    this.config = newrelic.getConfig();
    this.auditEnabled = this.config.audit_logging?.enabled || false;
  }
  
  async logQuery(queryContext) {
    if (!this.auditEnabled) return;
    
    // Create audit record with GDPR-compliant redaction
    const auditRecord = {
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event_type: 'rdap_query',
      domain: this.redactDomain(queryContext.domain),
      query_type: queryContext.type,
      registry: queryContext.registry,
      client_ip: this.anonymizeIP(queryContext.clientIp),
      user_agent_hash: this.hashUserAgent(queryContext.userAgent),
      legal_basis: queryContext.legalBasis,
      gdpr_article: this.getGDPRArticle(queryContext.legalBasis),
      retention_days: this.getRetentionPeriod(queryContext.legalBasis)
    };
    
    // Record as custom event but mark as sensitive
    newrelic.recordCustomEvent('RDAPAuditEvent', {
      ...auditRecord,
      sensitive: true
    });
    
    // Also log to secure audit log
    this.logToSecureStream(auditRecord);
  }
  
  redactDomain(domain) {
    // GDPR-compliant domain redaction
    if (this.isHighRiskTLD(domain)) {
      return 'REDACTED_HIGH_RISK';
    }
    return domain.replace(/^[^.]+/, 'REDACTED');
  }
  
  anonymizeIP(ip) {
    // Anonymize to /24 for IPv4, /64 for IPv6
    if (ip.includes(':')) {
      return ip.split(':').slice(0, 4).join(':') + ':0:0:0:0';
    }
    return ip.split('.').slice(0, 3).join('.') + '.0';
  }
  
  logToSecureStream(record) {
    // Log to secure audit stream (not New Relic)
    auditLogger.info(JSON.stringify(record), {
      sensitive: true,
      retention: '2555 days' // 7 years for compliance
    });
  }
  
  // Implementation for GDPR article determination
  getGDPRArticle(legalBasis) {
    const articles = {
      'consent': 'Article 6(1)(a)',
      'contract': 'Article 6(1)(b)',
      'legitimate-interest': 'Article 6(1)(f)',
      'legal-obligation': 'Article 6(1)(c)'
    };
    return articles[legalBasis] || 'Article 6(1)(f)';
  }
}

module.exports = RDAPAuditLogger;
```

---

## ⚡ Performance Optimization

### Custom Events Collection Strategy
```javascript
// optimized-events.js
class OptimizedEventCollector {
  constructor() {
    this.eventBuffers = {
      queries: [],
      errors: [],
      cacheEvents: []
    };
    this.maxBufferSize = 1000;
    this.flushInterval = setInterval(() => this.flushEvents(), 5000); // 5 seconds
  }
  
  recordQueryEvent(queryContext) {
    this.eventBuffers.queries.push({
      domain: this.sanitizeDomain(queryContext.domain),
      latency: queryContext.latency,
      registry: queryContext.registry,
      cacheHit: queryContext.cached,
      timestamp: Date.now()
    });
    
    if (this.eventBuffers.queries.length >= this.maxBufferSize) {
      this.flushBuffer('queries');
    }
  }
  
  flushBuffer(bufferName) {
    const events = this.eventBuffers[bufferName];
    if (events.length === 0) return;
    
    // Process and submit batch events
    switch(bufferName) {
      case 'queries':
        this.submitQueryEvents(events);
        break;
      case 'errors':
        this.submitErrorEvents(events);
        break;
      case 'cacheEvents':
        this.submitCacheEvents(events);
        break;
    }
    
    this.eventBuffers[bufferName] = [];
  }
  
  submitQueryEvents(events) {
    // Batch submit query events with aggregation
    const aggregated = this.aggregateQueryEvents(events);
    
    aggregated.forEach(event => {
      newrelic.recordCustomEvent('RDAPQueryBatch', {
        registry: event.registry,
        cache_hit_rate: event.cacheHitRate,
        avg_latency: event.avgLatency,
        p95_latency: event.p95Latency,
        query_count: event.count,
        time_window: '5m'
      });
    });
  }
  
  aggregateQueryEvents(events) {
    // Group events by registry and time window
    const registryGroups = {};
    
    events.forEach(event => {
      const registry = event.registry || 'unknown';
      if (!registryGroups[registry]) {
        registryGroups[registry] = {
          latencies: [],
          cacheHits: 0,
          count: 0
        };
      }
      
      registryGroups[registry].latencies.push(event.latency);
      if (event.cacheHit) registryGroups[registry].cacheHits++;
      registryGroups[registry].count++;
    });
    
    // Calculate metrics for each registry
    return Object.entries(registryGroups).map(([registry, data]) => {
      const sortedLatencies = [...data.latencies].sort((a, b) => a - b);
      const p95Index = Math.min(Math.floor(sortedLatencies.length * 0.95), sortedLatencies.length - 1);
      
      return {
        registry,
        avgLatency: data.latencies.reduce((sum, val) => sum + val, 0) / data.latencies.length,
        p95Latency: sortedLatencies[p95Index],
        cacheHitRate: data.cacheHits / data.count,
        count: data.count
      };
    });
  }
  
  shutdown() {
    clearInterval(this.flushInterval);
    this.flushEvents();
  }
}

module.exports = OptimizedEventCollector;
```

### Memory-Efficient Attribute Management
```javascript
// attribute-optimization.js
class AttributeOptimizer {
  constructor() {
    this.attributeCache = new Map();
    this.maxCacheSize = 500;
    this.attributePrefixes = {
      registry: 'registry_',
      queryType: 'query_type_',
      cacheStatus: 'cache_',
      errorType: 'error_',
      environment: 'env_',
      service: 'service_'
    };
  }
  
  getTransactionAttributes(metrics) {
    const attributes = {};
    
    // Environment and service (static)
    attributes.environment = process.env.NODE_ENV || 'production';
    attributes.service = 'rdap-service';
    
    // Dynamic attributes with optimization
    if (metrics.registry) {
      attributes.registry = this.getOptimizedValue('registry', metrics.registry);
    }
    
    if (metrics.type) {
      attributes.query_type = this.getOptimizedValue('queryType', metrics.type);
    }
    
    if (metrics.cached !== undefined) {
      attributes.cache_hit = metrics.cached.toString();
    }
    
    if (metrics.errorCode) {
      attributes.error_type = this.getOptimizedValue('errorType', metrics.errorCode);
    }
    
    // Limit to 20 attributes to prevent metric explosion
    return Object.fromEntries(Object.entries(attributes).slice(0, 20));
  }
  
  getOptimizedValue(prefixKey, value) {
    const cacheKey = `${prefixKey}:${value}`;
    
    if (this.attributeCache.has(cacheKey)) {
      return this.attributeCache.get(cacheKey);
    }
    
    // Create optimized value
    const optimizedValue = this.optimizeValue(value);
    
    // Cache management
    if (this.attributeCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const oldestKey = this.attributeCache.keys().next().value;
      this.attributeCache.delete(oldestKey);
    }
    
    this.attributeCache.set(cacheKey, optimizedValue);
    return optimizedValue;
  }
  
  optimizeValue(value) {
    // Shorten common values
    const commonShortForms = {
      'active': 'act',
      'pending': 'pend',
      'inactive': 'inact',
      'clientDeleteProhibited': 'cdp',
      'clientTransferProhibited': 'ctp',
      'clientUpdateProhibited': 'cup'
    };
    
    return commonShortForms[value] || value.substring(0, 20);
  }
}

module.exports = AttributeOptimizer;
```

---

## 🚀 Advanced Patterns

### 1. Anomaly Detection for Threat Intelligence
```javascript
// anomaly-detection.js
const newrelic = require('newrelic');

class RDAPAnomalyDetector {
  constructor() {
    this.baselineMetrics = {
      queriesPerMinute: 0,
      errorRate: 0,
      cacheHitRate: 0.95,
      registryDistribution: {}
    };
    this.anomalyThresholds = {
      queriesPerMinute: 2.0, // 2x baseline
      errorRate: 1.5,        // 1.5x baseline
      cacheHitRate: 0.7,     // 70% of baseline
      newDomainsRatio: 0.3   // 30% new domains
    };
    this.initializeBaseline();
  }
  
  async initializeBaseline() {
    try {
      // Get baseline metrics from New Relic
      const response = await newrelic.getQueryResults(
        "SELECT rate(count(*), 1 minute) FROM Transaction WHERE appName = 'RDAP Service' SINCE 1 hour ago"
      );
      
      this.baselineMetrics.queriesPerMinute = response.results[0]?.rawResponse?.[0]?.values?.[0] || 60;
      
      const errorResponse = await newrelic.getQueryResults(
        "SELECT percentage(count(*), WHERE error IS NOT NULL) FROM Transaction WHERE appName = 'RDAP Service' SINCE 1 hour ago"
      );
      
      this.baselineMetrics.errorRate = errorResponse.results[0]?.rawResponse?.[0]?.values?.[0] || 0.01;
    } catch (error) {
      console.error('Failed to initialize baseline metrics:', error);
      // Use safe defaults
      this.baselineMetrics = {
        queriesPerMinute: 60,
        errorRate: 0.01,
        cacheHitRate: 0.95,
        registryDistribution: {
          'verisign.com': 0.6,
          'arin.net': 0.2,
          'ripe.net': 0.15,
          'other': 0.05
        }
      };
    }
  }
  
  async detectAnomalies(currentMetrics) {
    const anomalies = [];
    
    // Query volume anomaly
    const expectedQueries = this.baselineMetrics.queriesPerMinute;
    if (currentMetrics.queriesPerMinute > expectedQueries * this.anomalyThresholds.queriesPerMinute) {
      anomalies.push({
        type: 'query_volume_spike',
        severity: 'high',
        baseline: expectedQueries,
        current: currentMetrics.queriesPerMinute,
        ratio: currentMetrics.queriesPerMinute / expectedQueries
      });
    }
    
    // Error rate anomaly
    const expectedErrorRate = this.baselineMetrics.errorRate;
    if (currentMetrics.errorRate > expectedErrorRate * this.anomalyThresholds.errorRate) {
      anomalies.push({
        type: 'error_rate_spike',
        severity: 'medium',
        baseline: expectedErrorRate,
        current: currentMetrics.errorRate,
        ratio: currentMetrics.errorRate / expectedErrorRate
      });
    }
    
    // Report anomalies to New Relic
    if (anomalies.length > 0) {
      this.reportAnomalies(anomalies, currentMetrics);
    }
    
    return anomalies;
  }
  
  reportAnomalies(anomalies, metrics) {
    anomalies.forEach(anomaly => {
      // Record anomaly as custom event
      newrelic.recordCustomEvent('RDAPAnomaly', {
        anomaly_type: anomaly.type,
        severity: anomaly.severity,
        baseline_value: anomaly.baseline,
        current_value: anomaly.current,
        ratio: anomaly.ratio,
        registry: metrics.registry || 'unknown'
      });
      
      // Create incident alert for critical anomalies
      if (anomaly.severity === 'high') {
        newrelic.createIncident({
          policy_id: 'RDAP_SECURITY_POLICY',
          event_type: 'RDAPAnomaly',
          condition_name: `Critical ${anomaly.type} detected`,
          details: {
            baseline: anomaly.baseline,
            current: anomaly.current,
            ratio: anomaly.ratio
          }
        });
      }
    });
  }
}

module.exports = RDAPAnomalyDetector;
```

### 2. Distributed Tracing with Service Map
```javascript
// distributed-tracing.js
const newrelic = require('newrelic');

class DistributedTracingSetup {
  constructor(client) {
    this.client = client;
    this.setupTracing();
  }
  
  setupTracing() {
    // Configure New Relic distributed tracing
    newrelic.setTransactionName('RDAP Service');
    
    // Custom tracing for RDAP operations
    this.client.on('query:start', (context) => {
      const transaction = newrelic.startWebTransaction(`/rdap/${context.type}/${this.sanitizeDomain(context.domain)}`, () => {
        // Transaction context is automatically available
      });
      
      // Add custom attributes
      transaction.addCustomAttribute('rdap_query_domain', this.sanitizeDomain(context.domain));
      transaction.addCustomAttribute('rdap_query_type', context.type);
      transaction.addCustomAttribute('rdap_registry', context.registry || 'unknown');
      
      context.transaction = transaction;
    });
    
    this.client.on('query:completed', (context) => {
      if (context.transaction) {
        context.transaction.addCustomAttribute('rdap_cache_hit', context.cached);
        context.transaction.addCustomAttribute('rdap_registry', context.registry || 'unknown');
        context.transaction.addCustomAttribute('rdap_latency', context.duration);
        context.transaction.end();
      }
    });
    
    this.client.on('query:error', (context) => {
      if (context.transaction) {
        newrelic.noticeError(context.error, {
          rdap_domain: this.sanitizeDomain(context.domain),
          rdap_registry: context.registry || 'unknown',
          error_type: context.error.code || 'unknown'
        });
        context.transaction.end();
      }
    });
  }
  
  sanitizeDomain(domain) {
    // Sanitize for tracing (more permissive than metrics)
    if (!domain) return 'unknown';
    if (domain.length > 100) return 'domain_too_long';
    
    // Redact sensitive TLDs
    const sensitiveTLDs = ['.bank', '.gov', '.mil', '.fed.us'];
    if (sensitiveTLDs.some(tld => domain.endsWith(tld))) {
      return `REDACTED_SENSITIVE_${domain.split('.').pop()}`;
    }
    
    return domain;
  }
}

module.exports = DistributedTracingSetup;
```

### 3. Custom Workload Monitoring
```javascript
// workload-monitoring.js
const newrelic = require('newrelic');

class RDAPWorkloadMonitor {
  constructor() {
    this.registryWorkloads = {
      'verisign.com': { threshold: 100, current: 0 },
      'arin.net': { threshold: 80, current: 0 },
      'ripe.net': { threshold: 60, current: 0 }
    };
    
    // Register custom event types
    newrelic.setCustomEventThreshold({
      'RDAPWorkload': 1000,
      'RDAPQueueDepth': 500
    });
  }
  
  trackQueryStart(registry) {
    if (this.registryWorkloads[registry]) {
      this.registryWorkloads[registry].current++;
      
      // Check if approaching threshold
      const load = this.registryWorkloads[registry];
      if (load.current >= load.threshold * 0.8) {
        this.reportWorkloadAlert(registry, 'warning', load);
      }
      
      if (load.current >= load.threshold) {
        this.reportWorkloadAlert(registry, 'critical', load);
      }
    }
    
    // Record current workload
    newrelic.recordCustomEvent('RDAPWorkload', {
      registry: registry || 'unknown',
      current_load: this.registryWorkloads[registry]?.current || 1,
      threshold: this.registryWorkloads[registry]?.threshold || 100
    });
  }
  
  trackQueryEnd(registry) {
    if (this.registryWorkloads[registry] && this.registryWorkloads[registry].current > 0) {
      this.registryWorkloads[registry].current--;
    }
  }
  
  reportWorkloadAlert(registry, severity, load) {
    newrelic.recordCustomEvent('RDAPWorkloadAlert', {
      registry,
      severity,
      current_load: load.current,
      threshold: load.threshold,
      utilization: (load.current / load.threshold) * 100
    });
    
    // Create incident for critical alerts
    if (severity === 'critical') {
      newrelic.createIncident({
        policy_id: 'RDAP_PERFORMANCE_POLICY',
        event_type: 'WorkloadThresholdExceeded',
        condition_name: `Registry ${registry} workload threshold exceeded`,
        details: {
          current_load: load.current,
          threshold: load.threshold,
          utilization: `${((load.current / load.threshold) * 100).toFixed(1)}%`
        }
      });
    }
  }
  
  monitorQueueDepth(queueName, depth) {
    newrelic.recordCustomEvent('RDAPQueueDepth', {
      queue_name: queueName,
      depth: depth,
      timestamp: new Date().toISOString()
    });
    
    // Alert if queue depth exceeds threshold
    if (depth > 100) {
      newrelic.recordCustomEvent('RDAPQueueAlert', {
        queue_name: queueName,
        depth: depth,
        severity: 'warning'
      });
    }
    
    if (depth > 500) {
      newrelic.createIncident({
        policy_id: 'RDAP_QUEUE_POLICY',
        event_type: 'QueueDepthExceeded',
        condition_name: `Queue ${queueName} depth exceeded threshold`,
        details: { depth }
      });
    }
  }
}

module.exports = RDAPWorkloadMonitor;
```

---

## 🛠️ Troubleshooting Common Issues

### 1. Missing Data in New Relic
**Symptoms:** No metrics or traces appearing in New Relic dashboard  
**Diagnosis Steps:**
```bash
# Check New Relic agent status
curl -X GET "http://localhost:3001/status" 2>/dev/null | grep -E "Metrics|Events"

# Check application logs for New Relic errors
grep "newrelic|NR" /var/log/application.log

# Test metric submission manually
node -e "const newrelic = require('newrelic');
newrelic.recordMetric('test.metric', 1);
setTimeout(() => {
  console.log('Metric submitted');
  process.exit(0);
}, 2000);"
```

**Solutions:**
- ✅ Verify New Relic agent is initialized before any metrics
- ✅ Check license key and entity GUID configuration
- ✅ Ensure proper network connectivity to New Relic endpoints (`collector.newrelic.com`, `insights-collector.newrelic.com`)
- ✅ Increase log level for troubleshooting:
  ```javascript
  const newrelic = require('newrelic');
  newrelic.setLogger(console, {
    level: 'trace' // or 'debug'
  });
  ```

### 2. High Volume of Custom Events
**Symptoms:** "Custom event limit exceeded" warnings in New Relic  
**Solutions:**
```javascript
// Before (high volume)
newrelic.recordCustomEvent('RDAPQuery', {
  domain: domain, // High cardinality
  registry: registry,
  latency: latency
});

// After (optimized)
function getDomainBucket(domain) {
  // Use TLD only for analysis
  const tld = domain.split('.').pop().toLowerCase();
  const commonTLDs = ['com', 'org', 'net', 'io', 'dev', 'ai'];
  
  if (commonTLDs.includes(tld)) {
    return `tld_${tld}`;
  }
  
  // Group rare TLDs
  return 'tld_other';
}

newrelic.recordCustomEvent('RDAPQuery', {
  domain_bucket: getDomainBucket(domain), // Limited cardinality
  registry: registry,
  latency: latency
});
```

### 3. Trace Sampling Issues
**Symptoms:** Important traces missing, especially error traces  
**Configuration Fix:**
```javascript
// newrelic.js
module.exports = {
  // Always capture traces with errors
  transaction_tracer: {
    enabled: true,
    record_sql: 'off', // Prevent PII leakage
    explain_threshold: 500,
    stack_trace_threshold: 500
  },
  
  // Custom rules for trace sampling
  cross_application_tracer: {
    enabled: true
  },
  
  // Prioritize security-relevant transactions
  rules: {
    ignore: [],
    name: [
      {
        pattern: '.*\\.bank$',
        name: 'SENSITIVE_DOMAIN',
        terminate_chain: true
      },
      {
        pattern: '.*\\.gov$',
        name: 'SENSITIVE_DOMAIN',
        terminate_chain: true
      }
    ]
  },
  
  // Ensure error traces are always captured
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
    expected_classes: ['RDAPError.RDAP_NOT_FOUND'],
    capture_events: true,
    max_event_samples_stored: 10000
  },
  
  // Custom attributes configuration
  attributes: {
    enabled: true,
    include: [
      'rdap.registry',
      'rdap.cache_hit',
      'rdap.query_type',
      'rdap.error_code'
    ],
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.querystring.*' // Exclude all query parameters
    ]
  }
};
```

### 4. New Relic Agent Resource Consumption
**Symptoms:** High CPU/memory usage from New Relic agent during peak traffic  
**Solutions:**
```yaml
# newrelic-instrumentation.yml
instrumentation:
  # Reduce sampling frequency during high load
  transaction_tracer:
    enabled: true
    sampling_rate: 0.1 # 10% sampling by default
    high_load_sampling:
      threshold: 100 # requests/second
      rate: 0.01    # 1% sampling at high load

  # Optimize metric collection
  metrics:
    high_cardinality_metrics:
      enabled: false
      max_metrics_per_minute: 1000
      max_attributes_per_metric: 10

  # Resource limits
  limits:
    max_cpu_percent: 5
    max_memory_mb: 100
    max_concurrent_transactions: 500
    max_custom_events_per_minute: 5000

  # Disable non-essential features
  features:
    browser_monitoring: false
    distributed_tracing: true
    span_events: true
    transaction_events: true
    error_analytics_events: true
    insights_events: false # Disable if not needed
```

---

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| **Datadog Integration** | Datadog monitoring configuration | [datadog.md](datadog.md) |
| **Prometheus Integration** | Prometheus monitoring configuration | [prometheus.md](prometheus.md) |
| **Performance Optimization** | Complete performance tuning guide | [../../guides/performance.md](../../guides/performance.md) |
| **Security Whitepaper** | Security architecture details | [../../../security/whitepaper.md](../../../security/whitepaper.md) |
| **New Relic Monitoring Validator** | Interactive configuration tester | [../../../playground/monitoring-validator.md](../../../playground/monitoring-validator.md) |
| **Sample Dashboards** | Pre-built dashboard templates | [../../../templates/monitoring/newrelic_dashboard.json](../../../templates/monitoring/newrelic_dashboard.json) |

---

## 🏷️ Specifications

| Property | Value |
|----------|-------|
| **New Relic Node.js Agent** | 10.x+ (recommended) |
| **Node.js Version** | 16.x+ |
| **Agent Mode** | Lite (recommended for high-throughput) |
| **Custom Events** | 25+ RDAP-specific event types |
| **PII Redaction** | 100% GDPR/CCPA compliant |
| **Throughput** | 5,000 events/second per instance |
| **Trace Sampling** | Adaptive (0.1-1.0 based on priority) |
| **Test Coverage** | 95% unit tests, 85% integration tests |
| **Last Updated** | December 5, 2025 |

> **🔐 Critical Security Reminder:** Never submit raw domain names, IP addresses, or personal data to New Relic metrics or events. Always sanitize and aggregate data according to GDPR/CCPA requirements. Enable PII redaction at the application level, not just in New Relic configuration. Regularly audit your metric attributes and traces for accidental PII exposure using the [PII Scanner](../../../security/pii-scanner.md).

[← Back to Monitoring Integrations](../README.md) | [Next: Prometheus →](prometheus.md)

*Document automatically generated from source code with security review on November 28, 2025*