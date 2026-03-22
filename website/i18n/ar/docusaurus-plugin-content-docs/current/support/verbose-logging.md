# دليل التسجيل المفصّل

**الهدف**: دليل شامل لإعداد واستخدام التسجيل المفصّل في RDAPify للتشخيص التفصيلي وتحليل الأداء والتدقيق الأمني مع تأثير أداء أدنى
**ذات صلة**: [استكشاف الأخطاء](troubleshooting.md) | [تصحيح الشبكة](network-debugging.md) | [الحصول على المساعدة](getting-help.md)
**وقت القراءة**: 4 دقائق

## مستويات التسجيل وحالات الاستخدام

يدعم RDAPify نظام تسجيل هرمي مع تحكم دقيق في مستويات التفصيل:

| المستوى | البيئة | حالة الاستخدام | تأثير الأداء | فترة الاحتفاظ |
|---------|--------|--------------|--------------|---------------|
| **fatal** | الإنتاج | حالات فشل حرجة تتطلب اهتماماً فورياً | لا يوجد | 30 يوماً |
| **error** | الإنتاج | حالات خطأ تؤثر على عمليات محددة | لا يوجد | 30 يوماً |
| **warn** | الإنتاج | مشكلات غير حرجة تتطلب الانتباه | لا يوجد | 30 يوماً |
| **info** | الإنتاج | معلومات تشغيلية معيارية | لا يوجد | 14 يوماً |
| **debug** | التدريج/الاختبار | تشخيص تشغيلي تفصيلي | منخفض | 7 أيام |
| **trace** | التطوير | تتبع كامل للطلب/الاستجابة | متوسط | 24 ساعة |
| **sensitive** | التدقيق الأمني | أحداث وصول PII وأحداث الأمان | متوسط | 90 يوماً (GDPR) |

## تفعيل التسجيل المفصّل

### 1. خيارات الإعداد

```javascript
// الإعداد البرمجي
const client = new RDAPClient({
  logging: {
    level: 'debug', // تعيين مستوى التسجيل الافتراضي
    format: 'json', // 'json'، 'human'، أو 'syslog'
    privacy: true, // إخفاء PII دائماً في السجلات
    sampling: {
      error: 1.0,    // تسجيل جميع الأخطاء
      warn: 1.0,     // تسجيل جميع التحذيرات
      debug: 0.25,   // عينة 25% من سجلات debug
      trace: 0.05    // عينة 5% من سجلات trace
    },
    transports: [
      { type: 'console', level: 'debug' },
      { type: 'file', path: '/var/log/rdapify.log', level: 'info' },
      { type: 'http', url: 'https://logs.example.com/ingest', level: 'error' }
    ],
    context: {
      include: ['requestId', 'tenantId', 'userId', 'registry'],
      redact: ['email', 'phone', 'address', 'fn']
    }
  }
});
```

### 2. إعداد متغيرات البيئة

```bash
# بيئة التطوير
RDAP_LOG_LEVEL=trace
RDAP_LOG_FORMAT=json
RDAP_LOG_REDACT_PII=true
RDAP_LOG_SENSITIVE_FIELDS=email,phone,address
RDAP_LOG_SAMPLE_RATE=0.5

# بيئة الإنتاج
RDAP_LOG_LEVEL=info
RDAP_LOG_ERROR_SAMPLING=1.0
RDAP_LOG_WARN_SAMPLING=1.0
RDAP_LOG_DEBUG_SAMPLING=0.0
RDAP_LOG_CONTEXT_FIELDS=requestId,tenantId

# بيئة التدقيق الأمني
RDAP_LOG_LEVEL=sensitive
RDAP_LOG_SENSITIVE=true
RDAP_LOG_REDACT_PII=false  # فقط في بيئات التدقيق الآمنة
RDAP_LOG_RETENTION_DAYS=90
```

## أمثلة تنسيق السجل

### تنسيق JSON (موصى به للإنتاج)

```json
{
  "timestamp": "2025-12-05T14:23:17.123Z",
  "level": "debug",
  "message": "Registry query executed",
  "context": {
    "requestId": "req_7a8b9c0d1e2f",
    "tenantId": "tenant_12345",
    "registry": "verisign",
    "queryType": "domain",
    "queryValue": "example.com"
  },
  "duration": 125,
  "cacheHit": false,
  "registryResponseCode": 200,
  "connectionPoolSize": 12,
  "activeConnections": 3
}
```

