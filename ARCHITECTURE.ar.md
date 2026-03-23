# نظرة عامة على العمارة

يتبع **RDAPify** مبادئ **العمارة السداسية** (Ports & Adapters) مدمجة مع **Clean Architecture**
لقابلية الصيانة والاختبار والقابلية للتوسع.

## الحالة الحالية (v0.3.0)

### الميزات الرئيسية
- **Streaming API**: معالجة الاستعلامات الجماعية الكبيرة بكفاءة مع Streaming الذاكرة
- **الرصد والمراقبة**: مقاييس Prometheus و تكامل OpenTelemetry و استكشاف GraphQL
- **Bootstrap متعدد الأقاليم**: اكتشاف bootstrap IANA الموزع مع التوجيه الجغرافي
- **التخزين المؤقت المتقدم**: نمط قاطع الدائرة و تحسين خط أنابيب Redis و إدارة LRU + TTL
- **دعم وقت التشغيل**: Node.js 20+ و Bun و Deno و Cloudflare Workers
- **ربط الأنظمة الأصلية**: تطبيق Rust متاح و Python (PyO3) و Go (cgo) bindings

## هيكل الطبقات

```
┌──────────────────────────────────────────┐
│      طبقة التطبيق                        │  ← نقطة الدخول
│  (RDAPClient, QueryOrchestrator,         │
│   BatchProcessor, MiddlewareManager)     │
├──────────────────────────────────────────┤
│      طبقة النواة                         │  ← منطق العمل
│  (Ports/Interfaces, Domain Models)       │
├──────────────────────────────────────────┤
│      طبقة البنية الأساسية                │  ← الخدمات الخارجية
│  (Fetcher, Cache, Bootstrap, SSRF,       │
│   Logger, Metrics, RateLimiter)          │
├──────────────────────────────────────────┤
│      طبقة مشتركة                        │  ← الاهتمامات المشتركة
│  (Types, Errors, Validators, Constants)  │
└──────────────────────────────────────────┘
```

### قاعدة التبعيات

```
مشترك ← نواة ← تطبيق ← بنية أساسية
```

- **النواة** لا تعتمد على البنية الأساسية
- **البنية الأساسية** تطبق واجهات النواة (مبدأ Dependency Inversion)
- **التطبيق** يتنسيق كل شيء من خلال حقن التبعيات
- **المشترك** يستخدمه جميع الطبقات

## المكونات الرئيسية

### 1. RDAPClient (طبقة التطبيق)

نقطة الدخول الرئيسية لجميع استعلامات RDAP. يتنسق خط أنابيب الاستعلام بالكامل.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  timeout: 10000,
  cache: { ttl: 3600, maxSize: 1000 },
  privacy: { redactPII: true },
  metrics: { enabled: true }
});

// استعلامات بسيطة
const domain = await client.domain('example.com');
const ip = await client.ip('192.0.2.1');
const asn = await client.asn('AS65000');

// معالجة جماعية مع streaming
const batchResults = client.batch()
  .add('domain', 'example.com')
  .add('domain', 'google.com')
  .stream()
  .on('data', (result) => console.log(result))
  .on('error', (error) => console.error(error));
```

### 2. واجهات النواة (Ports)

تحدد العقود للخدمات الخارجية:

```typescript
// واجهة التخزين المؤقت
interface ICachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  clear(): Promise<void>;
}

// واجهة جلب HTTP
interface IFetcherPort {
  fetch(url: URL, options: FetchOptions): Promise<Response>;
  validateURL(url: URL): void;
}

// واجهة اكتشاف السجل
interface IBootstrapPort {
  discover(query: string, type: QueryType): Promise<string[]>;
  cache(): Promise<void>;
}

// واجهة معايرة البيانات
interface INormalizerPort {
  normalize(data: unknown, type: QueryType): Promise<NormalizedResponse>;
}

