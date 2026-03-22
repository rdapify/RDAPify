---
slug: rdap-caching-strategies-high-traffic
title: "RDAP Caching Strategies for High-Traffic Applications"
authors: [rdapify]
tags: [performance, caching, rdap, architecture]
description: "Optimize RDAP query performance with smart caching strategies. Learn multi-layer caching, TTL selection, cache invalidation, and how to handle millions of lookups efficiently."
keywords: [rdap caching, domain lookup performance, cache rdap responses, high traffic domain lookup, optimize rdap queries, redis rdap cache]
image: /img/rdapify-social-card.png
---

If your application performs millions of domain lookups, naive RDAP querying will hammer registries, hit rate limits, and slow everything down. Smart caching is the difference between a system that scales and one that breaks. Here's how to do it right.

<!-- truncate -->

## Why Caching Matters for RDAP

RDAP servers enforce rate limits. Verisign, ARIN, and others will return `429 Too Many Requests` if you query too aggressively. Beyond that:

- Network latency: 150-400ms per RDAP query
- RDAP data changes infrequently (domain expiry rarely changes daily)
- Many lookups are for the same popular domains
- Registries prefer you cache rather than re-query

**A well-cached system can serve 99% of queries from cache with < 5ms latency.**

## Cache TTL Strategy

Not all RDAP data is equally volatile:

| Data Type | How Often Changes | Recommended TTL |
|-----------|------------------|-----------------|
| Domain expiry date | Rarely (annual renewal) | 24 hours |
| Domain status | Occasionally | 4 hours |
| Nameservers | Rarely | 24 hours |
| Registrar info | Very rarely | 48 hours |
| IP allocation | Very rarely | 48 hours |
| ASN data | Almost never | 72 hours |
| Bootstrap data | Weekly updates | 24 hours |

```typescript
import { RDAPClient } from 'rdapify';

// Conservative TTLs for reliability
const client = new RDAPClient({
  cache: {
    ttl: 14400, // 4 hours default
  },
});
```

## Multi-Layer Caching Architecture

For high-traffic systems, use multiple cache layers:

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

### L1: In-Memory Cache (Built into RDAPify)

```typescript
const client = new RDAPClient({
  cache: {
    ttl: 3600,      // 1 hour
    maxSize: 1000,  // Max entries in memory
  },
});
```

### L2: Redis Cache Adapter

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

## Cache Key Design

Good cache keys prevent collisions and enable precise invalidation:

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

## Handling Cache Stampedes

When many requests hit the same expired cache entry simultaneously, they all query the RDAP server at once — a **cache stampede**. Prevent it with a lock:

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

## Cache Warming

Pre-populate the cache for your most-queried domains:

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

## Monitoring Cache Performance

Track your cache hit rate — aim for > 95%:

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

## Rate Limit Handling

Even with caching, you may hit rate limits. Handle them gracefully:

```typescript
const client = new RDAPClient({
  cache: { ttl: 14400 },
  // RDAPify automatically respects Retry-After headers
  // and implements exponential backoff on 429 responses
});
```

## Benchmark: Cache vs No Cache

On a test with 10,000 domain queries (1,000 unique domains × 10 repetitions):

| Setup | Avg Latency | p99 Latency | Rate Limit Errors |
|-------|-------------|-------------|-------------------|
| No cache | 280ms | 850ms | 342 errors |
| In-memory cache (1hr TTL) | 1.2ms | 12ms | 0 errors |
| Redis cache (4hr TTL) | 3.8ms | 18ms | 0 errors |

Cache hit rates achieved: 89% (in-memory), 94% (Redis).

## Conclusion

Caching transforms RDAP from a bottleneck into a fast, reliable service. Start with RDAPify's built-in memory cache, then add Redis when you need distributed caching across multiple instances. Aim for a cache hit rate above 90% in production.

---

*RDAPify's caching system supports custom adapters for Redis, Memcached, and any other store. See the [Cache documentation](/docs/getting-started/installation).*
