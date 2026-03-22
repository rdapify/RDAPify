# RDAPClient

`RDAPClient` هو نقطة الدخول الرئيسية لجميع استعلامات RDAP. يُطبّق طبقة التطبيق في البنية السداسية (Hexagonal Architecture)، وينسّق التخزين المؤقت وحماية SSRF والتطبيع وإخفاء هوية البيانات الشخصية (PII) وآليات إعادة المحاولة وخطّافات الوسيط (middleware hooks) والواجهة الخلفية الأصلية المكتوبة بـ Rust.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();                       // القيم الافتراضية
const client = new RDAPClient({ cache: false });       // تعطيل التخزين المؤقت
const client = new RDAPClient({ privacy: false });     // تعطيل إخفاء هوية البيانات الشخصية
```

---

## المُنشئ (Constructor)

```typescript
new RDAPClient(options?: RDAPClientOptions)
```

جميع الخيارات اختيارية. عند حذفها تُستخدم القيم الافتراضية الموثّقة أدناه.

---

## خيارات المُنشئ

### `cache`

**النوع:** `boolean | CacheOptions` — **القيمة الافتراضية:** `{ strategy: 'memory', ttl: 3600, maxSize: 1000 }`

يتحكم في التخزين المؤقت للاستجابات. القيمة `true` تُفعّل التخزين في الذاكرة بالإعدادات الافتراضية؛ `false` تُعطّله.

```typescript
interface CacheOptions {
  strategy?: 'memory' | 'redis' | 'none';
  ttl?: number;          // بالثواني؛ الافتراضي 3600
  maxSize?: number;      // الحد الأقصى للمدخلات في إستراتيجية memory؛ الافتراضي 1000
  redisUrl?: string;     // سلسلة الاتصال عند استخدام إستراتيجية 'redis'
  redisClient?: RedisClientLike; // نسخة ioredis أو node-redis موجودة مسبقاً
  keyPrefix?: string;    // بادئة مفتاح Redis؛ الافتراضي 'rdapify:'
  customCache?: unknown; // تنفيذ مخصص لـ ICachePort
}
```

### `retry`

**النوع:** `boolean | RetryOptions` — **القيمة الافتراضية:** تراجع أسي، 3 محاولات

القيمة `true` تُفعّل إعادة المحاولة بالإعدادات الافتراضية؛ `false` تُعطّلها تماماً.

```typescript
interface RetryOptions {
  maxAttempts?: number;              // الافتراضي 3
  initialDelay?: number;             // بالميلي ثانية؛ الافتراضي 1000
  maxDelay?: number;                 // بالميلي ثانية؛ الافتراضي 10000
  backoff?: 'linear' | 'exponential' | 'fixed'; // الافتراضي 'exponential'
  retryableStatusCodes?: number[];   // الافتراضي [408, 429, 500, 502, 503, 504]
}
```

### `ssrfProtection`

**النوع:** `boolean | SSRFProtectionOptions` — **القيمة الافتراضية:** مُفعَّل، يحجب عناوين IP الخاصة والمحلية

القيمة `false` تُعطّل حماية SSRF بالكامل (غير موصى به في بيئة الإنتاج).

```typescript
interface SSRFProtectionOptions {
  enabled?: boolean;
  blockPrivateIPs?: boolean;    // نطاقات RFC 1918؛ الافتراضي true
  blockLocalhost?: boolean;     // 127.0.0.1 / ::1؛ الافتراضي true
  blockLinkLocal?: boolean;     // 169.254.x.x؛ الافتراضي true
  blockedDomains?: string[];    // نطاقات إضافية لرفضها
  allowedDomains?: string[];    // القائمة البيضاء (تأخذ الأولوية على قواعد الحجب)
}
```

### `privacy`

**النوع:** `boolean | PrivacyOptions` — **القيمة الافتراضية:** مُفعَّل، يُخفي `email` و`phone` و`fax`

يتحكم في إخفاء هوية البيانات الشخصية تلقائياً. القيمة `false` تُعطّله؛ `true` تُفعّله بالإعدادات الافتراضية.

```typescript
interface PrivacyOptions {
  redactPII?: boolean;
  redactFields?: string[];     // الافتراضي ['email', 'phone', 'fax']
  redactionText?: string;      // قيمة الاستبدال؛ الافتراضي '[REDACTED]'
}
```

### `timeout`

**النوع:** `number | TimeoutOptions` — **القيمة الافتراضية:** `{ connect: 5000, request: 10000, dns: 3000 }`

الرقم المفرد يُطبَّق على الأنواع الثلاثة للمهلة الزمنية في آنٍ واحد.

```typescript
interface TimeoutOptions {
  connect?: number;  // مهلة اتصال TCP بالميلي ثانية
  request?: number;  // مهلة الطلب الكامل بالميلي ثانية
  dns?: number;      // مهلة استيفاء DNS بالميلي ثانية
}
```

### `logging`

**النوع:** `LoggingOptions` — **القيمة الافتراضية:** `{ level: 'warn' }`

```typescript
interface LoggingOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  logger?: (level: LogLevel, message: string, meta?: unknown) => void;
}
```

### `rateLimit`

**النوع:** `boolean | RateLimitOptions` — **القيمة الافتراضية:** معطَّل

```typescript
interface RateLimitOptions {
  enabled?: boolean;
  maxRequests?: number;  // الافتراضي 100
  windowMs?: number;     // الافتراضي 60000 (دقيقة واحدة)
}
```

### `debug`

**النوع:** `boolean | DebugOptions` — **القيمة الافتراضية:** معطَّل

القيمة `true` تُفعّل إخراج التصحيح إلى المسجّل المدمج. مرّر كائناً لتوفير مسجّل مخصص.

```typescript
interface DebugOptions {
  enabled?: boolean;
  logger?: {
    debug: (message: string, metadata?: Record<string, unknown>) => void;
    info:  (message: string, metadata?: Record<string, unknown>) => void;
    warn:  (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, metadata?: Record<string, unknown>) => void;
  };
}
```

### `backend`

**النوع:** `'auto' | 'native' | 'typescript'` — **القيمة الافتراضية:** `'auto'`

يحدد الواجهة الخلفية لتنفيذ الاستعلامات.

| القيمة | السلوك |
|--------|-----------|
| `'auto'` | يستخدم الواجهة الخلفية الأصلية بـ Rust إن كانت `rdapify-nd` مثبّتة؛ يعود إلى TypeScript بصمت |
| `'native'` | يستخدم واجهة Rust دائماً؛ يُلقي خطأً عند الإنشاء إن كانت `rdapify-nd` غائبة |
| `'typescript'` | يستخدم واجهة TypeScript دائماً حتى عند وجود `rdapify-nd` |

تعالج الواجهة الأصلية الأساليب الخمسة للاستعلام في Rust المُجمَّع. خطّافات الوسيط وتحديد معدل الطلبات وتسجيل التدقيق وسائر ميزات طبقة TypeScript تُتجاوز عند تفعيل الواجهة الأصلية.

### `deduplication`

**النوع:** `boolean | { windowMs?: number }` — **القيمة الافتراضية:** معطَّل

عند التفعيل، تُدمج الاستعلامات المتزامنة لنفس الهدف في طلب شبكة واحد خلال نافذة إلغاء التكرار.

```typescript
client = new RDAPClient({ deduplication: true });          // نافذة 100 ميلي ثانية
client = new RDAPClient({ deduplication: { windowMs: 250 } });
```

### `middleware`

**النوع:** `MiddlewareHooksConfig` — **القيمة الافتراضية:** `{}`

يسجّل خطّافات دورة الحياة عند الإنشاء. يعادل استدعاء `.use()` مباشرة بعد الإنشاء.

### خيارات أخرى

| الخيار | النوع | الافتراضي | الوصف |
|--------|------|---------|-------------|
| `userAgent` | `string` | `'RDAPify/0.1.8 (https://rdapify.com)'` | ترويسة `User-Agent` المُرسَلة إلى خوادم RDAP |
| `includeRaw` | `boolean` | `false` | إرفاق استجابة RDAP الخام في `result.raw` |
| `followRedirects` | `boolean` | `true` | اتباع تحويلات HTTP |
| `maxRedirects` | `number` | `5` | الحد الأقصى للتحويلات في كل طلب |
| `headers` | `Record<string, string>` | `{}` | ترويسات HTTP إضافية |
| `bootstrapUrl` | `string` | `'https://data.iana.org/rdap'` | عنوان القاعدة لبيانات IANA Bootstrap |

---

## أساليب الاستعلام

الأساليب الخمسة للاستعلام كلها `async` وتُفضي إلى كائن استجابة مُطبَّع. كل استجابة تحمل كائن `metadata`:

```typescript
metadata: {
  source: string;    // عنوان URL لخادم RDAP الذي أجاب على الاستعلام
  timestamp: string; // طابع زمني بتنسيق ISO 8601
  cached: boolean;   // true عند التقديم من التخزين المؤقت
}
```

---

### `domain(domain)`

```typescript
domain(domain: string): Promise<DomainResponse>
```

يستعلم عن بيانات تسجيل اسم نطاق. يُكتشف خادم RDAP المعتمد تلقائياً من سجل IANA Bootstrap.

```typescript
const result = await client.domain('example.com');

