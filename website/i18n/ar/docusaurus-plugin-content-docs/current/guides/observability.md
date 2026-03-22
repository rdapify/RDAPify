# دليل الرصد والمراقبة

> **الغرض:** دليل شامل لمراقبة وتسجيل وتتبع تطبيقات RDAPify
> **مراجع ذات صلة:** [النشر](deployment.md) | [الأداء](performance.md) | [استكشاف الأخطاء](../troubleshooting/debugging.md)

---

## نظرة عامة على الرصد والمراقبة

الرصد هو القدرة على فهم الحالة الداخلية لنظامك من خلال فحص مخرجاته. في RDAPify، يشمل ذلك:

```mermaid
graph LR
    A[RDAPify Application] --> B[Logs]
    A --> C[Metrics]
    A --> D[Traces]
    A --> E[Health Checks]

    B --> F[Log Aggregation]
    C --> G[Metrics Dashboard]
    D --> H[Distributed Tracing]
    E --> I[Alerting]

    style A fill:#2196F3
    style B,C,D,E fill:#4CAF50
    style F,G,H,I fill:#FF9800
```

---

## التسجيل

### التسجيل المنظم

```javascript
import { RDAPClient } from 'rdapify';
import winston from 'winston';

// ضبط مسجّل منظم
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rdapify-app' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// تهيئة العميل مع التسجيل
const client = new RDAPClient({
  logger: {
    enabled: true,
    level: 'info',
    customLogger: logger
  }
});

// تسجيل استعلامات RDAP
client.on('query', (event) => {
  logger.info('RDAP query initiated', {
    type: event.type,
    query: event.query,
    timestamp: event.timestamp
  });
});

client.on('response', (event) => {
  logger.info('RDAP response received', {
    type: event.type,
    query: event.query,
    duration: event.duration,
    cached: event.cached,
    statusCode: event.statusCode
  });
});

client.on('error', (event) => {
  logger.error('RDAP query failed', {
    type: event.type,
    query: event.query,
    error: event.error.message,
    stack: event.error.stack
  });
});
```

### مستويات التسجيل

| المستوى | الاستخدام | مثال |
|-------|-------|---------|
| **error** | أخطاء النظام والأعطال | استعلامات RDAP الفاشلة، أخطاء الاتصال |
| **warn** | تحذيرات، تدهور الأداء | تحديد المعدل، إخفاقات الذاكرة المؤقتة |
| **info** | معلومات عامة | الاستعلامات الناجحة، إصابات الذاكرة المؤقتة |
| **debug** | تصحيح تفصيلي | تفاصيل الطلب/الاستجابة |
| **trace** | تتبع دقيق جداً | تغييرات الحالة الداخلية |

---

## المقاييس

### تكامل Prometheus

```javascript
import { RDAPClient } from 'rdapify';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// تعريف المقاييس
const rdapQueriesTotal = new Counter({
  name: 'rdap_queries_total',
  help: 'Total number of RDAP queries',
  labelNames: ['type', 'status']
});

const rdapQueryDuration = new Histogram({
  name: 'rdap_query_duration_seconds',
  help: 'RDAP query duration in seconds',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const rdapCacheHitRate = new Gauge({
  name: 'rdap_cache_hit_rate',
  help: 'RDAP cache hit rate'
});

const rdapActiveConnections = new Gauge({
  name: 'rdap_active_connections',
  help: 'Number of active RDAP connections'
});

// تهيئة العميل مع المقاييس
const client = new RDAPClient({
  metrics: {
    enabled: true,
    provider: 'prometheus'
  }
});

// تتبع المقاييس
client.on('query', (event) => {
  rdapActiveConnections.inc();
  rdapQueriesTotal.inc({ type: event.type, status: 'started' });
});

client.on('response', (event) => {
  rdapActiveConnections.dec();
  rdapQueriesTotal.inc({ type: event.type, status: 'success' });
  rdapQueryDuration.observe({ type: event.type }, event.duration / 1000);

  if (event.cached) {
    rdapCacheHitRate.set(event.cacheHitRate);
  }
});

client.on('error', (event) => {
  rdapActiveConnections.dec();
  rdapQueriesTotal.inc({ type: event.type, status: 'error' });
});

// كشف نقطة نهاية المقاييس
import express from 'express';
const app = express();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(9090);
```

