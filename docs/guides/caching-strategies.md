# Caching Strategies

RDAPify includes a built-in response cache that eliminates redundant network calls to RDAP registries. This guide covers all supported strategies, configuration patterns, and operational considerations.

---

## Why caching matters for RDAP

RDAP queries involve a network round-trip to an external registry — typically 100–400 ms. Registries also enforce rate limits. Caching provides:

- **Performance** — cache hits return in < 5 µs vs. ~180 µs for a live query (see [benchmarks](../performance/benchmarks.md))
- **Resilience** — serve results during transient registry outages
- **Rate-limit compliance** — reduce outbound query volume

---

## Cache strategies

RDAPify supports three strategies, controlled by `cache.strategy`:

| Strategy | Description | Use case |
|----------|-------------|----------|
| `'memory'` | In-process LRU cache (default) | Single-process applications |
| `'redis'` | Redis-backed cache | Multi-process / distributed deployments |
| `'none'` | Caching disabled | Testing, debugging, always-fresh data |

---

## Configuration

### Memory cache (default)

```typescript
const client = new RDAPClient();
// Equivalent to:
const client = new RDAPClient({
  cache: {
    strategy: 'memory',
    ttl: 3600,      // seconds; default 1 hour
    maxSize: 1000,  // max entries; default 1000
  },
});
```

### Disable cache

```typescript
const client = new RDAPClient({ cache: false });
// or:
const client = new RDAPClient({ cache: { strategy: 'none' } });
```

### Redis cache

```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'rdapify:',   // default 'rdapify:'
    ttl: 3600,
  },
});
```

`redisClient` accepts any `ioredis` or `node-redis` compatible client. The library uses the minimal interface (`get`, `set`, `del`) — no cluster-specific commands required.

---

## TTL guidance

Registration data changes infrequently. Recommended TTL values:

| Data type | Suggested TTL | Rationale |
|-----------|---------------|-----------|
| Domain data | 1–24 h | Registrations rarely change intra-day |
| IP network | 6–24 h | Allocations are stable |
| ASN data | 6–24 h | Allocations are stable |
| Nameserver | 1–6 h | Can change more frequently |

For security monitoring where freshness matters, use a lower TTL:

```typescript
const client = new RDAPClient({
  cache: { strategy: 'memory', ttl: 300 }, // 5 minutes
});
```

---

## Cache warming

Pre-populate the cache on startup for known-critical queries:

```typescript
const criticalDomains = ['example.com', 'example.org', 'iana.org'];

await Promise.allSettled(
  criticalDomains.map(d =>
    client.domain(d).catch(e => console.warn(`warm failed for ${d}:`, e.message)),
  ),
);
```

---

## Inspecting cache state

```typescript
const stats = await client.getStats();

console.log(stats.cache.size);    // number of entries in the cache
console.log(stats.cache.enabled); // true / false
console.log(stats.cache.ttl);     // configured TTL in seconds
```

Each response also carries `metadata.cached`:

```typescript
const r1 = await client.domain('example.com');
console.log(r1.metadata.cached); // false — first call

const r2 = await client.domain('example.com');
console.log(r2.metadata.cached); // true — served from cache
```

---

## Cache invalidation

Clear the response cache and the bootstrap discovery cache:

```typescript
await client.clearCache();
```

Clear everything (cache, metrics, in-memory logs):

```typescript
await client.clearAll();
```

There is no per-key invalidation API. If you need to force-refresh a specific domain, clear the entire cache and re-query.

---

## Lifecycle hook integration

Monitor cache behaviour with middleware hooks:

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

## Redis in production

Minimal hardened configuration:

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

Recommendations:

- **Use TLS** — RDAP responses may contain organisation names and contact handles.
- **Set a key prefix** — avoids collisions with other services sharing the Redis instance.
- **Handle disconnects** — wrap queries in try/catch; a Redis connection error causes a cache miss and falls through to a live query.

---

## Cloudflare Workers

The in-memory cache works on Cloudflare Workers. File-based cache strategies are not applicable; use `strategy: 'memory'` (default) or `strategy: 'none'`. Redis is supported if your Redis instance is accessible from the Worker.

---

## Testing

For unit tests, disable caching to ensure each test calls the mock network layer:

```typescript
const client = new RDAPClient({ cache: false });
```

Or use a very short TTL to test cache expiry:

```typescript
const client = new RDAPClient({ cache: { ttl: 1 } }); // 1 second
```

---

## See also

- [RDAPClient — `cache` option](../api-reference/client.md#cache)
- [Options types — `CacheOptions`](../api-reference/types/options.md#cacheoptions)
- [Performance benchmarks](../performance/benchmarks.md)