result.query                // "example.com"
result.objectClass          // "domain"
result.handle               // معرّف التسجيل (اختياري)
result.ldhName              // صيغة LDH للنطاق
result.unicodeName          // صيغة Unicode (IDN)
result.status               // RDAPStatus[]
result.nameservers          // string[] — خوادم الأسماء المفوَّضة
result.registrar?.name      // اسم المسجِّل الراعي
result.registrar?.handle
result.registrar?.url
result.entities             // RDAPEntity[] — المسجِّل والمسؤول الإداري والتقني وغيرهم
result.events               // RDAPEvent[] — التسجيل والانتهاء وآخر تعديل
result.links                // RDAPLink[]
result.remarks              // RDAPRemark[]
result.raw                  // استجابة RDAP الخام (فقط عند تفعيل includeRaw: true)
result.metadata             // { source, timestamp, cached }
```

---

### `ip(ip)`

```typescript
ip(ip: string): Promise<IPResponse>
```

يستعلم عن بيانات RDAP لعنوان IPv4 أو IPv6. يُكتشف سجل الإنترنت الإقليمي المعتمد تلقائياً من IANA Bootstrap.

```typescript
const result = await client.ip('8.8.8.8');

result.query          // "8.8.8.8"
result.objectClass    // "ip network"
result.handle         // معرّف الشبكة (مثل "NET-8-8-8-0-2")
result.startAddress   // أول عنوان في التخصيص
result.endAddress     // آخر عنوان في التخصيص
result.ipVersion      // "v4" | "v6"
result.name           // اسم الشبكة (مثل "GOOGL-2")
result.type           // نوع التخصيص
result.country        // رمز الدولة ISO 3166-1 alpha-2
result.status         // RDAPStatus[]
result.entities       // RDAPEntity[]
result.events         // RDAPEvent[]
result.metadata       // { source, timestamp, cached }
```

---

### `asn(asn)`

```typescript
asn(asn: string | number): Promise<ASNResponse>
```

يستعلم عن بيانات RDAP لرقم نظام مستقل (ASN). يقبل رقماً مجرداً (`15169`) أو الصيغة المسبوقة بـ `AS` (`"AS15169"`).

```typescript
const result = await client.asn('AS15169');
// أو:
const result = await client.asn(15169);

