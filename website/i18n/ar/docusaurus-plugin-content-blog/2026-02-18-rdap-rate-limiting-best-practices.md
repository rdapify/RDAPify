---
slug: rdap-rate-limiting-best-practices
title: "تحديد معدل طلبات RDAP: أفضل الممارسات للاستعلام المحترم"
authors: [rdapify]
tags: [rdap, rate-limiting, best-practices, performance]
description: "كيف يعمل تحديد معدل طلبات RDAP، وما الذي يحدث عند تجاوز الحدود، وكيف تبني عملاء محترمين يلتزمون بالحدود المقررة. يشمل منطق إعادة المحاولة، واستراتيجيات التراجع، وإدارة قوائم الانتظار."
keywords: [rdap rate limit, domain lookup rate limit, rdap 429 error, respectful rdap client, rdap throttling, domain query rate]
image: /img/rdapify-social-card.png
---

خوادم RDAP بنية تحتية عامة مشتركة بين الجميع. الاستعلام الجائر يُعرّضك لتحديد معدل الطلبات — أو الحظر الكامل. إليك كيفية عمل تحديد المعدل في RDAP وكيفية بناء عملاء يلتزمون بالحدود.

<!-- truncate -->

## كيف يعمل تحديد معدل طلبات RDAP

يستخدم RDAP آليات تحديد معدل HTTP القياسية:

### استجابة HTTP 429

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/rdap+json

{
  "errorCode": 429,
  "title": "Too Many Requests",
  "description": ["Please slow down your queries"]
}
```

يُخبرك رأس `Retry-After` بموعد إعادة المحاولة — بالثواني من الآن.

### رؤوس تحديد المعدل

بعض خوادم RDAP تُعيد رؤوس الحصة المتبقية:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1711065600
```

## حدود المعدل المعروفة حسب السجل

| السجل | الحد التقريبي | ملاحظات |
|----------|------------------|-------|
| Verisign (.com/.net) | ~10 طلب/ثانية | لكل عنوان IP |
| ARIN | ~10 طلب/ثانية | لكل IP؛ أعلى بمفتاح API |
| RIPE NCC | ~10 طلب/ثانية | لكل عنوان IP |
| APNIC | ~5 طلبات/ثانية | لكل عنوان IP |
| AFRINIC | ~5 طلبات/ثانية | لكل عنوان IP |
| LACNIC | ~5 طلبات/ثانية | لكل عنوان IP |

هذه أرقام تقريبية وقد تتغير. احرص دائمًا على احترام رؤوس `Retry-After`.

## التراجع الأسي

عند تجاوز الحد، لا تُكثر الضرب على الخادم باستمرار. استخدم التراجع الأسي:

```typescript
async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Only retry on 429 or network errors
      if (error.status !== 429 && !error.code?.startsWith('ECONNRESET')) {
        throw error;
      }

      if (attempt === maxRetries) break;

      // Respect Retry-After if provided
      const retryAfter = error.retryAfter ?? null;
      const delay = retryAfter
        ? retryAfter * 1000
        : baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      console.log(`Rate limited. Waiting ${Math.round(delay / 1000)}s before retry ${attempt + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage
const result = await withBackoff(() => client.domain('example.com'));
```

## قائمة انتظار الطلبات مع التحكم في المعدل

للاستعلامات الجماعية، استخدم قائمة انتظار تتحكم في التزامن:

```typescript
class RDAPQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly delayMs: number;

  constructor(concurrency = 3, requestsPerSecond = 5) {
    this.concurrency = concurrency;
    this.delayMs = 1000 / requestsPerSecond;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;

    this.running++;
    const task = this.queue.shift()!;

    await task();
    await new Promise(resolve => setTimeout(resolve, this.delayMs));

    this.running--;
    this.process();
  }
}

// Usage: 3 concurrent requests, max 5 req/sec total
const queue = new RDAPQueue(3, 5);
const client = new RDAPClient({ cache: { ttl: 3600 } });

async function bulkLookup(domains: string[]) {
  return Promise.all(
    domains.map(domain =>
      queue.add(() => client.domain(domain))
    )
  );
}

const results = await bulkLookup(['a.com', 'b.com', 'c.com', /* ... */]);
```

## التخزين المؤقت كدرع ضد تحديد المعدل

التخزين المؤقت هو أكثر الحلول فعالية للتخفيف من تحديد المعدل:

```typescript
const client = new RDAPClient({
  cache: {
    ttl: 14400, // 4 hours — covers most use cases
    maxSize: 10000,
  },
});

// Second call for same domain: instant, no rate limit consumed
await client.domain('google.com'); // → RDAP server
await client.domain('google.com'); // → cache (no request made)
```

**الهدف المطلوب لمعدل إصابة الكاش:** 90% أو أكثر في الإنتاج.

## تحديد المعدل لكل سجل

لخوادم RDAP المختلفة حدود مختلفة. تتبّع كل خادم على حدة:

```typescript
class PerRegistryLimiter {
  private counters = new Map<string, { count: number; resetAt: number }>();
  private limits = new Map<string, number>([
    ['rdap.verisign.com', 10],  // 10 req/sec
    ['rdap.arin.net', 10],
    ['rdap.db.ripe.net', 10],
    ['rdap.apnic.net', 5],
  ]);

  async throttle(serverHost: string): Promise<void> {
    const limit = this.limits.get(serverHost) ?? 5;
    const now = Date.now();
    const key = serverHost;
    const window = this.counters.get(key);

    if (!window || now > window.resetAt) {
      this.counters.set(key, { count: 1, resetAt: now + 1000 });
      return;
    }

    if (window.count >= limit) {
      const waitMs = window.resetAt - now;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      this.counters.set(key, { count: 1, resetAt: Date.now() + 1000 });
      return;
    }

    window.count++;
  }
}
```

## قائمة مراجعة: عميل RDAP آمن من تحديد المعدل

- [ ] **تخزين الاستجابات مؤقتًا** — TTL من 1 إلى 24 ساعة حسب نوع البيانات
- [ ] **معالجة 429** — احترام رأس `Retry-After`
- [ ] **التراجع الأسي** — لا تُكثر الطلبات عند الفشل
- [ ] **تصفيف الطلبات الجماعية** — التحكم في التزامن (3-5 طلبات متزامنة كحد أقصى)
- [ ] **احترام حدود كل خادم** — لسجلات RIR المختلفة حدود مختلفة
- [ ] **إضافة اهتزاز عشوائي** — تشتيت التأخيرات لتجنب إعادة المحاولات المتزامنة
- [ ] **مراقبة معدلات الإصابة** — تتبع وتنبيه عند معدلات 429 غير اعتيادية
- [ ] **استخدام واجهات برمجية رسمية** — بعض السجلات تتيح حدودًا أعلى بمفاتيح API

## الخلاصة

الاستعلام المحترم عن RDAP ليس مجرد آداب عمل جيدة — بل يضمن موثوقية تطبيقك. طبّق التخزين المؤقت والتراجع وإدارة قوائم الانتظار، وستندر مواجهتك لاستجابة 429.

---

*يتولى RDAPify معالجة التراجع واحترام `Retry-After` تلقائيًا. راجع [توثيق العميل](/docs/api-reference/client).*
