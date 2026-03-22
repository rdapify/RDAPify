# استكشاف أخطاء Lambda Workers

**الهدف**: دليل شامل لتشخيص وحل المشكلات الخاصة بعمليات نشر AWS Lambda لـ RDAPify مع تقنيات عملية لاستكشاف الأخطاء واستراتيجيات تحسين الأداء وإعدادات واعية بالامتثال
**ذات صلة**: [الأخطاء الشائعة](common-errors.md) | [التصحيح](debugging.md) | [حل انتهاء مهلة الاتصال](connection-timeout.md) | [تدوير الوكيل](proxy-rotation.md)
**وقت القراءة**: 7 دقائق

## تصنيف الأخطاء الخاصة بـ Lambda

تُقدّم عمليات نشر AWS Lambda تحديات فريدة لتطبيقات RDAPify بسبب قيود وسلوكيات نموذج التنفيذ بدون خادم:

| فئة الخطأ | الأسباب الخاصة بـ Lambda | التأثير | صعوبة الكشف |
|-----------|--------------------------|---------|-------------|
| **فشل البداية الباردة** | حزم نشر كبيرة، تهيئة VPC، bootstrap للسجلات | زمن استجابة عالٍ في أول استدعاء | متوسط |
| **استنفاد الذاكرة** | مشكلات حجم الذاكرة المؤقتة، معالجة الدفعات الكبيرة | تعطل الدالة، فقدان البيانات | عالٍ |
| **أخطاء انتهاء المهلة** | زمن استجابة الشبكة للسجلات، معالجة الاستجابات الكبيرة | بيانات جزئية، عواصف إعادة المحاولة | متوسط |
| **إعداد VPC** | إعداد خاطئ لمجموعة الأمان، حدود NAT gateway | فشل الاتصال، انتهاء المهلة | عالٍ |
| **حدود التنفيذ المتزامن** | حدود حساب AWS، استنفاد سعة الانفجار | طلبات محدودة المعدل، عمليات فاشلة | منخفض |
| **حدود التخزين المؤقت** | فيضان مجلد `/tmp`، مشكلات استمرارية التخزين المؤقت | تعطل الدالة، تلف البيانات | متوسط |

## المشكلات الحرجة في Lambda

### 1. انتهاء مهلة البداية الباردة مع bootstrap للسجلات

**الأعراض**:
```log
2025-12-05T14:30:22.123Z ERROR TimeoutError: Connection timed out after 10000ms
    at Timeout.<anonymous> (/var/task/node_modules/rdapify/dist/network/connection.js:124:16)
    at listOnTimeout (internal/timers.js:554:17)
    at processTimers (internal/timers.js:497:7) {
  name: 'TimeoutError',
  registry: 'verisign',
  domain: 'example.com'
}
```

**الأسباب الجذرية**:
- تهيئة IANA bootstrap أثناء البداية الباردة تتجاوز مهلة Lambda
- البداية الباردة لـ VPC تضيف 8-10 ثوانٍ إلى وقت التهيئة
- حجم حزمة النشر الكبيرة يؤخر تحميل الوحدات
- تحليل DNS للسجلات أثناء مرحلة التهيئة

**خطوات التشخيص**:
```bash
# التحقق من وقت تهيئة Lambda في سجلات CloudWatch
aws logs filter-log-events \
  --log-group-name /aws/lambda/rdapify-prod \
  --start-time $(date -d '1 hour ago' +%s000) \
  --filter-pattern '"INIT_START" OR "INIT_END"' \
  --query 'events[*].{timestamp:timestamp,message:message}' \
  --output table

# قياس وقت تهيئة bootstrap
aws lambda invoke \
  --function-name rdapify-prod \
  --payload '{"domain": "example.com", "debug": {"bootstrap": true}}' \
  output.json
```