result.query          // "AS15169"
result.objectClass    // "autnum"
result.handle
result.startAutnum    // أول ASN في النطاق
result.endAutnum      // آخر ASN في النطاق
result.name           // مثل "GOOGLE"
result.type
result.country        // ISO 3166-1 alpha-2
result.status         // RDAPStatus[]
result.entities       // RDAPEntity[]
result.events         // RDAPEvent[]
result.metadata       // { source, timestamp, cached }
```

---

### `nameserver(nameserver)`

```typescript
nameserver(nameserver: string): Promise<NameserverResponse>
```

يستعلم عن بيانات RDAP لاسم مضيف خادم الأسماء.

```typescript
const result = await client.nameserver('ns1.google.com');

result.query             // "ns1.google.com"
result.objectClass       // "nameserver"
result.ldhName
result.unicodeName
result.status            // RDAPStatus[]
result.ipAddresses?.v4   // string[] — سجلات IPv4 الإضافية (glue)
result.ipAddresses?.v6   // string[] — سجلات IPv6 الإضافية (glue)
result.entities          // RDAPEntity[]
result.events            // RDAPEvent[]
result.metadata          // { source, timestamp, cached }
```

---

### `entity(handle, serverUrl)`

```typescript
entity(handle: string, serverUrl: string): Promise<EntityResponse>
```

يستعلم عن بيانات RDAP لكيان (جهة اتصال أو مسجِّل أو مسجَّل) عبر معرّفه. لا يوجد سجل IANA Bootstrap عالمي للكيانات، لذا يُلزَم توفير عنوان URL لخادم RDAP صريح.

```typescript
const result = await client.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');

