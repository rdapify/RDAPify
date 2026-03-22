---
slug: rdap-in-serverless-functions-aws-lambda
title: "استخدام RDAP في الدوال بلا خادم: AWS Lambda وVercel وCloudflare Workers"
authors: [rdapify]
tags: [serverless, aws-lambda, vercel, cloudflare, rdap, tutorial]
description: "كيفية استخدام RDAPify في البيئات بلا خادم — AWS Lambda ودوال Vercel وCloudflare Workers. تحسين بدء التشغيل البارد، والتخزين المؤقت على الحافة، ومعالجة المهلات."
keywords: [rdap aws lambda, domain lookup serverless, vercel rdap, cloudflare workers domain lookup, serverless whois, rdap edge functions]
image: /img/rdapify-social-card.png
---

الدوال بلا خادم تُناسب طبيعة استعلامات RDAP بشكل طبيعي — بلا حالة، وقابلة للتوسع، وتدفع فقط مقابل الاستخدام. لكن البيئات بلا خادم تجلب تحديات فريدة: بدء التشغيل البارد، وحدود المهلة، والتخزين المؤقت بلا حالة. إليك كيفية جعل RDAPify يعمل بكفاءة في كل بيئة رئيسية بلا خادم.

<!-- truncate -->

## AWS Lambda

### معالج Lambda الأساسي

```typescript
// handler.ts
import { RDAPClient } from 'rdapify';

// Initialize client outside handler — reused across warm invocations
const client = new RDAPClient({
  cache: { ttl: 3600 },
  timeout: 8000, // Under Lambda's 10s default timeout
});

export const handler = async (event: any) => {
  const domain = event.queryStringParameters?.domain;

  if (!domain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing domain parameter' }),
    };
  }

  try {
    const result = await client.domain(domain.toLowerCase());

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600', // Browser caching
      },
      body: JSON.stringify({
        domain: result.ldhName,
        status: result.status,
        expires: result.events?.find(e => e.eventAction === 'expiration')?.eventDate,
        nameservers: result.nameservers?.map(ns => ns.ldhName),
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### إعداد Lambda

```yaml
# serverless.yml (Serverless Framework)
functions:
  rdapLookup:
    handler: dist/handler.handler
    timeout: 15          # seconds
    memorySize: 256      # MB — RDAP client is lightweight
    environment:
      NODE_ENV: production
    events:
      - http:
          path: /lookup
          method: get
          cors: true
```

### تحسين بدء التشغيل البارد

تُضيف حالات البدء البارد لـ Lambda من 200 إلى 500 مللي ثانية. قلّل منها:

```typescript
// Avoid heavy imports at the top level
// BAD: imported even if not used
import { SomeHeavyLibrary } from 'heavy-lib';

// GOOD: import at module level (Lambda caches the module)
import { RDAPClient } from 'rdapify';

// Initialize once per container, not per invocation
const client = new RDAPClient({ cache: { ttl: 3600 } });

export const handler = async (event: any) => {
  // client is already initialized — no cold start penalty here
  return client.domain(event.domain);
};
```

### استخدام Lambda مع ElastiCache (Redis)

للتخزين المؤقت المشترك عبر حالات Lambda:

```typescript
import { RDAPClient } from 'rdapify';
import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient>;

async function getRedis() {
  if (!redisClient) {
    redisClient = createClient({
      url: `redis://${process.env.REDIS_HOST}:6379`,
      socket: { connectTimeout: 1000 },
    });
    await redisClient.connect();
  }
  return redisClient;
}

export const handler = async (event: any) => {
  const redis = await getRedis();

  const rdapClient = new RDAPClient({
    cache: {
      adapter: {
        get: async (key) => {
          const v = await redis.get(`rdap:${key}`);
          return v ? JSON.parse(v) : undefined;
        },
        set: async (key, value, ttl) => {
          await redis.setEx(`rdap:${key}`, ttl, JSON.stringify(value));
        },
        delete: async (key) => { await redis.del(`rdap:${key}`); },
      },
      ttl: 3600,
    },
  });

  return rdapClient.domain(event.domain);
};
```

## Vercel Functions

```typescript
// api/rdap.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { ttl: 3600 },
  timeout: 8000,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { domain, ip, asn } = req.query;

  // Set Vercel Edge Cache headers
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    if (domain) {
      const result = await client.domain(String(domain));
      return res.json({ type: 'domain', data: result });
    }

    if (ip) {
      const result = await client.ip(String(ip));
      return res.json({ type: 'ip', data: result });
    }

    if (asn) {
      const result = await client.asn(parseInt(String(asn)));
      return res.json({ type: 'asn', data: result });
    }

    return res.status(400).json({ error: 'Provide domain, ip, or asn parameter' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
```

```json
// vercel.json
{
  "functions": {
    "api/rdap.ts": {
      "maxDuration": 15
    }
  }
}
```

## Cloudflare Workers

يعمل Cloudflare Workers على الحافة باستخدام عوازل V8 — بدون Node.js، لكن RDAPify يعمل:

```typescript
// worker.ts
import { RDAPClient } from 'rdapify';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return Response.json({ error: 'Missing domain' }, { status: 400 });
    }

    // Use Cloudflare's Cache API
    const cacheKey = new Request(`https://cache.internal/rdap/${domain}`);
    const cache = caches.default;

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      const client = new RDAPClient({ timeout: 5000 });
      const result = await client.domain(domain);

      const response = Response.json({
        domain: result.ldhName,
        status: result.status,
        expires: result.events?.find(e => e.eventAction === 'expiration')?.eventDate,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      });

      // Store in Cloudflare edge cache
      await cache.put(cacheKey, response.clone());

      return response;
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 502 });
    }
  },
};
```

```toml
# wrangler.toml
name = "rdap-worker"
main = "worker.ts"
compatibility_date = "2024-01-01"
```

## استراتيجية المهلة حسب المنصة

| المنصة | الحد الأقصى للمهلة | مهلة العميل الموصى بها |
|----------|-------------|---------------------------|
| AWS Lambda | 15 دقيقة | 8 ثوان |
| Vercel Functions | 60 ثانية (Pro) | 10 ثوان |
| Cloudflare Workers | 30 ثانية (وقت CPU) | 5 ثوان |
| Google Cloud Functions | 9 دقائق | 8 ثوان |

## ملخص أفضل الممارسات للبيئات بلا خادم

1. **تهيئة العميل خارج المعالج** — تُعاد استخدامه عبر الاستدعاءات الدافئة
2. **تعيين مهلات دون حد الدالة** — الفشل السريع، وعدم التعليق
3. **استخدام كاش الحافة/الموزع** — ElastiCache لـ Lambda، KV لـ Workers
4. **تعيين رؤوس HTTP للكاش** — دع CDN/المتصفح يخزن الاستجابات مؤقتًا
5. **إبقاء حجم الحزمة صغيرًا** — RDAPify خفيف الوزن (أقل من 100KB)
6. **معالجة الأخطاء صراحةً** — إعادة رموز حالة HTTP المناسبة

---

*يعمل RDAPify في Node.js 20+، وDeno، وBun، وبيئات المتصفح. راجع [وثائق بيئات متعددة](/docs/getting-started/installation).*