**الحلول**:
✅ **ذاكرة Bootstrap مُحضَّرة مسبقاً**:
```javascript
// lib/bootstrap-cache.js
const bootstrapCache = {
  data: null,
  timestamp: 0,
  ttl: 300000, // 5 دقائق

  async get() {
    if (this.data && Date.now() - this.timestamp < this.ttl) {
      console.log('✅ Returning cached bootstrap data');
      return this.data;
    }

    console.log('🔄 Fetching fresh bootstrap data');
    this.data = await fetchIANABootstrap();
    this.timestamp = Date.now();
    return this.data;
  },

  async initialize() {
    // فرض التهيئة أثناء نشر Lambda
    await this.get();
    console.log('🚀 Bootstrap cache pre-warmed');
  }
};

// تهيئة الذاكرة المؤقتة أثناء نشر Lambda
if (process.env.NODE_ENV === 'production') {
  bootstrapCache.initialize().catch(console.error);
}

module.exports = bootstrapCache;
```

✅ **نمط حارس التهيئة**:
```javascript
// handlers/domain.js
const bootstrapCache = require('../lib/bootstrap-cache');
let isInitialized = false;
let initializationPromise = null;

async function ensureInitialized() {
  if (isInitialized) return;

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = bootstrapCache.get()
    .then(() => {
      isInitialized = true;
      initializationPromise = null;
      console.log('✅ RDAPify client initialized');
    });

  return initializationPromise;
}

exports.handler = async (event) => {
  try {
    // بدء التهيئة في الخلفية
    const initPromise = ensureInitialized();

    const domain = event.queryStringParameters?.domain;

    if (!domain) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing domain parameter' })
      };
    }

    // الانتظار لاكتمال التهيئة قبل المعالجة
    await initPromise;

    const result = await global.rdapClient.domain(domain);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('❌ Lambda handler error:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'internal_server_error',
        message: 'Failed to process request',
        initializationStatus: isInitialized ? 'complete' : 'in_progress'
      })
    };
  }
};

// تهيئة العميل أثناء مرحلة استيراد Lambda
global.rdapClient = new RDAPClient({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 500, // حجم ذاكرة مؤقتة محدود لـ Lambda
      ttl: 300000
    }
  },
  performance: {
    maxConcurrent: 3,
    connectionPool: {
      max: 10,
      timeout: 3000
    }
  }
});
```

## أنماط تحسين الأداء