result.query          // "ARIN-HN-1"
result.objectClass    // "entity"
result.handle
result.vcardArray     // تمثيل مصفوفة vCard 4.0
result.roles          // RoleType[]
result.status         // RDAPStatus[]
result.entities       // RDAPEntity[] — كيانات فرعية
result.events         // RDAPEvent[]
result.metadata       // { source, timestamp, cached }
```

---

## خطّافات دورة الحياة

سجّل الخطّافات عبر خيار `middleware` في المُنشئ أو الأسلوب الطلاسمي `.use()`. تعمل الخطّافات بشكل متزامن أو غير متزامن؛ تُلتقط أخطاؤها بصمت ولا تقاطع أبداً مسار الاستعلام.

```typescript
client.use({
  beforeQuery(ctx) {
    // ctx.queryType: 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity'
    // ctx.query:     سلسلة الإدخال الخام
    // ctx.startTime: Date.now() عند بدء الاستعلام
  },
  afterQuery(ctx) {
    // ctx.duration:  الميلي ثانية المنقضية
    // ctx.fromCache: true عند تقديم النتيجة من التخزين المؤقت
    // ctx.result:    الـ RDAPResponse
  },
  onError(ctx) {
    // ctx.error: الخطأ المُلقى
  },
  onCacheHit(ctx)  { /* ctx.query */ },
  onCacheMiss(ctx) { /* ctx.query */ },
  onRetry(ctx) {
    // ctx.attempt: رقم المحاولة الحالية
    // ctx.delay:   تأخير التراجع بالميلي ثانية قبل إعادة المحاولة
  },
});
```

`.use()` يُعيد `this`، مما يُتيح السلاسل:

```typescript
client
  .use({ beforeQuery: (ctx) => logger.info('start', ctx.query) })
  .use({ afterQuery:  (ctx) => logger.info('done', ctx.duration) });