// واجهة تسريح البيانات الشخصية
interface IPIIRedactorPort {
  redact(data: Record<string, unknown>, level: PrivacyLevel): Record<string, unknown>;
}
```

### 3. تطبيقات البنية الأساسية

التطبيقات الملموسة لواجهات النواة:

- **CacheManager** - التخزين المؤقت LRU في الذاكرة مع TTL و نمط قاطع الدائرة و دعم Redis
- **Fetcher** - عميل HTTP مع Connection Pooling و منطق إعادة المحاولة و دعم Streaming
- **BootstrapDiscovery** - اكتشاف سجل bootstrap IANA مع دعم متعدد الأقاليم
- **Normalizer** - تحويل البيانات المستند إلى JSONPath مع سلامة النوع
- **PIIRedactor** - إزالة البيانات الشخصية المتوافقة مع GDPR/CCPA مع مستويات قابلة للتكوين
- **SSRFProtection** - التحقق الأمني ضد نطاقات IP الخاصة و إعادة ربط DNS
- **MetricsCollector** - مقاييس Prometheus و تتبع الأداء
- **AuditLogger** - سجل منظم للامتثال
- **RateLimiter** - تطبيق Token Bucket لإدارة الحصص
- **ConnectionPool** - HTTP/2 connection pooling و إعادة استخدام

## أنماط التصميم

### 1. Dependency Inversion
النواة تحدد الواجهات و البنية الأساسية تطبقها.

```typescript
class QueryOrchestrator {
  constructor(
    private cache: ICachePort,
    private fetcher: IFetcherPort,
    private bootstrap: IBootstrapPort,
    private normalizer: INormalizerPort
  ) {}
}
```

### 2. نمط Repository
التخزين المؤقت يعمل كمستودع لاستجابات RDAP.

```typescript
const cachedResult = await cache.get(`domain:example.com`);
if (!cachedResult) {
  const result = await fetcher.fetch(url);
  await cache.set(`domain:example.com`, result, 3600);
}
```

### 3. نمط Strategy
معايرات مختلفة لأنواع بيانات مختلفة.

```typescript
const normalizer = new Normalizer({
  domain: domainNormalizationStrategy,
  ip: ipNormalizationStrategy,
  asn: asnNormalizationStrategy
});
```

### 4. Chain of Responsibility
معالجة الأخطاء مع منطق إعادة المحاولة والبدائل.

```typescript
const response = await retryStrategy
  .withMaxAttempts(3)
  .withBackoff(exponentialBackoff)
  .withFallback(fallbackRegistry)
  .execute(() => fetcher.fetch(url));
```

### 5. نمط Factory
مصنع العميل لإنشاء حالات مكونة.

```typescript
const client = RDAPClient.create({
  presets: 'production',
  customCache: new RedisCache(),
  metrics: prometheusCollector
});
```

### 6. نمط Observer
العمارة التي تعتمد على الأحداث للـ streaming والمراقبة.

```typescript
client.on('query', (event) => console.log(event));
client.on('cache-hit', (event) => metrics.recordHit());
client.on('fetch-error', (event) => alerting.notify(event));
```

## تدفق البيانات

### خط أنابيب الاستعلام البسيط

```
طلب المستخدم
    ↓
RDAPClient.domain('example.com')
    ↓
QueryOrchestrator.execute()
    ├─ InputValidator: التحقق من صيغة النطاق
    │   ↓
    ├─ CacheManager: التحقق من ذاكرة التخزين المؤقت L1/L2
    │   ├→ إصابة ذاكرة التخزين المؤقت؟ العودة (بث حدث)
    │   └→ خطأ في ذاكرة التخزين المؤقت؟ متابعة
    │       ↓
    ├─ BootstrapDiscovery: العثور على خادم موثوق
    │   └→ الاستعلام عن سجل bootstrap IANA
    │       ↓
    ├─ SSRFProtection: التحقق من عنوان URL bootstrap
    │   └→ فحص نطاقات IP الخاصة و إعادة ربط DNS
    │       ↓
    ├─ Fetcher: الجلب من خادم RDAP
    │   └→ طلب HTTP مع connection pooling
    │       ↓
    ├─ Normalizer: تحويل RDAP الخام إلى مخطط
    │   └→ استخلاص قائم على JSONPath
    │       ↓
    ├─ PIIRedactor: إزالة البيانات الشخصية (GDPR/CCPA)
    │   └→ تسريح البريد والهاتف والعناوين بناءً على مستوى الخصوصية
    │       ↓
    ├─ CacheManager: تخزين النتيجة المعايرة
    │   └→ L1 (في الذاكرة) + L2 (Redis) إن كانت مكونة
    │       ↓
    └─ إرجاع DomainResponse
        ↓
    يتلقى المستخدم النتيجة
```

### معالجة جماعية مع Streaming

```
BatchProcessor.stream()
    ↓