### 1. استراتيجيات إدارة الذاكرة
```javascript
// lib/memory-optimizer.js
const { performance } = require('perf_hooks');

class LambdaMemoryOptimizer {
  constructor(options = {}) {
    this.options = {
      maxHeapSize: options.maxHeapSize || 384 * 1024 * 1024, // 384 ميغابايت افتراضي
      gcInterval: options.gcInterval || 60000, // 60 ثانية
      cacheSizeMultiplier: options.cacheSizeMultiplier || 0.3,
      enableHeapSnapshots: options.enableHeapSnapshots || false
    };

    this.gcTimer = null;
    this.heapSnapshots = [];
    this.lastGcTime = 0;
  }

  initialize() {
    process.env.NODE_OPTIONS = `--max-old-space-size=${this.options.maxHeapSize / 1024 / 1024}`;

    this.startGcTimer();
    this.monitorMemory();

    console.log(`Initialized LambdaMemoryOptimizer with ${this.options.maxHeapSize / 1024 / 1024}MB heap limit`);
  }

  startGcTimer() {
    this.gcTimer = setInterval(() => {
      if (Date.now() - this.lastGcTime > this.options.gcInterval) {
        this.forceGc();
      }
    }, this.options.gcInterval);
  }

  forceGc() {
    if (typeof global.gc === 'function') {
      console.log(`🧹 Forcing garbage collection at ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
      const start = performance.now();
      global.gc();
      const duration = performance.now() - start;
      console.log(`✅ GC completed in ${duration.toFixed(1)}ms, heap: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
      this.lastGcTime = Date.now();
    }
  }

  monitorMemory() {
    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapLimitMB = this.options.maxHeapSize / 1024 / 1024;

      console.log(`📊 Memory usage: ${heapUsedMB.toFixed(2)}/${heapLimitMB}MB (${(heapUsedMB / heapLimitMB * 100).toFixed(1)}%)`);

      if (heapUsedMB > heapLimitMB * 0.8) {
        console.warn(`MemoryWarning Memory threshold exceeded: ${heapUsedMB.toFixed(2)}/${heapLimitMB}MB`);
        this.forceGc();
      }

      if (heapUsedMB > heapLimitMB * 0.95) {
        console.error(`🚨 CRITICAL: Memory usage ${heapUsedMB.toFixed(2)}/${heapLimitMB}MB - triggering emergency shutdown`);
        clearInterval(interval);
        process.exit(1);
      }
    }, 30000);

    process.on('SIGTERM', () => {
      console.log('🛑 Memory monitor stopping');
      clearInterval(interval);
      if (this.gcTimer) clearInterval(this.gcTimer);
    });
  }

  optimizeCacheConfig(baseConfig) {
    return {
      ...baseConfig,
      cache: {
        ...baseConfig.cache,
        memory: {
          ...(baseConfig.cache?.memory || {}),
          max: Math.floor(500 * this.options.cacheSizeMultiplier),
          ttl: 300000
        }
      }
    };
  }
}

module.exports = LambdaMemoryOptimizer;
```

## الاعتبارات الأمنية والامتثال

### 1. تصليب بيئة تنفيذ Lambda
```yaml
# serverless.yml مع تصليب الأمان
service: rdapify-lambda

provider:
  name: aws
  runtime: nodejs20.x
  memorySize: 512
  timeout: 15 # 15 ثانية كحد أقصى
  iamRoleStatements:
    - Effect: Allow
      Action:
        - logs:CreateLogGroup
        - logs:CreateLogStream
        - logs:PutLogEvents
      Resource: arn:aws:logs:${aws:region}:${aws:accountId}:log-group:/aws/lambda/rdapify-*

    - Effect: Allow
      Action:
        - ssm:GetParameter
        - kms:Decrypt
      Resource:
        - arn:aws:ssm:${aws:region}:${aws:accountId}:parameter/rdapify/*
        - arn:aws:kms:${aws:region}:${aws:accountId}:key/*

  environment:
    NODE_ENV: production
    RDAP_SSRF_PROTECTION: true
    RDAP_REDACT_PII: true
    RDAP_VALIDATE_CERTIFICATES: true
    DATA_RETENTION_DAYS: 30
    LEGAL_BASIS: legitimate-interest
    CACHE_SIZE: 500
    MAX_CONCURRENT: 3

  vpc:
    securityGroupIds:
      - sg-0123456789abcdef0
    subnetIds:
      - subnet-0123456789abcdef0
      - subnet-0123456789abcdef1
      - subnet-0123456789abcdef2

functions:
  domain:
    handler: handlers/domain.handler
    events:
      - http:
          path: /domain/{domain}
          method: get
          cors: true
    reservedConcurrency: 50 # حرج لأداء يمكن التنبؤ به
    tracing: Active # تفعيل X-Ray tracing

    layers:
      - arn:aws:lambda:${aws:region}:${aws:accountId}:layer:rdapify-deps:1
      - arn:aws:lambda:${aws:region}:${aws:accountId}:layer:security-tools:2

package:
  patterns:
    - '!node_modules/**'
    - '!test/**'
    - '!docs/**'
    - 'dist/**'
    - 'package.json'
```

### 2. معالجة البيانات المتوافقة مع GDPR في Lambda
```javascript
// lib/gdpr-compliance.js
class GDPRComplianceLayer {
  constructor(options = {}) {
    this.options = {
      dataRetentionDays: options.dataRetentionDays || 30,
      legalBasis: options.legalBasis || 'legitimate-interest',
      jurisdiction: options.jurisdiction || 'global',
      dpoContact: options.dpoContact || 'dpo@organization.com'
    };

    this.setupComplianceLogging();
  }

  async processDomainQuery(domain, context) {
    const start = Date.now();
    const requestId = `gdpr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      this.logGDPRProcessing(requestId, domain, context);

      const result = await global.rdapClient.domain(domain, {
        context: {
          ...context,
          gdpr: {
            enabled: true,
            legalBasis: this.options.legalBasis,
            dataRetentionDays: this.options.dataRetentionDays,
            jurisdiction: this.options.jurisdiction
          }
        }
      });

      this.logGDPRSuccess(requestId, domain, result, Date.now() - start);

      return result;
    } catch (error) {
      this.logGDPRFailure(requestId, domain, error, Date.now() - start);
      throw error;
    }
  }

  generateComplianceReport(context) {
    return {
      timestamp: new Date().toISOString(),
      jurisdiction: this.options.jurisdiction,
      legalBasis: this.options.legalBasis,
      retentionPeriod: `${this.options.dataRetentionDays} days`,
      dpoContact: this.options.dpoContact,
      applicableRegulations: ['GDPR', 'CCPA'].filter(reg =>
        this.options.jurisdiction === 'EU' || this.options.jurisdiction === 'US-CA'
      ),
      dataProcessingPurpose: context.purpose || 'domain_registration_verification',
      dataMinimizationApplied: true,
      reportId: `gdpr-report-${Date.now()}`
    };
  }
}

