---
slug: rdap-rate-limiting-best-practices
title: "RDAP Rate Limiting: Best Practices for Respectful Querying"
authors: [rdapify]
tags: [rdap, rate-limiting, best-practices, performance]
description: "How RDAP rate limiting works, what happens when you exceed limits, and how to build respectful clients that stay within bounds. Includes retry logic, backoff strategies, and queue management."
keywords: [rdap rate limit, domain lookup rate limit, rdap 429 error, respectful rdap client, rdap throttling, domain query rate]
image: /img/rdapify-social-card.png
---

RDAP servers are public infrastructure shared by everyone. Aggressive querying gets you rate-limited — or blocked entirely. Here's how rate limiting works in RDAP and how to build clients that stay within bounds.

<!-- truncate -->

## How RDAP Rate Limiting Works

RDAP uses standard HTTP rate limiting mechanisms:

### HTTP 429 Response

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

The `Retry-After` header tells you when to try again — in seconds from now.

### Rate Limit Headers

Some RDAP servers return remaining quota headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1711065600
```

## Known Rate Limits by Registry

| Registry | Approximate Limit | Notes |
|----------|------------------|-------|
| Verisign (.com/.net) | ~10 req/sec | Per IP |
| ARIN | ~10 req/sec | Per IP; higher with API key |
| RIPE NCC | ~10 req/sec | Per IP |
| APNIC | ~5 req/sec | Per IP |
| AFRINIC | ~5 req/sec | Per IP |
| LACNIC | ~5 req/sec | Per IP |

These are approximate and can change. Always respect `Retry-After` headers.

## Exponential Backoff

When you hit a rate limit, don't hammer the server repeatedly. Use exponential backoff:

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

## Request Queue with Rate Control

For bulk queries, use a queue that controls concurrency:

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

## Caching as Rate Limit Defense

Caching is the most effective rate limit mitigation:

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

**Cache hit rate target:** 90%+ in production.

## Per-Registry Rate Limiting

Different RDAP servers have different limits. Track per-server:

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

## Checklist: Rate-Limit-Safe RDAP Client

- [ ] **Cache responses** — TTL of 1-24 hours depending on data type
- [ ] **Handle 429** — Respect `Retry-After` header
- [ ] **Exponential backoff** — Don't hammer on failure
- [ ] **Queue bulk requests** — Control concurrency (3-5 concurrent max)
- [ ] **Respect per-server limits** — Different RIRs have different limits
- [ ] **Add jitter** — Randomize delays to avoid synchronized retries
- [ ] **Monitor hit rates** — Track and alert on unusual 429 rates
- [ ] **Use official APIs** — Some registries offer higher limits with API keys

## Conclusion

Respectful RDAP querying isn't just good etiquette — it keeps your application working reliably. Implement caching, backoff, and queue management, and you'll rarely see a 429 response.

---

*RDAPify handles backoff and `Retry-After` automatically. See the [client documentation](/docs/api-reference/client).*