```

---

## الأساليب المساعدة

### `clearCache()`

```typescript
clearCache(): Promise<void>
```

يمسح التخزين المؤقت للاستجابات وتخزين IANA Bootstrap المؤقت.

---

### `clearAll()`

```typescript
clearAll(): Promise<void>
```

يمسح التخزين المؤقت للاستجابات وتخزين Bootstrap المؤقت والمقاييس المجمَّعة والسجلات في الذاكرة.

---

### `getStats()`

```typescript
getStats(): Promise<{
  cache: { size: number; enabled: boolean; ttl: number };
  bootstrap: { size: number; types: string[] };
}>
```

يُعيد إحصائيات التخزين المؤقت وبيانات Bootstrap الحالية.

---

### `getMetrics(since?)`

```typescript
getMetrics(since?: number): MetricsSummary
```

يُعيد ملخصاً للأداء لجميع الاستعلامات. المعامل الاختياري `since` هو طابع زمني Unix (بالميلي ثانية) لتصفية المقاييس من تلك النقطة للأمام.

---

### `getConnectionPoolStats()`

```typescript
getConnectionPoolStats(): ConnectionPoolStats
```

يُعيد إحصائيات لمجموعة اتصالات HTTP الداخلية.

---

### `getConfig()`

```typescript
getConfig(): Required<RDAPClientOptions>
```

يُعيد الإعداد المدمج (خيارات المستخدم مدموجة عمقياً مع القيم الافتراضية).

---

### `getRateLimiter()`

```typescript
getRateLimiter(): RateLimiter
```

يُعيد نسخة `RateLimiter` الداخلية للفحص أو التحكم البرمجي.

---

### `getBatchProcessor()`

```typescript
getBatchProcessor(): BatchProcessor
```

يُعيد `BatchProcessor` الداخلي لأنماط استعلام الدُفعات المتقدمة.

---

### `getDeduplicatorStats()`

```typescript
getDeduplicatorStats(): DeduplicatorStats
```

يُعيد إحصائيات إلغاء التكرار (الاستعلامات المعلّقة وأعداد الطلبات المدموجة).

---

### `getLogger()`

```typescript
getLogger(): Logger
```

يُعيد نسخة `Logger` الداخلية.

---

### `getLogs(count?)`

```typescript
getLogs(count?: number): LogEntry[]
```

يُعيد إدخالات السجل الأخيرة. `count` يحدد عدد الإدخالات المُعادة.

---

### `getMiddlewareManager()`

```typescript
getMiddlewareManager(): MiddlewareManager
```

يُعيد `MiddlewareManager` لاستيضاح الخطّافات المسجَّلة أو مسحها برمجياً.

---

### `destroy()`

```typescript
destroy(): void
```

يُحرر الموارد التي يحتفظ بها العميل — مؤقتات محدّد معدل الطلبات ومجموعة الاتصالات. استدعِه عند انتهاء استخدام العميل (مثلاً في إيقاف الاختبارات أو معالجات إيقاف العملية).

---

## أنواع كيانات الاستجابة

أنواع الاستجابة الخمسة تتضمن أنواع الكيانات الفرعية المشتركة التالية:

```typescript
interface RDAPEvent {
  eventAction: string;   // مثل "registration", "expiration", "last changed"
  eventDate: string;     // سلسلة التاريخ بتنسيق ISO 8601
  links?: RDAPLink[];
}

interface RDAPEntity {
  handle?: string;
  objectClass: string;
  roles?: string[];
  vcardArray?: any[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
}

interface RDAPLink {
  value: string;
  rel: string;
  href: string;
  type?: string;
}

interface RDAPRemark {
  title?: string;
  description: string[];
  links?: RDAPLink[];
}
```

---

## معالجة الأخطاء

جميع أساليب الاستعلام تُلقي أخطاء مُحدَّدة النوع عند الفشل:

| صنف الخطأ | السبب |
|-------------|-------|
| `ValidationError` | إدخال غير صالح (نطاق أو IP أو ASN مشوَّه) |
| `SSRFError` | هدف الاستعلام محجوب بواسطة حماية SSRF |
| `BootstrapError` | فشل اكتشاف خادم RDAP المعتمد |
| `FetchError` | خطأ شبكي أو استجابة غير 2xx بعد كل المحاولات |
| `NativeBackendError` | `rdapify-nd` غير متاحة وقد تم ضبط `backend: 'native'` |

```typescript
import { ValidationError, FetchError } from 'rdapify';

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('bad input:', error.message);
  } else if (error instanceof FetchError) {
    console.error('network error:', error.message);
  }
}
```

---

التالي: [ضوابط الخصوصية](./privacy-controls.md)