module.exports = GDPRComplianceLayer;
```

## استكشاف مشكلات Lambda الشائعة

### 1. مشكلات البداية الباردة لـ VPC
**الأعراض**: أول استدعاء لـ Lambda يستغرق 10-15 ثانية، ثم الاستدعاءات اللاحقة سريعة
**الأسباب الجذرية**:
- إرفاق VPC يتطلب إنشاء ENI
- قواعد مجموعة الأمان تحجب تحليل DNS
- تقليص NAT gateway أثناء التهيئة
- انتهاء مهلة تحليل DNS لنقاط نهاية السجلات

**الحلول**:
✅ **التزامن المُحضَّر**:
```yaml
# serverless.yml مع التزامن المُحضَّر
functions:
  domain:
    handler: handlers/domain.handler
    provisionedConcurrency: 1 # ابدأ بـ 1، قيّس بناءً على حركة المرور
    events:
      - http:
          path: /domain/{domain}
          method: get
          cors: true
```

✅ **معمارية بدون VPC مع PrivateLink**:
```yaml
# serverless.yml مع معمارية بدون VPC
provider:
  vpc: false # تعطيل إرفاق VPC

  environment:
    USE_PRIVATELINK: true
    RDAP_ENDPOINTS:
      verisign: vpce-0123456789abcdef0-12345678.rdap.vpce.amazonaws.com
      arin: vpce-0123456789abcdef0-12345678.arin.vpce.amazonaws.com
      ripe: vpce-0123456789abcdef0-12345678.ripe.vpce.amazonaws.com
```

### 2. استنفاد الذاكرة أثناء معالجة الدفعات
**الأعراض**: تعطل دالة Lambda بخطأ "out of memory" بعد معالجة 50-100 نطاق
**الأسباب الجذرية**:
- ذاكرة مؤقتة في الذاكرة تنمو بدون حدود
- تسريبات ذاكرة في معالجات حلقة الأحداث
- خوارزمية معالجة دفعات غير فعّالة
- غياب تنظيف الذاكرة بين الاستدعاءات

**الحلول**:
✅ **معالجة الدفعات القائمة على التدفق**:
```javascript
// handlers/batch-domains.js
const { Readable, pipeline } = require('stream');
const { promisify } = require('util');
const { RDAPClient } = require('rdapify');

