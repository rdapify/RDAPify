# دليل تحديد معدل الطلبات

يساعدك تحديد المعدل على التحكم في عدد الطلبات الموجهة إلى خوادم RDAP، مما يمنع حجب تطبيقك بسبب الطلبات المفرطة.

## نظرة عامة

تتضمن RDAPify محدد معدل مدمجاً يعمل بنظام دلو الرموز (token bucket) يقوم بما يلي:
- تتبع الطلبات لكل نافذة زمنية
- دعم مفاتيح متعددة (مستخدمون، عناوين IP، إلخ)
- تنظيف التسجيلات القديمة تلقائياً
- توفير إحصائيات الاستخدام التفصيلية

## الاستخدام الأساسي

### تفعيل تحديد المعدل في العميل

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 100,    // الحد الأقصى للطلبات
    windowMs: 60000      // لكل دقيقة واحدة
  }
});

// يُطبَّق تحديد المعدل تلقائياً على جميع الاستعلامات
const domain = await client.domain('example.com');
```

### محدد معدل مستقل

```typescript
import { RateLimiter } from 'rdapify';

const limiter = new RateLimiter({
  enabled: true,
  maxRequests: 50,
  windowMs: 30000  // 30 ثانية
});

// فحص الحد قبل العملية
await limiter.checkLimit('user-123');

// الحصول على معلومات الاستخدام
const usage = limiter.getUsage('user-123');
console.log(`${usage.current}/${usage.limit} requests used`);
console.log(`${usage.remaining} requests remaining`);
console.log(`Resets at: ${new Date(usage.resetAt)}`);
```

## الاستخدام المتقدم

### تحديد المعدل لكل مستخدم

```typescript
const limiter = new RateLimiter({
  enabled: true,
  maxRequests: 100,
  windowMs: 60000
});

// حدود مختلفة لمستخدمين مختلفين
await limiter.checkLimit('user-1');
await limiter.checkLimit('user-2');
await limiter.checkLimit('user-3');

// لكل مستخدم حده الخاص
```

### معالجة أخطاء تجاوز المعدل

```typescript
import { RateLimitError } from 'rdapify';

try {
  await client.domain('example.com');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limit exceeded!');
    console.log(`Retry after: ${error.retryAfter}ms`);
    console.log(`Suggestion: ${error.suggestion}`);

    // الانتظار ثم إعادة المحاولة
    await new Promise(resolve => setTimeout(resolve, error.retryAfter));
    await client.domain('example.com');
  }
}
```

### إعادة ضبط الحدود

```typescript
// إعادة ضبط حد مفتاح محدد
limiter.reset('user-123');

// إعادة ضبط جميع الحدود
limiter.resetAll();
```

### الحصول على الإحصائيات

```typescript
const stats = limiter.getStats();

console.log('Enabled:', stats.enabled);
console.log('Max Requests:', stats.maxRequests);
console.log('Window (ms):', stats.windowMs);
console.log('Active Keys:', stats.activeKeys);
console.log('Total Requests:', stats.totalRequests);
```

## خيارات الضبط

```typescript
interface RateLimitOptions {
  /** تفعيل تحديد المعدل */
  enabled?: boolean;

  /** الحد الأقصى للطلبات لكل نافذة زمنية */
  maxRequests?: number;

  /** النافذة الزمنية بالملي ثانية */
  windowMs?: number;
}
```

### القيم الافتراضية

```typescript
{
  enabled: false,
  maxRequests: 100,
  windowMs: 60000  // دقيقة واحدة
}
```

## أفضل الممارسات

### 1. اختر الحدود المناسبة

```typescript
// لـ API عام
const publicLimiter = new RateLimiter({
  enabled: true,
  maxRequests: 10,
  windowMs: 60000  // 10 طلبات في الدقيقة
});

// للمستخدمين المصادق عليهم
const userLimiter = new RateLimiter({
  enabled: true,
  maxRequests: 100,
  windowMs: 60000  // 100 طلب في الدقيقة
});

// للخدمات الداخلية
const internalLimiter = new RateLimiter({
  enabled: true,
  maxRequests: 1000,
  windowMs: 60000  // 1000 طلب في الدقيقة
});
```

### 2. استخدم مفاتيح ذات معنى

```typescript
// حسب معرف المستخدم
await limiter.checkLimit(`user:${userId}`);

// حسب عنوان IP
await limiter.checkLimit(`ip:${ipAddress}`);

// حسب مفتاح API
await limiter.checkLimit(`api:${apiKey}`);

// حسب المستأجر
await limiter.checkLimit(`tenant:${tenantId}`);
```

### 3. راقب الاستخدام

```typescript
// فحص الاستخدام قبل إرسال الطلب
const usage = limiter.getUsage('user-123');

if (usage.remaining < 10) {
  console.warn('Approaching rate limit!');
}

if (usage.remaining === 0) {
  const waitTime = usage.resetAt - Date.now();
  console.log(`Rate limit reached. Wait ${waitTime}ms`);
}
```

### 4. التدهور التدريجي

```typescript
async function queryWithFallback(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof RateLimitError) {
      // الرجوع إلى البيانات المخزنة مؤقتاً
      const cached = await cache.get(`domain:${domain}`);
      if (cached) {
        return cached;
      }

      // أو وضعه في قائمة الانتظار للمعالجة لاحقاً
      await queue.add({ type: 'domain', query: domain });
      throw error;
    }
    throw error;
  }
}
```

## أمثلة التكامل

### Middleware لـ Express

```typescript
import express from 'express';
import { RateLimiter, RateLimitError } from 'rdapify';

const app = express();
const limiter = new RateLimiter({
  enabled: true,
  maxRequests: 100,
  windowMs: 60000
});

app.use(async (req, res, next) => {
  try {
    await limiter.checkLimit(req.ip);
    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: error.retryAfter
      });
    } else {
      next(error);
    }
  }
});
```

### مع Redis (تطبيق مخصص)

```typescript
import { RateLimiter } from 'rdapify';
import Redis from 'ioredis';

class RedisRateLimiter extends RateLimiter {
  private redis: Redis;

  constructor(options, redisClient) {
    super(options);
    this.redis = redisClient;
  }

  async checkLimit(key: string): Promise<void> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.expire(redisKey, this.windowMs / 1000);
    }

    if (count > this.maxRequests) {
      const ttl = await this.redis.ttl(redisKey);
      throw new RateLimitError(
        'Rate limit exceeded',
        { key, limit: this.maxRequests },
        ttl * 1000
      );
    }
  }
}
```

## التنظيف

```typescript
// تحرير الموارد عند الانتهاء
limiter.destroy();
```

## انظر أيضاً

- [دليل معالجة الأخطاء](./error-handling.md)
- [دليل الأداء](./performance.md)
- [دليل المعالجة الدُفعية](./batch-processing.md)