### التنسيق المقروء بشرياً (التطوير)

```
2025-12-05T14:23:17.123Z [DEBUG] Registry query executed
  Request ID: req_7a8b9c0d1e2f
  Tenant: tenant_12345
  Registry: verisign
  Query: domain/example.com
  Duration: 125ms
  Cache: miss
  Response Code: 200
  Connection Pool: 12 total, 3 active
```

## ميزات التسجيل المتقدمة

### 1. نشر السياق

```javascript
// مثال middleware لـ Express.js
app.use((req, res, next) => {
  const context = {
    requestId: req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    tenantId: req.headers['x-tenant-id'] || 'default',
    userId: req.user?.id,
    clientIp: req.ip,
    userAgent: req.headers['user-agent']
  };

  // تعيين السياق لجميع السجلات اللاحقة
  logger.setContext(context);
  req.logContext = context;

  // إضافة معرف الارتباط للاستجابة
  res.setHeader('X-Request-ID', context.requestId);

  next();
});

// الاستخدام في معالج المسار
app.get('/domain/:domain', async (req, res) => {
  const { domain } = req.params;
  const log = logger.child({ domain });

  try {
    log.debug('Processing domain query', {
      registry: await detectRegistry(domain),
      startTime: Date.now()
    });

    const result = await client.domain(domain, req.logContext);
    log.info('Domain query successful', {
      duration: Date.now() - log.startTime,
      status: result.status
    });

    res.json(result);
  } catch (error) {
    log.error('Domain query failed', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      duration: Date.now() - log.startTime
    });
    res.status(500).json({ error: error.message });
  }
});
```

### 2. التسجيل الشرطي بناءً على السياق

```javascript
// التسجيل الشرطي للنطاقات الحرجة
logger.addConditionalRule({
  condition: (context) => {
    // تسجيل أكثر تفصيلاً للنطاقات الحرجة
    const criticalDomains = ['example.com', 'google.com', 'facebook.com'];
    return context.domain && criticalDomains.includes(context.domain.toLowerCase());
  },
  level: 'trace',
  sampling: 1.0, // 100% للنطاقات الحرجة
  fields: ['rawResponse', 'connectionDetails', 'cacheState']
});

// التسجيل الشرطي بناءً على أنماط الأخطاء
logger.addConditionalRule({
  condition: (context, error) => {
    // تسجيل تفاصيل أكثر لأخطاء تقييد المعدل
    return error?.message?.includes('rate limit') || error?.code === 'RATE_LIMITED';
  },
  level: 'debug',
  sampling: 1.0,
  fields: ['registryLimits', 'retryStrategy', 'backoffDuration']
});
```

## تحسين الأداء

### 1. استراتيجيات أخذ العينات

```javascript
// أخذ عينات تكيفي بناءً على معدلات الأخطاء
class AdaptiveSampler {
  constructor(options = {}) {
    this.errorThreshold = options.errorThreshold || 0.05; // حد معدل خطأ 5%
    this.baseSampling = {
      error: 1.0,
      warn: 0.5,
      debug: 0.1,
      trace: 0.01
    };
    this.highSampling = {
      error: 1.0,
      warn: 1.0,
      debug: 0.5,
      trace: 0.2
    };
    this.errorRate = 0;
    this.lastUpdate = Date.now();
    this.errorCount = 0;
    this.totalRequests = 0;
  }

  updateMetrics(success, total) {
    this.errorCount += success ? 0 : 1;
    this.totalRequests += total;

    const now = Date.now();
    if (now - this.lastUpdate > 60000) { // تحديث كل دقيقة
      this.errorRate = this.errorCount / this.totalRequests;
      this.errorCount = 0;
      this.totalRequests = 0;
      this.lastUpdate = now;
    }
  }

  getSamplingConfig() {
    return this.errorRate > this.errorThreshold
      ? this.highSampling
      : this.baseSampling;
  }
}

// الاستخدام
const sampler = new AdaptiveSampler();
const client = new RDAPClient({
  logging: {
    sampling: () => sampler.getSamplingConfig()
  }
});

// تحديث المقاييس بعد عمليات الدُفعات
async function processBatch(domains) {
  const results = await Promise.allSettled(domains.map(d => client.domain(d)));
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  sampler.updateMetrics(successCount, domains.length);
}
```

