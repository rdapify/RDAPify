# Quick Start

## Prerequisites

- Node.js 20+
- `npm install rdapify`

---

## Your first query

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

const result = await client.domain('example.com');
console.log(result.query);           // "example.com"
console.log(result.registrar?.name); // registrar name
console.log(result.nameservers);     // ['a.iana-servers.net', 'b.iana-servers.net']
console.log(result.status);          // ['client delete prohibited', ...]
```

Every response includes a `metadata` object:

```typescript
result.metadata.source    // RDAP server URL that answered the query
result.metadata.timestamp // ISO 8601 query timestamp
result.metadata.cached    // true when served from the in-memory cache
```

Run it:

```bash
node --input-type=module < app.ts
# or after compiling:
node dist/app.js
```

---

## All five query types

```typescript
// Domain
const domain = await client.domain('example.com');
console.log(domain.nameservers);    // string[]
console.log(domain.registrar?.name);

// IP address (IPv4 or IPv6)
const ip = await client.ip('8.8.8.8');
console.log(ip.name);      // network name (e.g. "GOOGL-2")
console.log(ip.country);   // "US"
console.log(ip.startAddress, ip.endAddress);

// Autonomous System Number
const asn = await client.asn('AS15169'); // or numeric: client.asn(15169)
console.log(asn.name);     // "GOOGLE"
console.log(asn.country);

// Nameserver
const ns = await client.nameserver('ns1.google.com');
console.log(ns.ldhName);
console.log(ns.ipAddresses?.v4);

// Entity (requires explicit RDAP server — no global bootstrap for entities)
const entity = await client.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
console.log(entity.handle);
console.log(entity.vcardArray);
```

---

## Configuration

`RDAPClient` accepts an options object. All fields are optional — sensible defaults are applied.

```typescript
const client = new RDAPClient({
  // Privacy — PII redaction is enabled by default
  privacy: true,               // shorthand: enable with defaults
  // or fine-grained:
  privacy: {
    privacy: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },

  // Caching — memory cache, 1-hour TTL, 1 000 entries by default
  cache: true,                 // shorthand: enable with defaults
  // or fine-grained:
  cache: {
    strategy: 'memory',        // 'memory' | 'redis' | 'none'
    ttl: 3600,
    maxSize: 1000,
  },

  // Timeouts (milliseconds)
  timeout: 10000,              // shorthand: applies to all timeout types
  // or fine-grained:
  timeout: {
    connect: 5000,
    request: 10000,
    dns: 3000,
  },

  // Retries — exponential backoff by default
  retry: true,                 // shorthand: enable with defaults
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoff: 'exponential',    // 'linear' | 'exponential' | 'fixed'
  },

  // SSRF protection — enabled by default, blocks RFC 1918 + localhost
  ssrfProtection: true,
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    blockLinkLocal: true,
    allowedDomains: ['internal-rdap.corp.example.com'],
  },

  // Rate limiting — disabled by default
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000,
  },

  // Native Rust backend (requires rdapify-nd)
  backend: 'auto',             // 'auto' (default) | 'native' | 'typescript'

  // Bootstrap IANA URL
  bootstrapUrl: 'https://data.iana.org/rdap',

  // Include the raw RDAP server response alongside the normalized result
  includeRaw: false,
});
```

---

## Lifecycle hooks (middleware)

Register hooks via the constructor's `middleware` option or the fluent `.use()` method.

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

Hook errors are silently caught — a failing hook never breaks the query pipeline.

---

## Redis cache

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

## Debug logging

```typescript
// Write debug output to the built-in logger
const client = new RDAPClient({ debug: true });

// Or supply a custom logger:
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

## Utility methods

```typescript
// Clear the response cache and bootstrap cache
await client.clearCache();

// Clear everything (cache, metrics, logs)
await client.clearAll();

// Retrieve cache and bootstrap stats
const stats = await client.getStats();
console.log(stats.cache.size, stats.bootstrap.size);

// Retrieve performance metrics
const metrics = client.getMetrics();

// Release resources (rate limiter timers, connection pool)
client.destroy();
```

---

Next: [API Reference — RDAPClient](../api-reference/client.md)
