# البدء السريع

## المتطلبات الأساسية

- Node.js 20+
- `npm install rdapify`

---

## استعلامك الأول

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

const result = await client.domain('example.com');
console.log(result.query);           // "example.com"
console.log(result.registrar?.name); // اسم جهة التسجيل
console.log(result.nameservers);     // ['a.iana-servers.net', 'b.iana-servers.net']
console.log(result.status);          // ['client delete prohibited', ...]
```

تتضمن كل استجابة كائن `metadata`:

```typescript
result.metadata.source    // عنوان URL لخادم RDAP الذي أجاب على الاستعلام
result.metadata.timestamp // طابع زمني للاستعلام بتنسيق ISO 8601
result.metadata.cached    // true عند تقديم الاستجابة من الذاكرة المؤقتة
```

تشغيله:

```bash
node --input-type=module < app.ts
# أو بعد التصريف:
node dist/app.js
```

---

## أنواع الاستعلامات الخمسة

```typescript
// اسم النطاق
const domain = await client.domain('example.com');
console.log(domain.nameservers);    // string[]
console.log(domain.registrar?.name);

// عنوان IP (IPv4 أو IPv6)
const ip = await client.ip('8.8.8.8');
console.log(ip.name);      // اسم الشبكة (مثلاً "GOOGL-2")
console.log(ip.country);   // "US"
console.log(ip.startAddress, ip.endAddress);

// رقم النظام المستقل (ASN)
const asn = await client.asn('AS15169'); // أو بشكل رقمي: client.asn(15169)
console.log(asn.name);     // "GOOGLE"
console.log(asn.country);

// خادم الأسماء
const ns = await client.nameserver('ns1.google.com');
console.log(ns.ldhName);
console.log(ns.ipAddresses?.v4);

// الكيان (يتطلب خادم RDAP صريحًا — لا يوجد بوتستراب عالمي للكيانات)
const entity = await client.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
console.log(entity.handle);
console.log(entity.vcardArray);
```

---

## الإعداد

يقبل `RDAPClient` كائن خيارات. جميع الحقول اختيارية — تُطبَّق الإعدادات الافتراضية المناسبة.

```typescript
const client = new RDAPClient({
  // الخصوصية — تحجب البيانات الشخصية بشكل افتراضي
  privacy: true,               // اختصار: التفعيل بالإعدادات الافتراضية
  // أو بشكل دقيق:
  privacy: {
    privacy: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },

  // التخزين المؤقت — ذاكرة مؤقتة، مدة صلاحية ساعة واحدة، 1000 مدخلة بشكل افتراضي
  cache: true,                 // اختصار: التفعيل بالإعدادات الافتراضية
  // أو بشكل دقيق:
  cache: {
    strategy: 'memory',        // 'memory' | 'redis' | 'none'
    ttl: 3600,
    maxSize: 1000,
  },

  // المهل الزمنية (بالميلي ثانية)
  timeout: 10000,              // اختصار: ينطبق على جميع أنواع المهل الزمنية
  // أو بشكل دقيق:
  timeout: {
    connect: 5000,
    request: 10000,
    dns: 3000,
  },

  // إعادة المحاولة — تراجع أسي بشكل افتراضي
  retry: true,                 // اختصار: التفعيل بالإعدادات الافتراضية
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoff: 'exponential',    // 'linear' | 'exponential' | 'fixed'
  },

  // حماية SSRF — مفعلة بشكل افتراضي، تحجب عناوين RFC 1918 والمضيف المحلي
  ssrfProtection: true,
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    blockLinkLocal: true,
    allowedDomains: ['internal-rdap.corp.example.com'],
  },

  // تحديد معدل الطلبات — معطل بشكل افتراضي
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000,
  },

  // الواجهة الخلفية الأصلية بلغة Rust (تتطلب rdapify-nd)
  backend: 'auto',             // 'auto' (افتراضي) | 'native' | 'typescript'

  // عنوان URL لبوتستراب IANA
  bootstrapUrl: 'https://data.iana.org/rdap',

  // تضمين استجابة خادم RDAP الخام إلى جانب النتيجة المُعيَّرة
  includeRaw: false,
});
```

---

## خطاطيف دورة الحياة (الوسيط)

سجِّل الخطاطيف عبر خيار `middleware` في المُنشئ أو أسلوب `.use()` الطلاقي.

```typescript
const client = new RDAPClient();

client
  .use({
    beforeQuery(ctx) {
      console.log(`[${ctx.queryType}] querying: ${ctx.query}`);
    },
    afterQuery(ctx) {
      console.log(`completed in ${ctx.duration} ms (cached: ${ctx.fromCache})`);
    },
    onError(ctx) {
      console.error(`query failed: ${ctx.error?.message}`);
    },
    onCacheHit(ctx) {
      console.log(`cache hit for ${ctx.query}`);
    },
    onRetry(ctx) {
      console.log(`retry #${ctx.attempt} in ${ctx.delay} ms`);
    },
  });
```

أخطاء الخطاطيف تُلتقط بصمت — الخطأ في خطاف لا يكسر أبدًا خط أنابيب الاستعلام.

---

## الذاكرة المؤقتة مع Redis

```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'rdapify:',
    ttl: 3600,
  },
});
```

---

## تسجيل التصحيح

```typescript
// كتابة مخرجات التصحيح إلى المسجِّل المدمج
const client = new RDAPClient({ debug: true });

// أو تقديم مسجِّل مخصص:
const client = new RDAPClient({
  debug: {
    logger: {
      debug: (msg, meta) => myLogger.debug(msg, meta),
      info:  (msg, meta) => myLogger.info(msg, meta),
      warn:  (msg, meta) => myLogger.warn(msg, meta),
      error: (msg, meta) => myLogger.error(msg, meta),
    },
  },
});
```

---

## الأساليب المساعدة

```typescript
// مسح الذاكرة المؤقتة للاستجابات وذاكرة البوتستراب
await client.clearCache();

// مسح كل شيء (الذاكرة المؤقتة، المقاييس، السجلات)
await client.clearAll();

// استرداد إحصائيات الذاكرة المؤقتة والبوتستراب
const stats = await client.getStats();
console.log(stats.cache.size, stats.bootstrap.size);

// استرداد مقاييس الأداء
const metrics = client.getMetrics();

// تحرير الموارد (مؤقتات محدِّد المعدل، مجمّع الاتصالات)
client.destroy();
```

---

التالي: [مرجع API — RDAPClient](../api-reference/client.md)