### المقاييس الرئيسية للمراقبة

| المقياس | النوع | الوصف | عتبة التنبيه |
|--------|------|-------------|-----------------|
| **rdap_queries_total** | عداد | إجمالي الاستعلامات | — |
| **rdap_query_duration** | مدرج تكراري | زمن استجابة الاستعلام | p95 أكثر من 2s |
| **rdap_cache_hit_rate** | مقياس | فعالية الذاكرة المؤقتة | أقل من 70% |
| **rdap_error_rate** | عداد | تكرار الأخطاء | أكثر من 5% |
| **rdap_active_connections** | مقياس | الطلبات المتزامنة | أكثر من 100 |
| **rdap_rate_limit_hits** | عداد | انتهاكات تحديد المعدل | أكثر من 10/دقيقة |

---

## التتبع الموزع

### تكامل OpenTelemetry

```javascript
import { RDAPClient } from 'rdapify';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// ضبط المتتبع
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'rdapify-app',
  }),
});

const exporter = new JaegerExporter({
  endpoint: 'http://localhost:14268/api/traces',
});

provider.addSpanProcessor(
  new BatchSpanProcessor(exporter)
);

provider.register();

// تسجيل الأدوات
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(),
  ],
});

// تهيئة العميل مع التتبع
const client = new RDAPClient({
  tracing: {
    enabled: true,
    provider: 'opentelemetry',
    serviceName: 'rdapify-app'
  }
});

// ستتضمن الآثار تلقائياً:
// - نوع الاستعلام (domain/IP/ASN)
// - قيمة الاستعلام
// - السجل المستخدم
// - إصابة/إخفاق الذاكرة المؤقتة
// - وقت الاستجابة
// - تفاصيل الأخطاء
```

### تصور الآثار

```
Trace: RDAP Domain Query
├─ rdapify.query [2.3s]
│  ├─ cache.lookup [0.1s] ❌ MISS
│  ├─ registry.discover [0.2s] ✅ SUCCESS
│  ├─ http.request [1.8s]
│  │  ├─ dns.resolve [0.1s]
│  │  ├─ tcp.connect [0.2s]
│  │  ├─ tls.handshake [0.3s]
│  │  └─ http.transfer [1.2s]
│  ├─ response.normalize [0.1s]
│  └─ cache.store [0.1s] ✅ SUCCESS
```

---

## فحوصات الصحة

### نقطة نهاية الصحة الشاملة

```javascript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

export async function healthCheck() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION,
    checks: {}
  };

  // فحص اتصال RDAP
  try {
    const start = Date.now();
    await client.domain('example.com');
    health.checks.rdap = {
      status: 'healthy',
      responseTime: Date.now() - start
    };
  } catch (error) {
    health.checks.rdap = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'degraded';
  }

  // فحص الذاكرة المؤقتة
  try {
    await cacheClient.ping();
    health.checks.cache = {
      status: 'healthy',
      hitRate: await cacheClient.getHitRate()
    };
  } catch (error) {
    health.checks.cache = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'degraded';
  }

  // فحص الذاكرة
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'healthy' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
  };

  return health;
}

// مسبار حيوية (هل التطبيق يعمل؟)
export function livenessCheck() {
  return { status: 'alive', timestamp: new Date().toISOString() };
}

// مسبار الجاهزية (هل التطبيق جاهز لتلقي الطلبات؟)
export async function readinessCheck() {
  try {
    await client.domain('example.com');
    return { status: 'ready', timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
```

---

## التنبيه

### قواعد التنبيه

```yaml
# prometheus-alerts.yml
groups:
  - name: rdapify_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(rdap_queries_total{status="error"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High RDAP error rate"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: SlowQueries
        expr: histogram_quantile(0.95, rdap_query_duration_seconds) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow RDAP queries"
          description: "95th percentile latency is {{ $value }}s"

      - alert: LowCacheHitRate
        expr: rdap_cache_hit_rate < 0.7
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"

      - alert: ServiceDown
        expr: up{job="rdapify"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "RDAPify service is down"
          description: "Service has been down for more than 1 minute"
```

