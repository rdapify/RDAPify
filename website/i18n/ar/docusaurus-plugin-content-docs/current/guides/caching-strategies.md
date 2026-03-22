# استراتيجيات التخزين المؤقت

تشتمل RDAPify على ذاكرة تخزين مؤقت مدمجة للاستجابات تُلغي المكالمات الشبكية المتكررة إلى سجلات RDAP. يغطي هذا الدليل جميع الاستراتيجيات المدعومة وأنماط الضبط والاعتبارات التشغيلية.

---

## لماذا يهم التخزين المؤقت في RDAP

تتضمن استعلامات RDAP رحلة شبكية إلى سجل خارجي — عادةً من 100 إلى 400 ميلي ثانية. كما تفرض السجلات حدوداً على معدل الطلبات. يوفر التخزين المؤقت:

- **الأداء** — يُعيد الاستجابات من الذاكرة في أقل من 5 ميكرو ثانية مقارنةً بـ ~180 ميكرو ثانية للاستعلام المباشر (انظر [معايير الأداء](../performance/benchmarks.md))
- **المرونة** — يُقدم النتائج خلال أعطال السجل العابرة
- **الالتزام بحدود المعدل** — يُقلل حجم الاستعلامات الصادرة

---

## استراتيجيات التخزين المؤقت

تدعم RDAPify ثلاث استراتيجيات يتحكم فيها `cache.strategy`:

| الاستراتيجية | الوصف | حالة الاستخدام |
|----------|-------------|----------|
| `'memory'` | ذاكرة تخزين LRU داخل العملية (الافتراضي) | التطبيقات أحادية العملية |
| `'redis'` | ذاكرة تخزين مدعومة بـ Redis | عمليات النشر الموزعة أو متعددة العمليات |
| `'none'` | التخزين المؤقت معطّل | الاختبار وتصحيح الأخطاء والبيانات الطازجة دائماً |

---

## الضبط

### ذاكرة التخزين المؤقت (الافتراضي)

```typescript
const client = new RDAPClient();
// مكافئ لـ:
const client = new RDAPClient({
  cache: {
    strategy: 'memory',
    ttl: 3600,      // بالثواني؛ الافتراضي ساعة واحدة
    maxSize: 1000,  // الحد الأقصى للمدخلات؛ الافتراضي 1000
  },
});
```

### تعطيل التخزين المؤقت

```typescript
const client = new RDAPClient({ cache: false });
// أو:
const client = new RDAPClient({ cache: { strategy: 'none' } });
```

### ذاكرة تخزين Redis

```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'rdapify:',   // الافتراضي 'rdapify:'
    ttl: 3600,
  },
});
```

يقبل `redisClient` أي عميل متوافق مع `ioredis` أو `node-redis`. تستخدم المكتبة الحد الأدنى من الواجهة (`get`، `set`، `del`) — لا حاجة لأوامر خاصة بالمجموعة.

---

## إرشادات TTL

بيانات التسجيل نادراً ما تتغير. قيم TTL الموصى بها:

| نوع البيانات | TTL المقترح | المبرر |
|-----------|---------------|-----------|
| بيانات النطاق | 1–24 ساعة | التسجيلات نادراً ما تتغير خلال اليوم |
| شبكة IP | 6–24 ساعة | التخصيصات مستقرة |
| بيانات ASN | 6–24 ساعة | التخصيصات مستقرة |
| خادم أسماء | 1–6 ساعات | يمكن أن يتغير بشكل أكثر تكرراً |

لمراقبة الأمان حيث تهم الحداثة، استخدم TTL أقصر:

```typescript
const client = new RDAPClient({
  cache: { strategy: 'memory', ttl: 300 }, // 5 دقائق
});
```

---

## التسخين المسبق للذاكرة المؤقتة

قم بملء الذاكرة المؤقتة مسبقاً عند بدء التشغيل للاستعلامات الحرجة المعروفة:

```typescript
const criticalDomains = ['example.com', 'example.org', 'iana.org'];

await Promise.allSettled(
  criticalDomains.map(d =>
    client.domain(d).catch(e => console.warn(`warm failed for ${d}:`, e.message)),
  ),
);
```

---

## فحص حالة الذاكرة المؤقتة

```typescript
const stats = await client.getStats();

console.log(stats.cache.size);    // عدد المدخلات في الذاكرة المؤقتة
console.log(stats.cache.enabled); // true / false
console.log(stats.cache.ttl);     // TTL المضبوط بالثواني
```

تحمل كل استجابة أيضاً `metadata.cached`:

```typescript
const r1 = await client.domain('example.com');
console.log(r1.metadata.cached); // false — الاستدعاء الأول

const r2 = await client.domain('example.com');
console.log(r2.metadata.cached); // true — مُقدَّم من الذاكرة المؤقتة
```

---

## إبطال الذاكرة المؤقتة

مسح ذاكرة الاستجابة المؤقتة وذاكرة اكتشاف bootstrap:

```typescript
await client.clearCache();
```

مسح كل شيء (الذاكرة المؤقتة والمقاييس والسجلات في الذاكرة):

```typescript
await client.clearAll();
```

لا توجد واجهة برمجية لإبطال مفتاح محدد. إذا احتجت لإجبار تحديث نطاق معين، امسح الذاكرة المؤقتة بالكامل وأعد الاستعلام.

---

## دمج خطافات دورة الحياة

راقب سلوك الذاكرة المؤقتة باستخدام خطافات middleware:

```typescript
const stats = { hits: 0, misses: 0 };

client.use({
  onCacheHit()  { stats.hits++; },
  onCacheMiss() { stats.misses++; },
  afterQuery(ctx) {
    if (ctx.fromCache) console.log(`cache hit: ${ctx.query}`);
  },
});
```

---

## Redis في بيئة الإنتاج

أدنى ضبط محكم:

```typescript
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    rejectUnauthorized: true,
  },
});
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: `rdapify:${process.env.APP_ENV}:`,
    ttl: parseInt(process.env.RDAP_CACHE_TTL ?? '3600'),
  },
});
```

التوصيات:

- **استخدم TLS** — قد تحتوي استجابات RDAP على أسماء المؤسسات ومعرفات جهات الاتصال.
- **اضبط بادئة مفتاح** — تتجنب التعارضات مع الخدمات الأخرى التي تشترك في نفس نسخة Redis.
- **تعامل مع قطع الاتصال** — قم بتغليف الاستعلامات في try/catch؛ خطأ اتصال Redis يُسبب إخفاقاً في الذاكرة المؤقتة والرجوع إلى استعلام مباشر.

---

## Cloudflare Workers

تعمل ذاكرة التخزين المؤقت في الذاكرة على Cloudflare Workers. استراتيجيات التخزين المستندة إلى الملفات غير قابلة للتطبيق؛ استخدم `strategy: 'memory'` (الافتراضي) أو `strategy: 'none'`. يُدعم Redis إذا كانت نسخته قابلة للوصول من العامل.

---

## الاختبار

لاختبارات الوحدة، عطّل التخزين المؤقت للتأكد من أن كل اختبار يستدعي طبقة الشبكة الوهمية:

```typescript
const client = new RDAPClient({ cache: false });
```

أو استخدم TTL قصيراً جداً لاختبار انتهاء صلاحية الذاكرة المؤقتة:

```typescript
const client = new RDAPClient({ cache: { ttl: 1 } }); // ثانية واحدة
```

---

## انظر أيضاً

- [RDAPClient — خيار `cache`](../api-reference/client.md#cache)
- [أنواع الخيارات — `CacheOptions`](../api-reference/types/options.md#cacheoptions)
- [معايير الأداء](../performance/benchmarks.md)