### 2. التسجيل غير المتزامن مع ضغط الرجعة

```javascript
// التسجيل غير المعيق مع معالجة ضغط الرجعة
class AsyncLogger {
  constructor(options = {}) {
    this.queue = [];
    this.flushInterval = options.flushInterval || 100; // مللي ثانية
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.backpressureThreshold = options.backpressureThreshold || 0.8;
    this.droppedLogs = 0;
    this.startFlushing();
  }

  log(level, message, context = {}) {
    // تطبيق أخذ العينات
    if (Math.random() > this.getSampleRate(level)) {
      return;
    }

    // إخفاء الحقول الحساسة
    const safeContext = this.redactSensitiveFields(context);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: safeContext,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    };

    // معالجة ضغط الرجعة
    if (this.queue.length > this.maxQueueSize * this.backpressureThreshold) {
      this.droppedLogs++;
      if (this.droppedLogs % 100 === 0) {
        console.warn(`[LOGGING] Dropped ${this.droppedLogs} logs due to backpressure`);
      }
      return;
    }

    this.queue.push(logEntry);
  }

  startFlushing() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, 100); // معالجة 100 سجل في كل مرة
    this.writeBatch(batch).catch(error => {
      console.error('[LOGGING] Failed to write batch:', error);
      // إعادة قائمة الانتظار للسجلات الفاشلة مع تراجع أسي
      setTimeout(() => {
        this.queue.unshift(...batch.slice(0, Math.min(10, batch.length)));
      }, 1000);
    });
  }

  async writeBatch(batch) {
    // يكتب إلى وسائل النقل المعدَّة
    for (const entry of batch) {
      console.log(JSON.stringify(entry));
      // إرسال إلى خدمة تسجيل خارجية
      // كتابة إلى ملف
    }
  }
}
```

## الأمان والامتثال

### 1. إخفاء PII في السجلات

```javascript
// إعداد إخفاء PII الشامل
const piiRedactionConfig = {
  fields: [
    'email', 'phone', 'address', 'fn', 'n', 'tel', 'adr',
    'organization', 'registrant', 'billingContact', 'technicalContact'
  ],
  patterns: [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\d{1,5}\s+(?:[\w\s]+,?\s+){2,4}[A-Z]{2}\s+\d{5}(-\d{4})?\b/gi
  ],
  exceptions: [
    {
      context: { logLevel: 'sensitive', environment: 'audit' },
      allowedFields: ['email', 'organization']
    }
  ],
  replacementStrategy: 'hash' // 'mask'، 'hash'، أو 'remove'
};

logger.configurePIIRedaction(piiRedactionConfig);

// مثال سجل بعد الإخفاء
logger.debug('User query processed', {
  email: 'user@example.com',
  phone: '+1.555.123.4567',
  domain: 'example.com'
});
// المخرجات:
// { email: '[REDACTED]', phone: '[REDACTED]', domain: 'example.com' }
```

### 2. التسجيل المتوافق مع GDPR

```javascript
// إعداد التسجيل المتوافق مع GDPR
const gdprLogger = new RDAPLogger({
  compliance: {
    framework: 'gdpr',
    dataRetentionDays: 30,
    legalBasis: 'legitimate-interest',
    dpoContact: 'dpo@example.com',
    dataProcessingNotice: 'Logs are processed for security and service improvement purposes'
  },
  redaction: {
    enabled: true,
    fields: ['email', 'phone', 'address', 'ip'],
    hashAlgorithm: 'sha256'
  },
  retention: {
    errorLogs: 90,
    securityLogs: 2555, // 7 سنوات للأحداث الأمنية
    auditLogs: 2555,
    debugLogs: 7
  },
  auditTrail: {
    enabled: true,
    logAccess: true,
    logChanges: true,
    logDeletions: true
  }
});

// حذف البيانات تلقائياً بناءً على سياسة الاحتفاظ
setInterval(() => {
  gdprLogger.purgeExpiredLogs();
}, 24 * 60 * 60 * 1000); // تنظيف يومي
```

## استكشاف مشكلات التسجيل الشائعة

