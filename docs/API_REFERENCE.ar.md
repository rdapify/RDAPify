# مرجع الـ API

**الحزمة:** `rdapify`
**الإصدار:** 0.3.2
**الرخصة:** MIT

> **الاستقرار:** ما قبل 1.0.0. أساليب الاستعلام الأساسية وأشكال الاستجابة وأنواع الأخطاء مستقرة.
> الـ API المُعلَّمة بـ **(في تطور)** قد تتغير قبل الإصدار 1.0.0.
> راجع [MIGRATION_GUIDE.ar.md](../MIGRATION_GUIDE.ar.md) لخطة الترقية الكاملة من 0.x إلى 1.0.0.

---

## جدول المحتويات

1. [التثبيت](#1-التثبيت)
2. [مثال سريع](#2-مثال-سريع)
3. [RDAPClient](#3-rdapclient)
4. [أساليب الاستعلام](#4-أساليب-الاستعلام)
5. [الإعداد](#5-الإعداد)
6. [معالجة الأخطاء](#6-معالجة-الأخطاء)
7. [المقاييس والمراقبة](#7-المقاييس-والمراقبة)
8. [نظام الوسيط](#8-نظام-الوسيط)
9. [تكامل إضافة Pro](#9-تكامل-إضافة-pro)
10. [الأنواع والواجهات](#10-الأنواع-والواجهات)
11. [متغيرات البيئة](#11-متغيرات-البيئة)
12. [أمثلة متقدمة](#12-أمثلة-متقدمة)

---

## 1. التثبيت

### npm

```bash
npm install rdapify
```

### Bun

```bash
bun add rdapify
```

### Deno

```typescript
// deno.json
{
  "imports": {
    "rdapify": "npm:rdapify@^0.3.2"
  }
}
```

### المتصفح

يعمل rdapify في بيئات المتصفح عبر `BrowserFetcher`، الذي يُوجِّه الطلبات
عبر وكيل عكسي مُفعَّل له CORS يوفّره المطوّر.

```typescript
import { RDAPClient, BrowserFetcher } from 'rdapify';

const fetcher = new BrowserFetcher({ proxyUrl: 'https://your-proxy.example.com/rdap' });
const client = new RDAPClient({ backend: 'typescript' });
```

> ملاحظة: حماية SSRF مُطبَّقة على جانب الوكيل. لا تُعرِّض وكيل RDAP
> بدون حماية SSRF على الخادم.

### ارتباط Python

```bash
pip install rdapify-py
```

```python
import rdapify_py as rdap

result = rdap.domain("example.com")
print(result["registrar"]["name"])
```

### حزمة Rust

```toml
# Cargo.toml
[dependencies]
rdapify = "0.2"
```

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = RdapClient::new();
    let domain = client.domain("example.com").await?;
    println!("{:?}", domain.registrar);
    Ok(())
}
```

### الارتباط الأصيل لـ Node.js (اختياري — أداء أعلى)

```bash
npm install rdapify rdapify-nd
```

عند تثبيت `rdapify-nd`، يستخدمه `RDAPClient` تلقائيًا في وضع `'auto'`.
اضبط `backend: 'native'` لإلزامه أو `backend: 'typescript'` لتعطيله.

---

## 2. مثال سريع

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

const domain = await client.domain('example.com');

console.log(domain.registrar?.name);   // 'RESERVED-Internet Assigned Numbers Authority'
console.log(domain.nameservers);       // ['a.iana-servers.net', 'b.iana-servers.net']
console.log(domain.status);            // ['client delete prohibited', ...]
console.log(domain.metadata.cached);  // false (أول استعلام)
```

---

## 3. RDAPClient

### المُنشئ

```typescript
new RDAPClient(options?: RDAPClientOptions)
```

ينشئ عميل RDAP جديد. جميع الخيارات اختيارية — يعمل العميل بلا أي إعداد
باستخدام إعدادات افتراضية آمنة (كاش في الذاكرة، حماية SSRF، إعادة المحاولة، إخفاء PII).

```typescript
import { RDAPClient } from 'rdapify';

// بلا إعداد — إعدادات افتراضية آمنة مُطبَّقة تلقائيًا
const client = new RDAPClient();

// إعداد كامل
const client = new RDAPClient({
  cache: { strategy: 'redis', redisClient: redis, ttl: 7200 },
  retry: { maxAttempts: 3, backoff: 'exponential' },
  rateLimit: { enabled: true, maxRequests: 50, windowMs: 60_000 },
  timeout: { request: 15_000, connect: 5_000 },
  logging: { level: 'warn' },
});
```

### الخيارات

جميع الخيارات اختيارية. راجع [§5 الإعداد](#5-الإعداد) للتوثيق التفصيلي
لكل مجموعة خيارات.

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `cache` | `boolean \| CacheOptions` | `{ strategy: 'memory', ttl: 3600 }` | كاش الاستجابات |
| `retry` | `boolean \| RetryOptions` | `{ maxAttempts: 3, backoff: 'exponential' }` | إعادة المحاولة عند الإخفاق |
| `ssrfProtection` | `boolean \| SSRFProtectionOptions` | `{ enabled: true }` | حجب عناوين IP الخاصة |
| `privacy` | `boolean \| PrivacyOptions` | `{ redactPII: true }` | إخفاء بيانات PII |
| `timeout` | `number \| TimeoutOptions` | `{ request: 10_000, connect: 5_000 }` | مُهلة الطلبات |
| `logging` | `LoggingOptions` | `{ level: 'warn' }` | مستوى السجل |
| `rateLimit` | `boolean \| RateLimitOptions` | `{ enabled: false }` | تحديد المعدل على جانب العميل |
| `debug` | `boolean \| DebugOptions` | `false` | مخرجات تصحيح مفصَّلة |
| `circuitBreaker` | `CircuitBreakerConfig \| false` | `{}` (مُفعَّل) | قاطع دائرة لكل سجل |
| `backend` | `'auto' \| 'native' \| 'typescript'` | `'auto'` | واجهة تنفيذ الاستعلام |
| `bootstrap` | `BootstrapOptions` | `{ ttl: 86400, fallback: true }` | إعداد IANA Bootstrap |
| `telemetry` | `TelemetryOptions` | `{ enabled: false }` | تتبع OpenTelemetry |
| `deduplication` | `boolean \| DeduplicationConfig` | `false` | إلغاء تكرار الطلبات الجارية |
| `http2` | `boolean` | `false` | تفضيل HTTP/2 |
| `includeRaw` | `boolean` | `false` | تضمين استجابة RDAP الخام |
| `followRedirects` | `boolean` | `true` | اتباع إعادات توجيه HTTP |
| `maxRedirects` | `number` | `5` | الحد الأقصى لقفزات إعادة التوجيه |
| `userAgent` | `string` | `RDAPify/{version}` | رأس User-Agent مخصص |
| `headers` | `Record<string, string>` | `{}` | رؤوس HTTP إضافية |
| `signal` | `AbortSignal` | `undefined` | إشارة الإلغاء |
| `usageTelemetry` | `{ enabled?: boolean; endpoint?: string }` | `{ enabled: false }` | إحصاءات استخدام مجهولة (اشتراكية) |

### الخيارات الافتراضية

```typescript
const DEFAULT_OPTIONS = {
  cache: {
    strategy: 'memory',
    ttl: 3600,      // ساعة واحدة
    maxSize: 1000,
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10_000,
    backoff: 'exponential',
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    blockLinkLocal: true,
    blockedDomains: [],
    allowedDomains: [],
    dnsRebinding: false,
  },
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },
  timeout: {
    connect: 5000,
    request: 10_000,
    dns: 3000,
  },
  logging: { level: 'warn' },
  rateLimit: { enabled: false, maxRequests: 100, windowMs: 60_000 },
  deduplication: false,
  backend: 'auto',
  http2: false,
  includeRaw: false,
  followRedirects: true,
  maxRedirects: 5,
};
```

### أساليب النسخة

| الأسلوب | القيمة المُعادة | الوصف |
|---------|----------------|-------|
| `domain(name)` | `Promise<DomainResponse>` | استعلام بيانات RDAP للنطاق |
| `ip(address)` | `Promise<IPResponse>` | استعلام بيانات RDAP لعنوان IP |
| `asn(number)` | `Promise<ASNResponse>` | استعلام بيانات RDAP لرقم النظام المستقل |
| `nameserver(hostname)` | `Promise<NameserverResponse>` | استعلام بيانات RDAP لخادم الأسماء |
| `entity(handle, serverUrl)` | `Promise<EntityResponse>` | استعلام بيانات RDAP للكيان |
| `checkAvailability(domain)` | `Promise<AvailabilityResult>` | التحقق من توفر النطاق |
| `checkAvailabilityBatch(domains)` | `Promise<Map<string, AvailabilityResult>>` | التحقق الجماعي من التوفر |
| `searchDomains(pattern, serverUrl?)` | `Promise<SearchResult<DomainResponse>>` | البحث عن نطاقات بنمط |
| `searchEntities(pattern, serverUrl)` | `Promise<SearchResult<EntityResponse>>` | البحث عن كيانات بنمط |
| `streamBatch(requests, options?)` | `AsyncGenerator<BatchQueryResult>` | بث نتائج الاستعلام الجماعي |
| `explain(query)` | `Promise<ExplainResult>` | تصحيح خط أنابيب الاستعلام بلا طلب حقيقي |
| `validate()` | `Promise<ValidationResult>` | التحقق من صحة إعداد العميل |
| `getMetrics(since?)` | `MetricsSummary` | الحصول على مقاييس الاستعلام |
| `getCircuitBreakerStats()` | `Record<string, { state: string }>` | الحصول على حالات قاطع الدائرة |
| `getConnectionPoolStats()` | `object` | الحصول على إحصاءات مجموعة الاتصالات |
| `getDeduplicatorStats()` | `object` | الحصول على إحصاءات مزيل التكرار |
| `getStats()` | `Promise<ClientStats>` | الحصول على إحصاءات الكاش والـ bootstrap |
| `getConfig()` | `Required<RDAPClientOptions>` | الحصول على الإعداد النشط |
| `getLogs(count?)` | `LogEntry[]` | الحصول على إدخالات السجل الأخيرة |
| `use(hooks)` | `this` | تسجيل خطافات الوسيط (قابل للتسلسل) |
| `getMiddlewareManager()` | `MiddlewareManager` | الوصول المباشر لمدير الوسيط |
| `clearCache()` | `Promise<void>` | مسح كاشات الاستجابة والـ bootstrap |
| `clearAll()` | `Promise<void>` | مسح الكاشات والمقاييس والسجلات |
| `destroy()` | `void` | تحرير الموارد (محدد المعدل، مجموعة الاتصالات) |

---

## 4. أساليب الاستعلام

### `client.domain(name)`

يستعلم بيانات تسجيل RDAP لاسم نطاق. اكتشاف الخادم تلقائي
عبر IANA Bootstrap.

**التوقيع:**
```typescript
async domain(domain: string): Promise<DomainResponse>
```

**المعاملات:**

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `domain` | `string` | اسم النطاق المؤهَّل بالكامل (مثلًا `'example.com'`، `'münchen.de'`) |

تُقبل نطاقات IDN بأشكال Unicode و ASCII/Punycode.

**يُعيد:** [`DomainResponse`](#domainresponse)

**يُطلق:**

| الخطأ | الشرط |
|-------|-------|
| `ValidationError` | فشل اسم النطاق في التحقق من التنسيق |
| `NoServerFoundError` | لم يُعثر على خادم RDAP لهذا TLD عبر IANA bootstrap |
| `RDAPServerError` (404) | النطاق غير مسجَّل في هذا السجل |
| `NetworkError` | فشل الاتصال بخادم RDAP |
| `TimeoutError` | تجاوز الطلب المُهلة المُعدَّة |
| `SSRFProtectionError` | URL خادم RDAP يُحلَّل إلى نطاق IP محجوب |
| `CircuitOpenError` | قاطع الدائرة لهذا السجل مفتوح |

**مثال:**

```typescript
const result = await client.domain('example.com');

console.log(result.query);            // 'example.com'
console.log(result.handle);           // '2336799_DOMAIN_COM-VRSN'
console.log(result.registrar?.name);  // 'RESERVED-Internet Assigned...'
console.log(result.nameservers);      // ['a.iana-servers.net', ...]
console.log(result.status);           // ['client delete prohibited', ...]

const expiry = result.events?.find(e => e.type === 'expiration');
console.log(expiry?.date);            // '2024-08-13T04:00:00Z'

console.log(result.metadata.source);   // 'https://rdap.verisign.com/com/v1'
console.log(result.metadata.cached);   // true (في الاستدعاءات اللاحقة)
```

---

### `client.ip(address)`

يستعلم بيانات RDAP لعنوان IPv4 أو IPv6. يُكتشف إصدار IP تلقائيًا.

**التوقيع:**
```typescript
async ip(ip: string): Promise<IPResponse>
```

**المعاملات:**

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `ip` | `string` | عنوان IPv4 (`8.8.8.8`) أو IPv6 (`2001:4860:4860::8888`) |

**يُعيد:** [`IPResponse`](#ipresponse)

**يُطلق:**

| الخطأ | الشرط |
|-------|-------|
| `ValidationError` | العنوان ليس IPv4 أو IPv6 صالحًا |
| `SSRFProtectionError` | العنوان في نطاق خاص/محجوز (RFC 1918، loopback، إلخ.) |
| `NoServerFoundError` | لم يُعثر على خادم RDAP لهذه الكتلة من IP |
| `RDAPServerError` | السجل أعاد حالة خطأ |
| `NetworkError` | فشل الاتصال بخادم RDAP |

**مثال:**

```typescript
const result = await client.ip('8.8.8.8');

console.log(result.name);          // 'GOGL'
console.log(result.country);       // 'US'
console.log(result.startAddress);  // '8.8.8.0'
console.log(result.endAddress);    // '8.8.8.255'
console.log(result.ipVersion);     // 'v4'
console.log(result.status);        // ['active']
```

---

### `client.asn(number)`

يستعلم بيانات RDAP لرقم النظام المستقل (ASN).

**التوقيع:**
```typescript
async asn(asn: string | number): Promise<ASNResponse>
```

**المعاملات:**

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `asn` | `string \| number` | رقم ASN كعدد (`15169`) أو مع بادئة (`'AS15169'`) |

**يُعيد:** [`ASNResponse`](#asnresponse)

**يُطلق:**

| الخطأ | الشرط |
|-------|-------|
| `ValidationError` | المدخل ليس تنسيق ASN صالحًا |
| `NoServerFoundError` | لم يُعثر على خادم RDAP لنطاق هذا ASN |
| `RDAPServerError` | السجل أعاد حالة خطأ |

**مثال:**

```typescript
const result = await client.asn(15169);
// أو: await client.asn('AS15169')

console.log(result.name);         // 'GOOGLE'
console.log(result.startAutnum);  // 15169
console.log(result.endAutnum);    // 15169
console.log(result.country);      // 'US'
console.log(result.type);         // 'DIRECT ALLOCATION'
```

---

### `client.nameserver(hostname)`

يستعلم بيانات RDAP لخادم أسماء. يستخدم IANA DNS TLD Bootstrap لاكتشاف الخادم.

**التوقيع:**
```typescript
async nameserver(nameserver: string): Promise<NameserverResponse>
```

**المعاملات:**

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `nameserver` | `string` | اسم المضيف لخادم الأسماء المؤهَّل بالكامل (مثلًا `'ns1.example.com'`) |

**يُعيد:** [`NameserverResponse`](#nameserverresponse)

**يُطلق:**

| الخطأ | الشرط |
|-------|-------|
| `ValidationError` | فشل اسم المضيف في التحقق من التنسيق |
| `NoServerFoundError` | لم يُعثر على خادم RDAP لـ TLD هذا الخادم |
| `RDAPServerError` | السجل أعاد حالة خطأ |

**مثال:**

```typescript
const result = await client.nameserver('ns1.google.com');

console.log(result.ldhName);           // 'ns1.google.com'
console.log(result.ipAddresses?.v4);   // ['216.239.32.10']
console.log(result.ipAddresses?.v6);   // ['2001:4860:4802:32::a']
console.log(result.status);            // ['active']
```

---

### `client.entity(handle, serverUrl)`

يستعلم بيانات RDAP لجهة اتصال أو مسجِّل أو سجل بالمعرّف (handle).
لا يوجد IANA Bootstrap عالمي للكيانات — يجب تحديد URL خادم RDAP صراحةً.

**التوقيع:**
```typescript
async entity(handle: string, serverUrl: string): Promise<EntityResponse>
```

**المعاملات:**

| المعامل | النوع | الوصف |
|---------|-------|-------|
| `handle` | `string` | معرّف الكيان (مثلًا `'ARIN-HN-1'`، `'VRSN-96'`) |
| `serverUrl` | `string` | URL أساسي لخادم RDAP (مثلًا `'https://rdap.arin.net/registry'`) |

**يُعيد:** [`EntityResponse`](#entityresponse)

**يُطلق:**

| الخطأ | الشرط |
|-------|-------|
| `ValidationError` | فشل المعرّف أو serverUrl في التحقق |
| `RDAPServerError` (404) | لا يوجد كيان بهذا المعرّف في الخادم المحدد |
| `SSRFProtectionError` | serverUrl يُحلَّل إلى نطاق IP محجوب |

**مثال:**

```typescript
const result = await client.entity(
  'ARIN-HN-1',
  'https://rdap.arin.net/registry'
);

console.log(result.handle);       // 'ARIN-HN-1'
console.log(result.roles);        // ['registrant']
console.log(result.vcardArray);   // بيانات الاتصال بتنسيق jCard (RFC 7095)
```

---

### `client.checkAvailability(domain)`

يتحقق من توفر اسم نطاق للتسجيل باستخدام RDAP.
يُعيد `available: true` عندما يُعيد السجل HTTP 404.

**التوقيع:**
```typescript
async checkAvailability(domain: string): Promise<AvailabilityResult>
```

**يُعيد:** [`AvailabilityResult`](#availabilityresult)

**مثال:**

```typescript
const result = await client.checkAvailability('available-now.com');

if (result.available) {
  console.log('النطاق متاح!');
} else {
  console.log('ينتهي في:', result.expiresAt);
}
```

---

### `client.streamBatch(requests, options?)`

يبثّ نتائج الاستعلام كمولّد async، يُصدر كل نتيجة بمجرد اكتمالها.
في أي وقت لا يزيد عن `concurrency` طلبًا قيد التنفيذ. مناسب لمجموعات
استعلام كبيرة (1,000+ عنصر) بلا نمو في استخدام الذاكرة.

**التوقيع:**
```typescript
streamBatch<T extends QueryTypeLiteral>(
  requests: BatchQueryRequest<T>[],
  options?: StreamBatchOptions
): AsyncGenerator<BatchQueryResult<T>>
```

**المعاملات:**

| المعامل | النوع | الافتراضي | الوصف |
|---------|-------|----------|-------|
| `requests` | `BatchQueryRequest<T>[]` | — | مصفوفة كائنات استعلام مُكتَّبة |
| `options.concurrency` | `number` | `5` | الحد الأقصى للطلبات الجارية |
| `options.continueOnError` | `boolean` | `true` | إصدار نتائج الأخطاء بدلًا من الإطلاق |

**يُعيد:** `AsyncGenerator<BatchQueryResult<T>>`

كل `BatchQueryResult` مُصدَّر يحتوي على:

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `type` | `QueryTypeLiteral` | نوع الاستعلام |
| `query` | `string` | نص الاستعلام الأصلي |
| `success` | `boolean` | هل نجح الاستعلام |
| `result` | `T \| undefined` | بيانات الاستجابة (عند `success: true`) |
| `error` | `Error \| undefined` | الخطأ (عند `success: false`) |
| `duration` | `number` | مدة الاستعلام بالمللي ثانية |

**مثال:**

```typescript
const requests = [
  { type: 'domain' as const, query: 'example.com' },
  { type: 'ip' as const, query: '8.8.8.8' },
  { type: 'asn' as const, query: 'AS15169' },
];

for await (const result of client.streamBatch(requests, { concurrency: 10 })) {
  if (result.success) {
    console.log(result.query, '→', result.result!.metadata.source);
  } else {
    console.error(result.query, '→', result.error!.message);
  }
}
```

---

### `client.explain(query)`

يشغّل خط أنابيب الاكتشاف لاستعلام معيَّن بلا إجراء طلب RDAP حقيقي.
يُعيد خادم bootstrap والـ URL المبنيّ وحالة الكاش واكتشاف نوع الاستعلام.
مفيد للتصحيح.

**التوقيع:**
```typescript
async explain(query: string): Promise<ExplainResult>
```

**مثال:**

```typescript
const info = await client.explain('example.com');

console.log(info.queryType);       // 'domain'
console.log(info.detectedType);    // 'domain'
console.log(info.bootstrapServer); // 'https://rdap.verisign.com/com/v1'
console.log(info.builtUrl);        // 'https://rdap.verisign.com/com/v1/domain/example.com'
console.log(info.cacheStatus);     // 'miss' | 'hit' | 'disabled'
console.log(info.latencyMs);       // 42
```

---

## 5. الإعداد

### الكاش

يتحكم في تخزين الاستجابات مؤقتًا. الإعداد الافتراضي: LRU في الذاكرة مع TTL ساعة واحدة.

```typescript
cache?: boolean | CacheOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `strategy` | `'memory' \| 'redis' \| 'stale-while-revalidate' \| 'none'` | `'memory'` | الواجهة الخلفية للكاش |
| `ttl` | `number` | `3600` | وقت الحياة بالثواني |
| `maxSize` | `number` | `1000` | الحد الأقصى للإدخالات (كاش الذاكرة) |
| `redisClient` | `RedisClientLike` | — | نسخة ioredis أو node-redis (مطلوب عند `strategy: 'redis'`) |
| `keyPrefix` | `string` | `'rdapify:'` | نطاق مفتاح Redis |
| `revalidateCallback` | `Function` | — | يُستدعى عند اكتمال التحديث في الخلفية (stale-while-revalidate) |

**أمثلة:**

```typescript
// تعطيل الكاش
const client = new RDAPClient({ cache: false });

// كاش Redis
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'myapp:rdap:',
    ttl: 7200,
  },
});

// Stale-while-revalidate
const client = new RDAPClient({
  cache: {
    strategy: 'stale-while-revalidate',
    ttl: 3600,
    revalidateCallback: (key, freshValue) => {
      console.log(`تم تحديث الكاش: ${key}`);
    },
  },
});
```

---

### تحديد المعدل

تحديد المعدل على جانب العميل. مُعطَّل افتراضيًا.

```typescript
rateLimit?: boolean | RateLimitOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `enabled` | `boolean` | `false` | تفعيل تحديد المعدل |
| `maxRequests` | `number` | `100` | الحد الأقصى للطلبات في النافذة الزمنية |
| `windowMs` | `number` | `60_000` | مدة النافذة الزمنية بالمللي ثانية |
| `adapter` | `'memory' \| 'redis'` | `'memory'` | الواجهة الخلفية لمحدد المعدل |
| `redisClient` | `unknown` | — | عميل Redis (مطلوب عند `adapter: 'redis'`) |

**مثال:**

```typescript
const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 50,
    windowMs: 60_000, // 50 طلبًا في الدقيقة
  },
});
```

---

### قاطع الدائرة

قاطع دائرة لكل سجل يمنع عواصف الطلبات إلى خوادم RDAP المتدهورة.
يُحتفظ بقاطع دائرة واحد لكل أصل سجل. مُفعَّل افتراضيًا.

```typescript
circuitBreaker?: {
  failureThreshold?: number;
  successThreshold?: number;
  halfOpenTimeout?: number;
  window?: number;
} | false
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `failureThreshold` | `number` | `5` | الإخفاقات المتتالية ضمن `window` التي تُفتح الدائرة |
| `successThreshold` | `number` | `1` | النجاحات المتتالية في نصف-المفتوح التي تُغلق الدائرة |
| `halfOpenTimeout` | `number` | `30_000` | مللي ثانية في الحالة المفتوحة قبل السماح بطلب اختبار |
| `window` | `number` | `60_000` | نافذة الإخفاقات المتحركة بالمللي ثانية |

**الحالات:**

| الحالة | الوصف |
|--------|-------|
| `closed` | عملية عادية؛ تُحسب الإخفاقات |
| `open` | تُرفض جميع الطلبات فورًا بـ `CircuitOpenError` |
| `half-open` | يُسمح بطلب اختبار واحد؛ يُغلق عند النجاح، يُعاد فتحه عند الإخفاق |

**مثال:**

```typescript
// حدود مخصصة
const client = new RDAPClient({
  circuitBreaker: {
    failureThreshold: 10,
    halfOpenTimeout: 60_000,
  },
});

// تعطيل
const client = new RDAPClient({ circuitBreaker: false });

// قراءة الحالة لكل سجل
const stats = client.getCircuitBreakerStats();
// { 'https://rdap.verisign.com': { state: 'closed' }, ... }
```

---

### القياس (OpenTelemetry)

يُصدِّر سباني استعلامات RDAP إلى أي نقطة نهاية OTLP/HTTP باستخدام `fetch` الويب القياسي.
لا يتطلب `@opentelemetry/sdk-node`. تُبتلع الأخطاء بصمت ولا تؤثر أبدًا على نتائج الاستعلام.

```typescript
telemetry?: TelemetryOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `endpoint` | `string` | — | URL نقطة نهاية OTLP/HTTP (مثلًا `'http://localhost:4318/v1/traces'`) |
| `serviceName` | `string` | `'rdapify'` | اسم الخدمة في السبانات |
| `serviceVersion` | `string` | الإصدار الحالي | إصدار الخدمة في السبانات |
| `enabled` | `boolean` | `true` عند تعيين endpoint | تفعيل/تعطيل التصدير |
| `resourceAttributes` | `Record<string, string>` | `{}` | سمات موارد السبان الإضافية |

**مثال:**

```typescript
const client = new RDAPClient({
  telemetry: {
    endpoint: 'http://localhost:4318/v1/traces',
    serviceName: 'my-api',
    resourceAttributes: { 'deployment.environment': 'production' },
  },
});
```

---

### التسجيل

```typescript
logging?: LoggingOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `level` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` | `'warn'` | الحد الأدنى لمستوى السجل |
| `logger` | `Function` | مدمج | معالج سجل مخصص `(level, message, meta?) => void` |

```typescript
const client = new RDAPClient({
  logging: {
    level: 'info',
    logger: (level, message, meta) => {
      myLogger[level](message, meta);
    },
  },
});
```

تفعيل مخرجات تصحيح مفصَّلة:

```typescript
const client = new RDAPClient({
  debug: {
    enabled: true,
    logger: {
      debug: (msg, meta) => console.debug('[RDAP]', msg, meta),
      info:  (msg, meta) => console.info('[RDAP]', msg, meta),
      warn:  (msg, meta) => console.warn('[RDAP]', msg, meta),
      error: (msg, meta) => console.error('[RDAP]', msg, meta),
    },
  },
});
```

---

### حماية SSRF

تحجب الطلبات إلى نطاقات IP الخاصة والـ loopback والـ link-local. مُفعَّلة دائمًا
افتراضيًا. لا يمكن تعطيلها في بيئات الإنتاج (v1.0.0+).

```typescript
ssrfProtection?: boolean | SSRFProtectionOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `enabled` | `boolean` | `true` | تفعيل حماية SSRF |
| `blockPrivateIPs` | `boolean` | `true` | حجب نطاقات RFC 1918 (10.x، 172.16.x، 192.168.x) |
| `blockLocalhost` | `boolean` | `true` | حجب 127.x و ::1 |
| `blockLinkLocal` | `boolean` | `true` | حجب 169.254.x و fe80::/10 |
| `blockedDomains` | `string[]` | `[]` | أنماط نطاقات إضافية للحجب |
| `allowedDomains` | `string[]` | `[]` | قائمة بيضاء للنطاقات (تتجاوز قواعد الحجب) |
| `dnsRebinding` | `boolean` | `false` | حلّ أسماء النطاقات والتحقق من جميع عناوين IP المُعادة |

---

### إعادة المحاولة

```typescript
retry?: boolean | RetryOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `maxAttempts` | `number` | `3` | الحد الأقصى للمحاولات الكلية (1 = بلا إعادة محاولة) |
| `initialDelay` | `number` | `1000` | التأخير الأولي بالمللي ثانية |
| `maxDelay` | `number` | `10_000` | الحد الأقصى للتأخير بالمللي ثانية |
| `backoff` | `'exponential' \| 'linear' \| 'fixed'` | `'exponential'` | استراتيجية التراجع |
| `retryableStatusCodes` | `number[]` | `[408, 429, 500, 502, 503, 504]` | رموز HTTP التي تُطلق إعادة المحاولة |

`ValidationError` لا يُعاد محاولته بغض النظر عن الإعداد.

---

### المُهل الزمنية

مرّر عددًا واحدًا لمُهلة الطلب، أو كائنًا للتحكم الدقيق.

```typescript
timeout?: number | TimeoutOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `connect` | `number` | `5000` | مُهلة اتصال TCP (ms) |
| `request` | `number` | `10_000` | المُهلة الكلية للطلب (ms) |
| `dns` | `number` | `3000` | مُهلة دقّ DNS (ms) |

```typescript
// بسيط: مُهلة طلب 15 ثانية
const client = new RDAPClient({ timeout: 15_000 });

// تحكم دقيق
const client = new RDAPClient({
  timeout: { connect: 3000, request: 20_000, dns: 2000 },
});
```

---

### الوسيط

سجّل خطافات دورة الحياة عند الإنشاء أو بعده عبر `client.use()`.

```typescript
middleware?: MiddlewareOptions
```

راجع [§8 نظام الوسيط](#8-نظام-الوسيط) لتوقيعات الخطافات والأمثلة.

---

### مجموعة الاتصالات

غير قابل للإعداد مباشرةً عبر `RDAPClientOptions`. تستخدم المجموعة الافتراضية:
- `maxConnections: 10`
- `keepAlive: true`

الوصول إلى إحصاءات المجموعة:

```typescript
const stats = client.getConnectionPoolStats();
```

---

### Bootstrap

يتحكم في اكتشاف خادم IANA Bootstrap.

```typescript
bootstrap?: BootstrapOptions
```

| الخيار | النوع | الافتراضي | الوصف |
|--------|-------|----------|-------|
| `customServers` | `{ tld: string; url: string }[]` | `[]` | خوادم مخصصة لكل TLD (تُستشار قبل IANA) |
| `ttl` | `number` | `86400` | TTL كاش Bootstrap بالثواني (24 ساعة) |
| `fallback` | `boolean` | `true` | الرجوع إلى IANA عند عدم تعريف خادم مخصص |
| `regions` | `Array<'us' \| 'eu' \| 'ap'>` | — | ترتيب تفضيل مرايا Bootstrap الإقليمية |

```typescript
const client = new RDAPClient({
  bootstrap: {
    customServers: [
      { tld: 'com', url: 'https://rdap.verisign.com/com/v1' },
      { tld: 'net', url: 'https://rdap.verisign.com/net/v1' },
    ],
    ttl: 43_200,  // 12 ساعة
    regions: ['eu', 'us'],
  },
});
```

---

## 6. معالجة الأخطاء

جميع أخطاء rdapify تمتد من `RDAPifyError`. كل خطأ يُعرِّض نصًا `code`
ورمز `statusCode` اختياريًا وكائن `context` مع تفاصيل الاستعلام ونصًا
`suggestion` للرسائل التي تواجه المستخدم.

### أنواع الأخطاء

| الكلاس | الكود | HTTP Status | الوصف |
|--------|-------|-------------|-------|
| `ValidationError` | `VALIDATION_ERROR` | 400 | مدخل غير صالح (تنسيق نطاق، IP، ASN) |
| `NetworkError` | `NETWORK_ERROR` | 500 | فشل الاتصال (لم تُستلم استجابة) |
| `TimeoutError` | `TIMEOUT_ERROR` | 408 | تجاوز الطلب المُهلة المُعدَّة |
| `RDAPServerError` | `RDAP_SERVER_ERROR` | متنوع | الخادم أعاد حالة HTTP خطأ |
| `NoServerFoundError` | `NO_SERVER_FOUND` | 404 | لم يُكتشف خادم RDAP للمدخل |
| `ParseError` | `PARSE_ERROR` | 500 | فشل تحليل استجابة خادم RDAP |
| `CacheError` | `CACHE_ERROR` | 500 | فشل عملية قراءة/كتابة الكاش |
| `RateLimitError` | `RATE_LIMIT_ERROR` | 429 | تجاوز تحديد المعدل على جانب العميل |
| `SSRFProtectionError` | `SSRF_PROTECTION_ERROR` | 403 | حماية SSRF حجبت الطلب |
| `SearchNotSupportedError` | `SEARCH_NOT_SUPPORTED` | 404 | الخادم لا يدعم بحث RDAP |
| `QueryAbortedError` | `QUERY_ABORTED` | — | أوقف الاستعلامَ خطافُ وسيط `beforeQuery` |
| `CircuitOpenError` | — | — | قاطع الدائرة مفتوح لهذا السجل |

### خصائص `RDAPifyError` الأساسية

```typescript
class RDAPifyError extends Error {
  code: string;           // كود خطأ قابل للقراءة آليًا
  statusCode?: number;    // رمز HTTP Status (عند الانطباق)
  context?: Record<string, any>; // تفاصيل الاستعلام
  timestamp: number;      // Unix ms عند وقوع الخطأ
  suggestion?: string;    // اقتراح للمستخدم
  queryType?: string;     // من context
  queryValue?: string;    // من context
  serverUrl?: string;     // من context

  toJSON(): Record<string, any>;
  getUserMessage(): string;
  getDetailedMessage(): string;
}
```

### معالجة الأخطاء

```typescript
import {
  RDAPClient,
  ValidationError,
  RDAPServerError,
  NetworkError,
  TimeoutError,
  NoServerFoundError,
  SSRFProtectionError,
  RateLimitError,
  isRDAPifyError,
  isNetworkError,
} from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    // مدخل خاطئ — لا تُعد المحاولة
    console.error('مدخل غير صالح:', error.message);
    console.error('اقتراح:', error.suggestion);

  } else if (error instanceof RDAPServerError) {
    if (error.statusCode === 404) {
      console.log('النطاق غير موجود (قد يكون متاحًا)');
    } else if (error.statusCode === 429) {
      console.warn('تجاوز حد معدل السجل، التراجع...');
    } else {
      console.error(`خطأ السجل ${error.statusCode}:`, error.message);
    }

  } else if (error instanceof TimeoutError) {
    console.warn('انتهت مُهلة الطلب. زد المُهلة أو أعد المحاولة لاحقًا.');

  } else if (error instanceof NetworkError) {
    console.error('الشبكة غير متاحة:', error.message);

  } else if (error instanceof NoServerFoundError) {
    console.error('لا خادم RDAP لهذا TLD:', error.context);

  } else if (error instanceof SSRFProtectionError) {
    console.error('SSRF محجوب — URL خادم مشبوه');

  } else if (error instanceof RateLimitError) {
    const wait = error.retryAfter ?? 1000;
    console.warn(`تحديد المعدل. أعد المحاولة بعد ${wait}ms`);

  } else if (isRDAPifyError(error)) {
    // اصطياد شامل لأي خطأ rdapify
    console.error(`[${error.code}] ${error.message}`);

  } else {
    throw error; // خطأ غير معروف — أعد الإطلاق
  }
}
```

### حارسات الأنواع

```typescript
import {
  isRDAPifyError,
  isSSRFProtectionError,
  isNetworkError,
  isTimeoutError,
  isRateLimitError,
} from 'rdapify';

isRDAPifyError(error)         // error instanceof RDAPifyError
isSSRFProtectionError(error)  // error instanceof SSRFProtectionError
isNetworkError(error)         // error instanceof NetworkError
isTimeoutError(error)         // error instanceof TimeoutError
isRateLimitError(error)       // error instanceof RateLimitError
```

---

## 7. المقاييس والمراقبة

### محصّل المقاييس

`MetricsCollector` نشط تلقائيًا داخل كل `RDAPClient`. يُخزِّن ما يصل إلى
10,000 مقياس استعلام في الذاكرة (قابل للإعداد). الوصول إلى الملخص:

```typescript
const metrics = client.getMetrics();        // طوال الوقت
const recent  = client.getMetrics(Date.now() - 60_000); // آخر 60 ثانية
```

**حقول `MetricsSummary`:**

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `total` | `number` | إجمالي الاستعلامات المنفَّذة |
| `successful` | `number` | الاستعلامات الناجحة |
| `failed` | `number` | الاستعلامات الفاشلة |
| `successRate` | `number` | معدل النجاح [0, 1] |
| `avgResponseTime` | `number` | متوسط المدة (ms) |
| `minResponseTime` | `number` | أدنى مدة (ms) |
| `maxResponseTime` | `number` | أقصى مدة (ms) |
| `p50ResponseTime` | `number` | الوسيط (ms) |
| `p90ResponseTime` | `number` | P90 للمدة (ms) |
| `p99ResponseTime` | `number` | P99 للمدة (ms) |
| `cacheHitRate` | `number` | معدل إصابة الكاش [0, 1] |
| `queriesByType` | `{ domain, ip, asn }` | الأعداد حسب نوع الاستعلام |
| `errorsByType` | `Record<string, number>` | أعداد الأخطاء حسب كود الخطأ |

---

### مُصدِّر Prometheus

يُحوِّل `PrometheusExporter` بيانات `MetricsSummary` إلى تنسيق نصي Prometheus
(الإصدار 0.0.4).

```typescript
import { PrometheusExporter } from 'rdapify';

const exporter = new PrometheusExporter(
  client.getMetrics.bind(client),
  {
    prefix: 'rdapify',                        // بادئة اسم المقياس
    labels: { instance: 'api-server-1' },    // تسميات ثابتة
  }
);

// في معالج HTTP للمقاييس:
res.setHeader('Content-Type', PrometheusExporter.CONTENT_TYPE);
res.end(exporter.export());
```

**المقاييس المُصدَّرة** (مسبوقة بـ `rdapify_` افتراضيًا):

| المقياس | النوع | الوصف |
|---------|-------|-------|
| `queries_total` | gauge | إجمالي الاستعلامات |
| `queries_successful` | gauge | الاستعلامات الناجحة |
| `queries_failed` | gauge | الاستعلامات الفاشلة |
| `success_rate` | gauge | معدل النجاح [0, 1] |
| `response_time_avg_ms` | gauge | متوسط وقت الاستجابة |
| `response_time_p50_ms` | gauge | P50 لوقت الاستجابة |
| `response_time_p90_ms` | gauge | P90 لوقت الاستجابة |
| `response_time_p99_ms` | gauge | P99 لوقت الاستجابة |
| `cache_hit_rate` | gauge | معدل إصابة الكاش [0, 1] |
| `queries_by_type` | gauge (مع تسمية `type`) | الاستعلامات مقسَّمة حسب النوع |

**تكامل Express / Fastify / Node.js http:**

```typescript
import http from 'node:http';

http.createServer((req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': PrometheusExporter.CONTENT_TYPE });
    res.end(exporter.export());
  }
}).listen(9090);
```

---

### سباني OpenTelemetry

يُرسل `TelemetryExporter` سباني استعلامات RDAP إلى أي نقطة نهاية OTLP/HTTP JSON.

```typescript
// الإعداد عند إنشاء العميل:
const client = new RDAPClient({
  telemetry: {
    endpoint: 'http://localhost:4318/v1/traces',
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
  },
});
```

كل استعلام RDAP يُنتج سبانًا واحدًا مع سمات:
- `rdap.query.type` — `domain`، `ip`، `asn`، `nameserver`، `entity`
- `rdap.query.value` — نص الاستعلام الخام
- `rdap.server.url` — URL خادم RDAP المستخدَم
- `rdap.cache.hit` — `true` / `false`
- `http.status_code` — رمز استجابة HTTP

الواجهات الخلفية المتوافقة: Jaeger، Grafana Tempo، Honeycomb، أي نقطة نهاية OTLP/HTTP.

---

### `client.getCircuitBreakerStats()`

يُعيد الحالة الحالية لكل سجل RDAP تم الاتصال به.
متاح فقط عند استخدام Node.js `Fetcher` (ليس Cloudflare Workers / Deno / Bun).

```typescript
const stats = client.getCircuitBreakerStats();
// {
//   'https://rdap.verisign.com': { state: 'closed' },
//   'https://rdap.arin.net':     { state: 'open' },
//   'https://rdap.ripe.net':     { state: 'half-open' },
// }

for (const [host, { state }] of Object.entries(stats)) {
  if (state !== 'closed') {
    console.warn(`السجل ${host} في الحالة ${state}`);
  }
}
```

---

### لوحة Grafana

استيراد JSON لوحة Grafana المدمجة:

```typescript
import { RDAPIFY_GRAFANA_DASHBOARD } from 'rdapify';

// استخدم مع Grafana API أو الصقه في واجهة Grafana ← Import Dashboard
console.log(RDAPIFY_GRAFANA_DASHBOARD);
```

اللوحات المضمَّنة: إجمالي الاستعلامات، معدل النجاح، معدل إصابة الكاش، متوسط وقت الاستجابة،
P50/P90/P99 للتأخير، الاستعلامات حسب النوع، تفصيل الأخطاء.

---

## 8. نظام الوسيط

يوفر نظام الوسيط خطافات دورة حياة تعمل حول كل استعلام RDAP.
أخطاء الخطافات تُبتلع بصمت — الخطاف الفاشل لا يُعطّل خط أنابيب الاستعلام.

### الخطافات

```typescript
interface MiddlewareOptions {
  beforeQuery?:  (ctx: QueryContext)             => Promise<void> | void;
  afterQuery?:   (ctx: QueryResultContext)       => Promise<void> | void;
  onError?:      (ctx: QueryResultContext)       => Promise<void> | void;
  onCacheHit?:   (ctx: QueryContext)             => Promise<void> | void;
  onCacheMiss?:  (ctx: QueryContext)             => Promise<void> | void;
  onRetry?:      (ctx: QueryContext & { attempt: number; delay: number }) => Promise<void> | void;
}
```

### `QueryContext`

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `queryType` | `'domain' \| 'ip' \| 'asn' \| 'nameserver' \| 'entity'` | نوع الاستعلام |
| `query` | `string` | نص الاستعلام الأصلي |
| `normalized` | `string` | الاستعلام المُعيَّر (أحرف صغيرة، مُنظَّف) |
| `startTime` | `number` | Unix ms عند بدء الاستعلام |
| `cached` | `boolean \| undefined` | حالة الكاش (تُعيَّن بعد البحث) |
| `serverUrl` | `string \| undefined` | URL خادم RDAP المكتشَف |
| `attempt` | `number \| undefined` | رقم المحاولة الحالية |
| `abort` | `() => void` | استدعِه لإلغاء الاستعلام (في `beforeQuery` فقط) |

### `QueryResultContext`

يمتد `QueryContext` بـ:

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `duration` | `number` | المدة الكلية للاستعلام بالمللي ثانية |
| `result` | `RDAPResponse \| undefined` | الاستجابة (عند النجاح) |
| `error` | `Error \| undefined` | الخطأ (عند الإخفاق) |
| `fromCache` | `boolean` | هل جاءت النتيجة من الكاش |

### التسجيل

**عند الإنشاء:**
```typescript
const client = new RDAPClient({
  middleware: {
    beforeQuery: (ctx) => console.log('→', ctx.queryType, ctx.query),
    afterQuery:  (ctx) => console.log('←', ctx.duration, 'ms'),
  },
});
```

**بعد الإنشاء (قابل للتسلسل):**
```typescript
client
  .use({ beforeQuery: (ctx) => console.log('→', ctx.query) })
  .use({ afterQuery:  (ctx) => console.log('←', ctx.duration, 'ms') })
  .use({ onError:     (ctx) => metrics.increment('rdap.error') });
```

**مع أولوية** (الرقم الأصغر = يعمل أولًا):
```typescript
const manager = client.getMiddlewareManager();

manager.use({ beforeQuery: authHook }, 1);   // يعمل أولًا
manager.use({ beforeQuery: loggingHook }, 2); // يعمل ثانيًا
```

### حالات الاستخدام

**تسجيل الطلبات:**
```typescript
client.use({
  beforeQuery: (ctx) => {
    logger.info(`بدء استعلام RDAP`, { type: ctx.queryType, query: ctx.query });
  },
  afterQuery: (ctx) => {
    logger.info(`اكتمل استعلام RDAP`, {
      type: ctx.queryType,
      duration: ctx.duration,
      cached: ctx.fromCache,
    });
  },
  onError: (ctx) => {
    logger.error(`فشل استعلام RDAP`, {
      type: ctx.queryType,
      error: ctx.error?.message,
    });
  },
});
```

**تفويض الاستعلام (حجب الاستعلامات):**
```typescript
client.use({
  beforeQuery: (ctx) => {
    if (!isAllowed(ctx.query)) {
      ctx.abort(); // يُطلق QueryAbortedError للمستدعي
    }
  },
});
```

**قياس المقاييس:**
```typescript
client.use({
  afterQuery: (ctx) => {
    prometheus.histogram('rdap_query_duration_ms', ctx.duration, {
      type: ctx.queryType,
      cached: String(ctx.fromCache),
    });
  },
  onCacheHit: (ctx) => {
    prometheus.counter('rdap_cache_hits_total').inc({ type: ctx.queryType });
  },
});
```

---

## 9. تكامل إضافة Pro

تُوسِّع `@rdapify/pro` العميل `RDAPClient` بالمراقبة الجماعية واكتشاف التغييرات
والتحليلات وتسليم الـ webhook وتصدير البيانات. تتطلب مفتاح ترخيص صالح.

### التثبيت

```bash
npm install rdapify @rdapify/pro
```

### الإعداد

```typescript
import { RDAPClient } from 'rdapify';
import { ProPlugin } from '@rdapify/pro';

const client = new RDAPClient();

const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  gracePeriodDays: 30,       // فترة السماح دون اتصال (افتراضي: 30)
  onlineValidation: false,   // اضبط true لإجبار الاتصال في كل استدعاء
  expiryThresholds: [30, 14, 7], // أيام قبل الانتهاء للتنبيه
});

plugin.install(client);
```

بعد `plugin.install(client)`، يكتسب العميل:

| الخاصية | النوع | الوصف |
|---------|-------|-------|
| `client.monitor(targets, opts)` | `BulkMonitor` | يستطلع النطاقات/IPs على فترة |
| `client.detect(targets)` | `ChangeDetector` | يُقارن لقطات RDAP |
| `client.report()` | `Reporter` | يولّد تقارير ملخصة/مفصَّلة/اتجاهات |
| `client.history` | `HistoryTracker` | يُخزِّن لقطات RDAP في الذاكرة |
| `client.webhooks` | `WebhookManager` | يُرسل إشعارات Slack/Discord/Teams/HTTP |
| `client.export` | `Exporter` | يُصدِّر البيانات بتنسيق JSON/CSV/XLSX |
| `client.portfolio` | `PortfolioManager` | مجموعات نطاقات مُسمَّاة مع webhooks لكل مجموعة |
| `client.expiryChecker` | `ExpiryChecker` | تنبيهات انتهاء الصلاحية القائمة على العتبات |

### المراقبة الجماعية

```typescript
const monitor = client.monitor(['example.com', 'google.com'], {
  interval: '1h',     // '30m' | '1h' | '6h' | '24h'
  concurrency: 5,
});

monitor.onChange((changes) => {
  for (const change of changes) {
    console.log(change.target, change.type, change.before, change.after);
  }
});

monitor.start();

// إيقاف المراقبة
monitor.stop();
```

### اكتشاف التغييرات

```typescript
const before = await client.domain('example.com');
// ... مرور وقت ...
const after  = await client.domain('example.com');

const detector = client.detect(['example.com']);
const changes  = detector.diff(before, after);

// أنواع التغييرات المكتشَفة:
// 'nameserver_changed', 'status_changed', 'registrar_changed',
// 'expiry_changed', 'dnssec_changed'
```

### إشعارات Webhook

```typescript
client.webhooks.register({
  type: 'slack',
  url: process.env.SLACK_WEBHOOK_URL,
});

client.webhooks.register({
  type: 'discord',
  url: process.env.DISCORD_WEBHOOK_URL,
});

// إشعار عند اكتشاف تغييرات
client.webhooks.notify(changes);
```

### معلومات الترخيص

```typescript
console.log(plugin.license.valid);           // true
console.log(plugin.license.plan);            // 'pro' | 'team' | 'enterprise'
console.log(plugin.license.organization);    // 'Acme Corp'
console.log(plugin.license.activationCached); // true (من الكاش المحلي)
console.log(new Date(plugin.license.graceExpiresAt)); // موعد انتهاء كاش الوضع غير المتصل
```

---

## 10. الأنواع والواجهات

### `DomainResponse`

```typescript
interface DomainResponse {
  query: string;
  objectClass: 'domain';
  handle?: string;
  ldhName?: string;          // اسم المضيف ASCII/Punycode
  unicodeName?: string;      // اسم المضيف Unicode (IDN)
  status?: RDAPStatus[];
  nameservers?: string[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>; // امتدادات RDAP غير القياسية
  raw?: any;                 // الاستجابة الخام من الخادم (عند includeRaw: true)
  metadata: {
    source: string;          // URL خادم RDAP المستخدَم
    timestamp: string;       // طابع زمني ISO 8601 للاستجابة
    cached: boolean;         // true إذا جاءت من الكاش
  };
}
```

### `IPResponse`

```typescript
interface IPResponse {
  query: string;
  objectClass: 'ip network';
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  ipVersion?: 'v4' | 'v6';
  name?: string;
  type?: string;
  country?: string;
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `ASNResponse`

```typescript
interface ASNResponse {
  query: string;
  objectClass: 'autnum';
  handle?: string;
  startAutnum?: number;
  endAutnum?: number;
  name?: string;
  type?: string;
  country?: string;
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `NameserverResponse`

```typescript
interface NameserverResponse {
  query: string;
  objectClass: 'nameserver';
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  status?: RDAPStatus[];
  ipAddresses?: {
    v4?: string[];
    v6?: string[];
  };
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `EntityResponse`

```typescript
interface EntityResponse {
  query: string;
  objectClass: 'entity';
  handle?: string;
  vcardArray?: any[];        // تنسيق jCard (RFC 7095)
  roles?: RoleType[];
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `RDAPEntity`

```typescript
interface RDAPEntity {
  handle?: string;
  roles?: RoleType[];
  vcardArray?: any[];
  publicIds?: Array<{ type: string; identifier: string }>;
  entities?: RDAPEntity[];
  remarks?: RDAPRemark[];
  links?: RDAPLink[];
  events?: RDAPEvent[];
  status?: RDAPStatus[];
}
```

### `RDAPEvent`

```typescript
interface RDAPEvent {
  type: EventType;  // 'registration' | 'expiration' | 'last changed' | ...
  date: string;     // نص تاريخ ISO 8601
  actor?: string;
}
```

### `RDAPLink`

```typescript
interface RDAPLink {
  href: string;
  rel?: string;
  type?: string;
  title?: string;
  value?: string;
  hreflang?: string[];
  media?: string;
}
```

### `AvailabilityResult`

```typescript
interface AvailabilityResult {
  domain: string;
  available: boolean;
  expiresAt?: Date; // موجود عند available: false
}
```

### `ExplainResult`

```typescript
interface ExplainResult {
  query: string;
  queryType: 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
  detectedType: string;
  bootstrapServer: string | null;
  builtUrl: string | null;
  cacheStatus: 'hit' | 'miss' | 'disabled';
  latencyMs: number;
  error?: string;
}
```

### أنواع التعداد

```typescript
type RDAPStatus =
  | 'validated' | 'renew prohibited' | 'update prohibited'
  | 'transfer prohibited' | 'delete prohibited' | 'proxy' | 'private'
  | 'removed' | 'obscured' | 'associated' | 'active' | 'inactive'
  | 'locked' | 'pending create' | 'pending renew' | 'pending transfer'
  | 'pending update' | 'pending delete';

type EventType =
  | 'registration' | 'reregistration' | 'last changed' | 'expiration'
  | 'deletion' | 'reinstantiation' | 'transfer' | 'locked' | 'unlocked';

type RoleType =
  | 'registrant' | 'technical' | 'administrative' | 'abuse'
  | 'billing' | 'registrar' | 'reseller' | 'sponsor' | 'proxy'
  | 'notifications' | 'noc';

type CacheStrategy = 'memory' | 'redis' | 'stale-while-revalidate' | 'none';
type BackoffStrategy = 'linear' | 'exponential' | 'fixed';
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
type QueryType = 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
```

### أدوات التحقق

```typescript
import {
  validateDomain,    // يُطلق ValidationError إذا كان غير صالح
  validateIP,        // يُطلق ValidationError؛ يُعيد 'v4' | 'v6'
  validateIPv4,
  validateIPv6,
  validateASN,       // يُطلق ValidationError؛ يُعيد ASN رقميًا
  validateNameserver,
  validateEntityHandle,
  normalizeDomain,   // 'EXAMPLE.COM' → 'example.com'
  normalizeIP,
  normalizeASN,
  normalizeNameserver,
  normalizeEntityHandle,
  isPrivateIP,       // يُعيد boolean
  isLocalhost,
  isLinkLocal,
} from 'rdapify';
```

### `ICachePort` (تنفيذات كاش مخصصة)

```typescript
import type { ICachePort } from 'rdapify';

class MyCache implements ICachePort {
  async get(key: string): Promise<any | null> { ... }
  async set(key: string, value: any, ttl?: number): Promise<void> { ... }
  async delete(key: string): Promise<void> { ... }
  async clear(): Promise<void> { ... }
  async has(key: string): Promise<boolean> { ... }
  async size(): Promise<number> { ... }
}
```

---

## 11. متغيرات البيئة

### `rdapify` (النواة مفتوحة المصدر)

| المتغير | مستخدَم من قِبَل | الوصف |
|---------|-----------------|-------|
| `HOME` | `UsageTelemetry` | المجلد الأساسي لإعداد القياس (`~/.rdapify/telemetry.json`) |
| `USERPROFILE` | `UsageTelemetry` | بديل Windows لـ `HOME` |

### `@rdapify/pro`

| المتغير | مستخدَم من قِبَل | الوصف |
|---------|-----------------|-------|
| `RDAPIFY_LICENSE_KEY` | `ProPlugin` | مفتاح الترخيص — احمله دائمًا من البيئة، لا تُضمِّنه |
| `HOME` | `LicenseValidator` | مجلد كاش التفعيل (`~/.rdapify/activation/`) |
| `USERPROFILE` | `LicenseValidator` | بديل Windows لـ `HOME` |

### البنية التحتية (Cloudflare Workers — لا تستهلكها مكتبة العميل)

| المتغير | مستخدَم من قِبَل | الوصف |
|---------|-----------------|-------|
| `LICENSE_SECRET` | License API Worker | مفتاح AES-256-GCM لتشفير حمولة الترخيص |
| `ACTIVATION_HMAC_SECRET` | License API Worker | مفتاح HMAC لتوقيع رمز التفعيل |
| `PADDLE_WEBHOOK_SECRET` | License API Worker | التحقق من توقيع Paddle webhook |
| `RESEND_API_KEY` | تسليم الترخيص | تسليم البريد الإلكتروني لمفتاح الترخيص بعد الشراء |

> هذه المتغيرات أسرار Cloudflare Worker. لا تُعيَّن في تطبيقات العميل
> وهي موثَّقة هنا للمشغّلين المديرين لـ license API.

---

## 12. أمثلة متقدمة

### استعلامات جماعية للنطاقات مع عزل الأخطاء

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  rateLimit: { enabled: true, maxRequests: 20, windowMs: 1000 },
  cache: { strategy: 'memory', ttl: 3600 },
});

const domains = ['google.com', 'github.com', 'example.com', /* ... */];
const requests = domains.map(d => ({ type: 'domain' as const, query: d }));

const results: Record<string, any> = {};
const errors:  Record<string, string> = {};

for await (const item of client.streamBatch(requests, { concurrency: 5 })) {
  if (item.success) {
    results[item.query] = item.result;
  } else {
    errors[item.query] = item.error!.message;
  }
}

console.log(`نجاح: ${Object.keys(results).length}`);
console.log(`أخطاء: ${Object.keys(errors).length}`);
```

---

### مراقبة النطاقات مع تنبيهات التغيير (Pro)

```typescript
import { RDAPClient } from 'rdapify';
import { ProPlugin } from '@rdapify/pro';

const client = new RDAPClient();
const plugin  = await ProPlugin({ licenseKey: process.env.RDAPIFY_LICENSE_KEY });
plugin.install(client);

client.webhooks.register({
  type: 'slack',
  url: process.env.SLACK_WEBHOOK_URL,
});

const monitor = client.monitor(
  ['example.com', 'competitor.com', 'yourdomain.com'],
  { interval: '6h', concurrency: 3 }
);

monitor.onChange((changes) => {
  console.log(`تم اكتشاف ${changes.length} تغيير(ات)`);
  client.webhooks.notify(changes);
  for (const c of changes) {
    client.history.record(c.target, c.queryType, JSON.stringify(c.after));
  }
});

monitor.start();
console.log('بدأت المراقبة. اضغط Ctrl+C للإيقاف.');
```

---

### كاش + تحديد المعدل لـ API عالية الحركة

```typescript
import { createClient } from 'redis';
import { RDAPClient } from 'rdapify';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'rdap:prod:',
    ttl: 7200,   // كاش 2 ساعة؛ بيانات RDAP تتغير نادرًا
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60_000,
    adapter: 'redis',
    redisClient: redis,
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 500,
  },
  timeout: { request: 15_000, connect: 5_000 },
});

// تدفئة النطاقات الأكثر استعلامًا عند البدء
const domains = ['google.com', 'cloudflare.com', 'amazon.com'];
await Promise.allSettled(domains.map(d => client.domain(d)));
console.log('اكتملت تدفئة الكاش');
```

---

### استخدام قاطع الدائرة في الإنتاج

```typescript
import { RDAPClient, CircuitOpenError } from 'rdapify';

const client = new RDAPClient({
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenTimeout: 60_000,  // 60 ثانية قبل إعادة محاولة سجل مفتوح
    window: 120_000,           // عدّ الإخفاقات على نافذة دقيقتين
  },
});

async function queryWithFallback(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // السجل غير متاح — أعِد استجابة مؤقتة/مُتدهورة
      console.warn(`الدائرة مفتوحة لـ ${domain}، إعادة بيانات قديمة`);
      return getStaleData(domain);
    }
    throw error;
  }
}

// نقطة نهاية فحص الصحة
app.get('/health', (req, res) => {
  const stats = client.getCircuitBreakerStats();
  const degraded = Object.entries(stats)
    .filter(([, s]) => s.state !== 'closed')
    .map(([host]) => host);

  res.json({
    status: degraded.length > 0 ? 'degraded' : 'ok',
    circuits: stats,
  });
});
```

---

### الإعداد للإنتاج

```typescript
import { RDAPClient, PrometheusExporter } from 'rdapify';
import { createClient } from 'redis';
import express from 'express';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: `rdap:${process.env.NODE_ENV}:`,
    ttl: Number(process.env.RDAP_CACHE_TTL ?? 3600),
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10_000,
  },
  rateLimit: {
    enabled: true,
    maxRequests: 200,
    windowMs: 60_000,
    adapter: 'redis',
    redisClient: redis,
  },
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenTimeout: 30_000,
  },
  telemetry: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: process.env.SERVICE_NAME ?? 'rdap-service',
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV ?? 'production',
    },
  },
  timeout: { request: 15_000, connect: 5_000, dns: 3_000 },
  logging: { level: 'warn' },
  deduplication: { windowMs: 100 },
  bootstrap: {
    ttl: 86_400,
    regions: ['eu', 'us'],  // تفضيل مرآة bootstrap الأوروبية
  },
});

// تسجيل الطلبات منظَّم
client.use({
  afterQuery: (ctx) => {
    if (process.env.LOG_RDAP_QUERIES === 'true') {
      console.info(JSON.stringify({
        level: 'info',
        event: 'rdap.query',
        type: ctx.queryType,
        duration: ctx.duration,
        cached: ctx.fromCache,
      }));
    }
  },
  onError: (ctx) => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'rdap.error',
      type: ctx.queryType,
      error: ctx.error?.message,
    }));
  },
});

// نقطة نهاية مقاييس Prometheus
const exporter = new PrometheusExporter(
  client.getMetrics.bind(client),
  { labels: { service: 'rdap', env: process.env.NODE_ENV ?? 'production' } }
);

const app = express();

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', PrometheusExporter.CONTENT_TYPE);
  res.send(exporter.export());
});

app.get('/health', (_req, res) => {
  const circuits = client.getCircuitBreakerStats();
  const degraded = Object.values(circuits).filter(c => c.state !== 'closed');
  res.status(degraded.length > 0 ? 503 : 200).json({
    status: degraded.length > 0 ? 'degraded' : 'ok',
    circuits,
    metrics: client.getMetrics(),
  });
});

app.get('/rdap/domain/:name', async (req, res) => {
  try {
    const result = await client.domain(req.params.name);
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      error: error.code ?? 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});
```

---

> آخر تحديث: 2026-03-25
> للتغييرات الجذرية بين 0.x و 1.0.0، راجع [MIGRATION_GUIDE.ar.md](../MIGRATION_GUIDE.ar.md).
> أبلغ عن المشاكل في [github.com/rdapify/RDAPify/issues](https://github.com/rdapify/RDAPify/issues).
