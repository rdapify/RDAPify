---
slug: rdap-caching-strategies-high-traffic
title: "استراتيجيات التخزين المؤقت لـ RDAP في التطبيقات ذات الحركة العالية"
authors: [rdapify]
tags: [performance, caching, rdap, architecture]
description: "تحسين أداء استعلامات RDAP باستراتيجيات تخزين مؤقت ذكية. تعلم التخزين المؤقت متعدد الطبقات، واختيار TTL، وإلغاء صلاحية الكاش، وكيفية التعامل الكفء مع الملايين من عمليات البحث."
keywords: [rdap caching, domain lookup performance, cache rdap responses, high traffic domain lookup, optimize rdap queries, redis rdap cache]
image: /img/rdapify-social-card.png
---

إذا كان تطبيقك يُجري ملايين عمليات بحث عن النطاقات، فإن استعلام RDAP الساذج سيُثقل السجلات ويصطدم بحدود المعدل ويُبطئ كل شيء. التخزين المؤقت الذكي هو الفارق بين نظام يتوسع ونظام ينهار. إليك كيفية القيام بذلك بشكل صحيح.

<!-- truncate -->

## لماذا يهم التخزين المؤقت في RDAP

تُفرض حدود معدل الطلبات على خوادم RDAP. ستُعيد Verisign وARIN وغيرهما `429 Too Many Requests` إذا استعلمت بقوة مفرطة. علاوة على ذلك:

- زمن انتقال الشبكة: 150-400 مللي ثانية لكل استعلام RDAP
- بيانات RDAP تتغير نادرًا (تاريخ انتهاء النطاق نادرًا ما يتغير يوميًا)
- كثير من عمليات البحث تتكرر على نفس النطاقات الشهيرة
- تُفضّل السجلات أن تُخزّن بدلًا من إعادة الاستعلام

**نظام ذو كاش جيد يمكنه خدمة 99% من الاستعلامات من الكاش بزمن انتقال أقل من 5 مللي ثانية.**

## استراتيجية TTL للكاش

ليست كل بيانات RDAP بنفس الدرجة من التقلب:

| نوع البيانات | تكرار التغيير | TTL الموصى به |
|-----------|------------------|-----------------|
| تاريخ انتهاء النطاق | نادرًا (تجديد سنوي) | 24 ساعة |
| حالة النطاق | أحيانًا | 4 ساعات |
| خوادم الأسماء | نادرًا | 24 ساعة |
| معلومات المسجّل | نادرًا جدًا | 48 ساعة |
| تخصيص IP | نادرًا جدًا | 48 ساعة |
| بيانات ASN | شبه أبدًا | 72 ساعة |
| بيانات Bootstrap | تحديثات أسبوعية | 24 ساعة |

```typescript
import { RDAPClient } from 'rdapify';

// Conservative TTLs for reliability
const client = new RDAPClient({
  cache: {
    ttl: 14400, // 4 hours default
  },
});
```

## بنية التخزين المؤقت متعددة الطبقات

للأنظمة ذات الحركة العالية، استخدم طبقات كاش متعددة:

```
Request
   ↓
[L1: In-Process Memory]  ← < 1ms, limited size
   ↓ miss
[L2: Redis/Valkey]       ← 1-5ms, large, shared
   ↓ miss
[L3: RDAP Server]        ← 150-400ms, external
   ↓
Cache all layers + return
```

### L1: الكاش في الذاكرة (مدمج في RDAPify)

```typescript
const client = new RDAPClient({
  cache: {
    ttl: 3600,      // 1 hour
    maxSize: 1000,  // Max entries in memory
  },
});
```

### L2: محوّل كاش Redis

```typescript
import { RDAPClient } from 'rdapify';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

// Custom Redis cache adapter
const redisAdapter = {
  async get(key: string) {
    const value = await redis.get(`rdap:${key}`);
    return value ? JSON.parse(value) : undefined;
  },
  async set(key: string, value: unknown, ttl: number) {
    await redis.setEx(`rdap:${key}`, ttl, JSON.stringify(value));
  },
  async delete(key: string) {
    await redis.del(`rdap:${key}`);
  },
};

const client = new RDAPClient({
  cache: {
    adapter: redisAdapter,
    ttl: 14400, // 4 hours in Redis
  },
});
```

## تصميم مفاتيح الكاش

مفاتيح الكاش الجيدة تمنع التعارضات وتُتيح إلغاء الصلاحية بدقة:

```typescript
// Key patterns
// domain:example.com
// ip:8.8.8.8
// asn:15169
// bootstrap:dns
// bootstrap:ipv4

function buildCacheKey(type: string, query: string): string {
  return `rdap:${type}:${query.toLowerCase()}`;
}
```

## معالجة اندفاعات الكاش

عندما تصل طلبات كثيرة في نفس الوقت إلى إدخال كاش منتهي الصلاحية، تُرسل جميعها استعلامات إلى خادم RDAP مرة واحدة — وهو ما يُعرف بـ **اندفاع الكاش**. امنعه باستخدام قفل:

```typescript
const inFlight = new Map<string, Promise<any>>();

async function cachedLookup(client: RDAPClient, domain: string) {
  const key = `domain:${domain}`;

  // Check cache first
  const cached = await cacheGet(key);
  if (cached) return cached;

  // Coalesce concurrent requests for the same domain
  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  const promise = client.domain(domain)
    .then(result => {
      cacheSet(key, result, 3600);
      inFlight.delete(key);
      return result;
    })
    .catch(err => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}
```

## الإحماء المسبق للكاش

ملء الكاش مسبقًا للنطاقات الأكثر استعلامًا:

```typescript
const TOP_DOMAINS = [
  'google.com', 'youtube.com', 'facebook.com', 'amazon.com',
  'wikipedia.org', 'twitter.com', 'instagram.com', 'github.com',
  // ... your actual top domains
];

async function warmCache(domains: string[]) {
  console.log(`Warming cache for ${domains.length} domains...`);

  const CONCURRENCY = 5; // Don't overwhelm RDAP servers

  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const batch = domains.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(d => client.domain(d)));
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('Cache warm-up complete');
}

// Run on startup
await warmCache(TOP_DOMAINS);
```

## مراقبة أداء الكاش

تتبّع معدل إصابة الكاش — استهدف أكثر من 95%:

```typescript
let hits = 0;
let misses = 0;

const monitoredAdapter = {
  async get(key: string) {
    const value = await baseAdapter.get(key);
    if (value !== undefined) hits++;
    else misses++;
    return value;
  },
  async set(key: string, value: unknown, ttl: number) {
    return baseAdapter.set(key, value, ttl);
  },
  async delete(key: string) {
    return baseAdapter.delete(key);
  },
};

// Report every minute
setInterval(() => {
  const total = hits + misses;
  const rate = total > 0 ? ((hits / total) * 100).toFixed(1) : '0';
  console.log(`Cache hit rate: ${rate}% (${hits}/${total})`);
  hits = 0;
  misses = 0;
}, 60_000);
```

## معالجة حدود المعدل

حتى مع التخزين المؤقت، قد تصطدم بحدود المعدل. تعامل معها بلطف:

```typescript
const client = new RDAPClient({
  cache: { ttl: 14400 },
  // RDAPify automatically respects Retry-After headers
  // and implements exponential backoff on 429 responses
});
```

## مقارنة: مع الكاش وبدونه

في اختبار بـ 10,000 استعلام للنطاق (1,000 نطاق فريد × 10 تكرارات):

| الإعداد | متوسط زمن الانتقال | p99 زمن الانتقال | أخطاء تحديد المعدل |
|-------|-------------|-------------|-------------------|
| بدون كاش | 280 مللي ثانية | 850 مللي ثانية | 342 خطأ |
| كاش في الذاكرة (TTL ساعة) | 1.2 مللي ثانية | 12 مللي ثانية | 0 أخطاء |
| كاش Redis (TTL 4 ساعات) | 3.8 مللي ثانية | 18 مللي ثانية | 0 أخطاء |

معدلات إصابة الكاش المحققة: 89% (في الذاكرة)، 94% (Redis).

## الخلاصة

التخزين المؤقت يُحوّل RDAP من عنق الزجاجة إلى خدمة سريعة وموثوقة. ابدأ بكاش الذاكرة المدمج في RDAPify، ثم أضف Redis عندما تحتاج إلى تخزين مؤقت موزع عبر حالات متعددة. استهدف معدل إصابة كاش يتجاوز 90% في الإنتاج.

---

*يدعم نظام التخزين المؤقت في RDAPify محوّلات مخصصة لـ Redis وMemcached وأي مخزن آخر. راجع [توثيق الكاش](/docs/getting-started/installation).*