لكل استعلام في الحزمة:
  ├─ الدخول إلى طابور المعالجة
  │   ↓
  ├─ عامل يعالج مع إزالة التكرار
  │   ├─ التحقق مما إذا كان نفس الاستعلام قيد الرحلة
  │   ├─ دمج النتائج إذا كانت مكررة
  │   └─ تنفيذ خط الأنابيب (ذاكرة مؤقتة → bootstrap → fetch → normalize → redact)
  │       ↓
  └─ بث حدث 'data' مع النتيجة
        ↓
    Stream إلى التطبيق
```

## أنواع الاستعلامات

يدعم RDAPify 5 أنواع استعلام أساسية:

1. **النطاق**: `client.domain('example.com')` - معلومات تسجيل TLD/SLD
2. **IP**: `client.ip('192.0.2.1')` - معلومات تسجيل الشبكة
3. **ASN**: `client.asn('AS65000')` - معلومات النظام المستقل
4. **خادم الأسماء**: `client.nameserver('ns1.example.com')` - معلومات خادم DNS
5. **الكيان**: `client.entity('contact-id')` - معلومات المسجل/الاتصال

كل واحد يدعم:
- استعلامات فردية
- معالجة جماعية
- نتائج streaming
- معايرات مخصصة
- مستويات تسريح الخصوصية

## عمارة الأمان

### الدفاع المتعدد الطبقات

1. **التحقق من المدخلات**
   - التحقق من صيغة النطاق (الطول والأحرف)
   - التحقق من عنوان IP (IPv4 و IPv6 CIDR)
   - التحقق من صيغة ASN
   - قائمة بيضاء نوع الاستعلام

2. **حماية SSRF**
   - حجب نطاق IP الخاص (RFC 1918 و 6598 و 4193)
   - تصفية عنوان Loopback
   - تصفية عنوان Link-local
   - حماية إعادة ربط DNS (إعادة التحقق قبل الاتصال)

3. **التحقق من الشهادة**
   - التحقق من شهادة TLS
   - التحقق من اسم المضيف
   - دعم HSTS
   - تثبيت الشهادة (قابل للتكوين)

4. **تسريح البيانات الشخصية**
   - تسريح عناوين البريد الإلكتروني افتراضياً
   - تسريح أرقام الهاتف
   - تسريح العناوين البريدية
   - تسريح الأسماء/الأشخاص (قابل للتكوين)
   - امتثال المادة 32 من GDPR

5. **تحديد الحد الأقصى**
   - خوارزمية Token Bucket
   - حصص لكل IP أو لكل API-key
   - معالجة Backpressure
   - التنظيم التكيفي

### الخصوصية من التصميم

- تسريح البيانات الشخصية مفعّل افتراضياً
- مستويات خصوصية قابلة للتكوين (صارم و معياري و متسامح)
- لا تجميع التلمتري افتراضياً (اختياري فقط)
- تسجيل Audit للامتثال
- مبدأ تقليل البيانات

## عمارة الأداء

### استراتيجية التخزين المؤقت

**نظام التخزين المؤقت بثلاث طبقات:**

- **ذاكرة التخزين المؤقت L1**: LRU في الذاكرة (افتراضي TTL 1 ساعة)
  - سريع و محلي العملية
  - حد أقصى قابل للتكوين (افتراضي: 1000 إدخال)

- **ذاكرة التخزين المؤقت L2**: Redis (عبر محول RedisCache)
  - مستمر عبر إعادة التشغيل
  - قابل للمشاركة عبر العمليات
  - وراثة TTL من L1

- **ذاكرة التخزين المؤقت L3**: ذاكرة تخزين مؤقت CDN على الحافة (مستقبلاً)
  - التوزيع الجغرافي
  - تقليل الكمون بخوادم RDAP

### تقنيات التحسين

- **Connection Pooling**: HTTP/2 multiplexing مع keep-alive
- **تخزين Bootstrap مؤقتاً**: سجل bootstrap IANA مخزن محلياً
- **إزالة تكرار الاستعلام**: دمج طلب في الرحلة
- **معالجة جماعية**: Stream مجموعات استعلام كبيرة بكفاءة
- **الضغط**: ضغط استجابة gzip/brotli
- **قاطع الدائرة**: فشل سريع للخدمات المتدهورة
- **موجهة بالمقاييس**: رصد الأداء لتحسين الأداء

### المعايير

```
بحث النطاق (مخزن مؤقتاً):    < 1ms
بحث النطاق (بدون ذاكرة):     100-500ms
بحث IP:                   50-200ms
حزمة 1000 استعلام:         5-30s (يعتمد على معدل إصابة الذاكرة)
النفقات العامة للذاكرة:      ~1-5MB لكل 1000 إدخال مخزن مؤقتاً
استخدام CPU (خامل):       <1% استعلام واحد
```

## قابلية التوسع

### نظام الإضافات (Plugin System)

تخصيص السلوك من خلال Middleware:

```typescript
// Middleware المصادقة
client.use({
  async beforeFetch(context) {
    context.headers['Authorization'] = `Bearer ${token}`;
    return context;
  }
});