### إشعار التنبيه

```javascript
import { RDAPClient } from 'rdapify';
import axios from 'axios';

const client = new RDAPClient();

let errorCount = 0;
let totalCount = 0;

client.on('response', () => {
  totalCount++;
});

client.on('error', async (event) => {
  errorCount++;

  const errorRate = errorCount / totalCount;

  if (errorRate > 0.05) {
    await sendAlert({
      severity: 'warning',
      title: 'High RDAP Error Rate',
      message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
      details: {
        errorCount,
        totalCount,
        lastError: event.error.message
      }
    });
  }
});

async function sendAlert(alert) {
  // إرسال إلى Slack
  await axios.post(process.env.SLACK_WEBHOOK, {
    text: `${alert.title}`,
    attachments: [{
      color: alert.severity === 'critical' ? 'danger' : 'warning',
      fields: [
        { title: 'Message', value: alert.message },
        { title: 'Details', value: JSON.stringify(alert.details, null, 2) }
      ]
    }]
  });

  // إرسال إلى PagerDuty للتنبيهات الحرجة
  if (alert.severity === 'critical') {
    await axios.post('https://events.pagerduty.com/v2/enqueue', {
      routing_key: process.env.PAGERDUTY_KEY,
      event_action: 'trigger',
      payload: {
        summary: alert.title,
        severity: alert.severity,
        source: 'rdapify-app',
        custom_details: alert.details
      }
    });
  }
}
```

---

## لوحات المتابعة

### لوحة Grafana

```json
{
  "dashboard": {
    "title": "RDAPify Monitoring",
    "panels": [
      {
        "title": "Query Rate",
        "targets": [{
          "expr": "rate(rdap_queries_total[5m])"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(rdap_queries_total{status=\"error\"}[5m])"
        }]
      },
      {
        "title": "Query Duration (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, rdap_query_duration_seconds)"
        }]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [{
          "expr": "rdap_cache_hit_rate"
        }]
      }
    ]
  }
}
```

---

## تحليل الأداء

### تحليل استخدام المعالج

```javascript
import { RDAPClient } from 'rdapify';
import v8Profiler from 'v8-profiler-next';

const client = new RDAPClient();

// بدء تحليل المعالج
v8Profiler.startProfiling('rdapify-profile', true);

async function runWorkload() {
  const domains = ['example.com', 'google.com', 'github.com'];

  for (const domain of domains) {
    await client.domain(domain);
  }
}

await runWorkload();

// إيقاف التحليل وحفظه
const profile = v8Profiler.stopProfiling('rdapify-profile');
profile.export((error, result) => {
  fs.writeFileSync('rdapify-profile.cpuprofile', result);
  profile.delete();
});
```

### تحليل استخدام الذاكرة

```javascript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

function takeHeapSnapshot() {
  const snapshot = v8.writeHeapSnapshot();
  console.log('Heap snapshot written to:', snapshot);
}

// مراقبة استخدام الذاكرة
setInterval(() => {
  const usage = process.memoryUsage();
  console.log({
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    external: Math.round(usage.external / 1024 / 1024) + 'MB'
  });

  // أخذ لقطة إذا كان استخدام الذاكرة مرتفعاً
  if (usage.heapUsed > usage.heapTotal * 0.9) {
    takeHeapSnapshot();
  }
}, 60000);
```

---

## موارد إضافية

- [دليل النشر](deployment.md)
- [تحسين الأداء](performance.md)
- [استكشاف الأخطاء](../troubleshooting/debugging.md)
- [تكامل المراقبة](../integrations/monitoring/)
- [ضبط Prometheus](../../templates/monitoring/prometheus_config.yaml)
- [لوحة Grafana](../../templates/monitoring/grafana_dashboard.json)

---

**هل تحتاج مساعدة في الرصد والمراقبة؟** راجع [دليل الدعم](../support/getting_help.md).
