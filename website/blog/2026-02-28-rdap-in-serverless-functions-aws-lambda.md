---
date: 2026-02-28
slug: rdap-in-serverless-functions-aws-lambda
title: "Using RDAP in Serverless Functions: AWS Lambda, Vercel, and Cloudflare Workers"
authors: [rdapify]
tags: [serverless, aws-lambda, vercel, cloudflare, rdap, tutorial]
description: "How to use RDAPify in serverless environments — AWS Lambda, Vercel Functions, and Cloudflare Workers. Cold start optimization, edge caching, and timeout handling."
keywords: [rdap aws lambda, domain lookup serverless, vercel rdap, cloudflare workers domain lookup, serverless whois, rdap edge functions]
image: /img/rdapify-social-card.png
---
date: 2026-02-28

Serverless functions are a natural fit for RDAP lookups — stateless, scalable, and pay-per-use. But serverless brings unique challenges: cold starts, timeout limits, and stateless caching. Here's how to make RDAPify work efficiently in each major serverless environment.

<!-- truncate -->

## AWS Lambda

### Basic Lambda Handler

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

### Lambda Configuration

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

### Cold Start Optimization

Lambda cold starts add 200-500ms. Minimize them:

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

### Using Lambda with ElastiCache (Redis)

For shared caching across Lambda instances:

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

Cloudflare Workers run at the edge with V8 isolates — no Node.js, but RDAPify works:

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

## Timeout Strategy by Platform

| Platform | Max Timeout | Recommended Client Timeout |
|----------|-------------|---------------------------|
| AWS Lambda | 15 min | 8s |
| Vercel Functions | 60s (Pro) | 10s |
| Cloudflare Workers | 30s (CPU time) | 5s |
| Google Cloud Functions | 9 min | 8s |

## Serverless Best Practices Summary

1. **Initialize client outside the handler** — Reused across warm invocations
2. **Set timeouts below the function limit** — Fail fast, don't hang
3. **Use edge/distributed cache** — ElastiCache for Lambda, KV for Workers
4. **Set HTTP cache headers** — Let CDN/browser cache responses
5. **Keep bundle size small** — RDAPify is lightweight (< 100KB)
6. **Handle errors explicitly** — Return proper HTTP status codes

---
date: 2026-02-28

*RDAPify works in Node.js 20+, Deno, Bun, and browser environments. See [Multi-Environment docs](/docs/getting-started/installation).*