const pipelineAsync = promisify(pipeline);
const client = new RDAPClient({
  cache: {
    enabled: true,
    type: 'memory',
    memory: {
      max: 200, // حجم ذاكرة مؤقتة مخفض لـ Lambda
      ttl: 300000
    }
  },
  performance: {
    maxConcurrent: 2, // تزامن محافظ لـ Lambda
    connectionPool: {
      max: 5,
      timeout: 3000
    }
  }
});

exports.handler = async (event) => {
  try {
    const domains = event.domains || [];
    const batchSize = Math.min(50, Math.floor(200 / domains.length));

    // إنشاء تدفق من النطاقات
    const domainStream = Readable.from(domains.map(domain => ({ domain })));

    const results = [];
    await pipelineAsync(
      domainStream,
      new Transform({
        objectMode: true,
        transform(chunk, encoding, callback) {
          client.domain(chunk.domain)
            .then(result => {
              results.push({ domain: chunk.domain, result, status: 'success' });
              callback();
            })
            .catch(error => {
              results.push({ domain: chunk.domain, error: error.message, status: 'error' });
              callback();
            });
        },
        flush(callback) {
          // تنظيف الموارد
          client.close().catch(console.error);
          callback();
        }
      })
    );

    const memoryUsage = process.memoryUsage();
    return {
      statusCode: 200,
      body: JSON.stringify({
        results,
        memoryUsage: {
          heapUsed: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
          heapTotal: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
          rss: (memoryUsage.rss / 1024 / 1024).toFixed(2)
        },
        processed: results.length,
        successRate: results.filter(r => r.status === 'success').length / results.length
      })
    };
  } catch (error) {
    console.error('Batch processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

## الوثائق ذات الصلة

| الوثيقة | الوصف | المسار |
|---------|-------|--------|
| [الأخطاء الشائعة](common-errors.md) | المشكلات الشائعة وحلولها | [common-errors.md](common-errors.md) |
| [التصحيح](debugging.md) | تقنيات التصحيح المتقدمة | [debugging.md](debugging.md) |
| [حل انتهاء مهلة الاتصال](connection-timeout.md) | معالجة مشكلات انتهاء مهلة الشبكة | [connection-timeout.md](connection-timeout.md) |
| [تدوير الوكيل](proxy-rotation.md) | التعامل مع تحديد المعدل بالوكيل | [proxy-rotation.md](proxy-rotation.md) |

## مواصفات Lambda

| الخاصية | القيمة |
|---------|--------|
| **وقت التشغيل** | Node.js 20.x (LTS) |
| **حد الذاكرة** | 512 ميغابايت (موصى به)، 256 ميغابايت (حد أدنى) |
| **المهلة** | 15 ثانية (حد أقصى) |
| **حجم الحزمة** | أقل من 50 ميغابايت (غير مضغوط) لبدايات باردة سريعة |
| **التزامن** | تزامن محجوز: 50 لكل دالة |
| **إعداد VPC** | اختياري مع احتياطي PrivateLink |
| **استراتيجية الذاكرة المؤقتة** | ذاكرة فقط مع إدارة TTL عدوانية |
| **معدل الأخطاء** | أقل من 0.1% عند الشريحة المئوية 95 |
| **وقت البداية الباردة** | أقل من 3 ثوانٍ (محسّن) |
| **تغطية الاختبار** | 95% اختبارات وحدة، 90% اختبارات تكامل لكود خاص بـ Lambda |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تذكير حرج**: لا تخزن أبداً بيانات اعتماد حساسة أو مفاتيح API مباشرة في متغيرات بيئة Lambda. استخدم دائماً AWS Systems Manager Parameter Store أو Secrets Manager مع قيود دور IAM. للامتثال لـ GDPR/CCPA، طبّق حذف بيانات تلقائي بعد فترات الاحتفاظ.

[← العودة إلى استكشاف الأخطاء](../README.md) | [التالي: تدوير الوكيل ←](proxy-rotation.md)

*وثيقة مُولَّدة تلقائياً من الكود المصدري مع مراجعة أمنية في 5 ديسمبر 2025*