// استراتيجية التخزين المؤقت المخصص
client.use({
  getCache: () => new RedisCache(),
  setCache: (key, value, ttl) => redisCache.set(key, value, ttl)
});

// معاير مخصص
client.use({
  getNormalizer: () => new CustomNormalizer()
});

// Logger مخصص
client.use({
  log: (level, message, context) => {
    console.log(`[${level}] ${message}`, context);
  }
});
```

### تطبيقات مخصصة

طبّق واجهات النواة للسلوك المخصص:

```typescript
// تطبيق ذاكرة مخصص
class DynamoDBCache implements ICachePort {
  async get<T>(key: string): Promise<T | null> {
    const item = await dynamodb.getItem({
      TableName: 'rdap-cache',
      Key: { pk: { S: key } }
    });
    return item.Item?.data?.S ? JSON.parse(item.Item.data.S) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await dynamodb.putItem({
      TableName: 'rdap-cache',
      Item: {
        pk: { S: key },
        data: { S: JSON.stringify(value) },
        ttl: { N: String((Date.now() + (ttl || 3600) * 1000) / 1000) }
      }
    });
  }

  async clear(): Promise<void> {
    await dynamodb.deleteTable({ TableName: 'rdap-cache' });
  }
}

const client = new RDAPClient({
  cache: new DynamoDBCache()
});
```

## عمارة الاختبار

### هرم الاختبار

```
        ╱╲
       ╱E2E╲         ← قليل و بطيء و غالي
      ╱──────╲
     ╱Integr.╲      ← بعض و سرعة متوسطة
    ╱──────────╲
   ╱   Unit     ╲   ← كثير و سريع و رخيص
  ╱──────────────╲
```

### تغطية الاختبار

- **اختبارات الوحدة**: تغطية ≥80% (الفروع والوظائف والأسطر والعبارات)
- **اختبارات التكامل**: المسارات الحرجة و تدفقات متعددة المكونات
- **اختبارات E2E**: سيناريوهات المستخدم و خوادم RDAP الحقيقية (live tests)
- **اختبارات الأمان**: حماية SSRF و التحقق من المدخلات و تسريح البيانات الشخصية
- **اختبارات الأداء**: معايير التخزين المؤقت والمعالجة الجماعية

## التحكم في الإصدار والاستقرار

### Semantic Versioning

- **MAJOR** (v1.0.0): تغييرات محطمة و عمارة جديدة و ميزات رئيسية
- **MINOR** (v0.3.0): ميزات جديدة متوافقة للخلف
- **PATCH** (v0.3.1): إصلاحات الأخطاء و رقع الأمان و تحسينات داخلية

### استقرار API

- **v0.x**: استقرار Alpha/Beta - قد تتغير واجهات البرمجة
- **v1.0**: API مستقر مع ضمان التوافق للخلف لـ v1.x
- **Deprecation Engine**: انتقالات API تدريجية مع تحذيرات

## التكاملات

### تكامل rdapify-rust

يمكن لـ RDAPify استخدام تطبيق Rust الاختياري (`rdapify-nd` Node.js binding) لـ:
- التحقق من SSRF عالي الأداء
- إزالة تكرار استعلام جماعية
- معايرة استجابة RDAP

### تكامل @rdapify/pro

إضافة Pro تضيف:
- التحقق من الترخيص
- مراقبة الاستعلام الجماعي
- اكتشاف التغييرات
- التحليلات والتقارير
- تكاملات Webhook

---

**آخر تحديث**: 23 مارس 2026
**الإصدار**: 0.3.0