### 1. إغراق حجم السجل
**الأعراض**: استنفاد مساحة القرص، تقييد خدمة التسجيل، تباطؤ التطبيق
**الحلول**:
✅ **أخذ عينات ذكي**: تطبيق أخذ عينات تكيفي بناءً على معدلات الأخطاء والأهمية التجارية
✅ **احتفاظ متعدد المستويات**: إعداد فترات احتفاظ مختلفة بناءً على خطورة السجل (الأخطاء تُحتفظ بها أطول من debug)
✅ **تجزئة السجلات**: تقسيم السجلات حسب الخدمة أو المستأجر أو نوع السجل لتحسين إمكانية الإدارة
✅ **الضغط**: تفعيل ضغط السجل بـ gzip أو zstd للسجلات المؤرشفة

### 2. السياق المفقود في سجلات الأخطاء
**الأعراض**: سجلات الأخطاء تفتقر إلى سياق كافٍ لتشخيص المشكلات
**الحلول**:
✅ **نشر السياق**: ضمان تدفق السياق عبر الحدود غير المتزامنة باستخدام AsyncLocalStorage
✅ **إثراء الأخطاء**: إضافة السياق تلقائياً للأخطاء باستخدام حدود الأخطاء أو middleware
✅ **معرفات الارتباط**: تضمين معرفات الارتباط دائماً في سياقات السجل لتتبع قابلية التتبع
✅ **السياق الهيكلي**: تخزين السياق بتنسيق هيكلي بدلاً من تسلسل السلاسل

### 3. تدهور الأداء من التسجيل
**الأعراض**: تباطؤ التطبيق عند تفعيل التسجيل المفصّل
**الحلول**:
✅ **التسجيل غير المتزامن**: استخدام التسجيل غير المعيق مع معالجة ضغط الرجعة
✅ **التسجيل الشرطي**: تقييم رسائل السجل المكلفة فقط عند تسجيلها فعلاً
✅ **الكتابة المُخزَّنة**: تجميع كتابات السجل لتقليل عمليات I/O
✅ **عتبات مستوى السجل**: تعيين عتبات مناسبة لمنع توليد سجلات غير ضرورية

## الوثائق ذات الصلة

| الوثيقة | الوصف | المسار |
|---------|-------|--------|
| [استكشاف الأخطاء](troubleshooting.md) | دليل استكشاف الأخطاء العام | [troubleshooting.md](troubleshooting.md) |
| [تصحيح الشبكة](network-debugging.md) | تشخيص المشكلات على مستوى الشبكة | [network-debugging.md](network-debugging.md) |

## مواصفات التسجيل

| الخاصية | القيمة |
|---------|--------|
| **المستوى الافتراضي** | info (الإنتاج)، debug (التطوير) |
| **خيارات التنسيق** | JSON، مقروء بشرياً، syslog، CEE |
| **الحد الأقصى لحجم السياق** | 10 كيلوبايت لكل إدخال سجل |
| **حجم قائمة الانتظار** | 1000 إدخال (قابل للتهيئة) |
| **فاصل التفريغ** | 100 مللي ثانية (قابل للتهيئة) |
| **استراتيجيات أخذ العينات** | ثابتة، تكيفية، قائمة على السياق |
| **إخفاء PII** | مفعّل افتراضياً في جميع البيئات |
| **الامتثال لـ GDPR** | الاحتفاظ والحذف المدمجان |
| **تغطية الاختبارات** | 95% اختبارات وحدة، 85% اختبارات تكامل |
| **آخر تحديث** | 5 ديسمبر 2025 |

> **تذكير حرج**: لا تُعطِّل إخفاء PII في تسجيل الإنتاج أبداً دون أساس قانوني موثق وموافقة مسؤول حماية البيانات. في البيئات الخاضعة للتنظيم، نفِّذ عمليات تدقيق ربع سنوية لإعدادات التسجيل واحتفظ بنسخ احتياطية غير متصلة من سجلات التدقيق الأمنية. التدقيق الأمني المنتظم لمسارات التسجيل مطلوب للحفاظ على الامتثال مع المادة 32 من GDPR واللوائح المماثلة.

[← العودة إلى الدعم](../README.md) | [التالي: تصحيح الشبكة ←](network-debugging.md)

*وثيقة مُولَّدة تلقائياً من الكود المصدري مع مراجعة أمنية في 5 ديسمبر 2025*
