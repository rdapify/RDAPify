# RDAPClient

`RDAPClient` is the primary entry point for all RDAP queries. It implements the hexagonal architecture's application layer, orchestrating caching, SSRF protection, normalization, PII redaction, retries, middleware hooks, and an optional Rust native backend.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();                       // all defaults
const client = new RDAPClient({ cache: false });       // disable cache
const client = new RDAPClient({ privacy: false });     // disable PII redaction
```

---

## Constructor

```typescript
new RDAPClient(options?: RDAPClientOptions)
```

All options are optional. When omitted the defaults documented below are used.

---

## Constructor Options

### `cache`

**Type:** `boolean | CacheOptions` — **Default:** `{ strategy: 'memory', ttl: 3600, maxSize: 1000 }`

Controls the response cache. `true` enables the in-memory cache with defaults; `false` disables it.

```typescript
interface CacheOptions {
  strategy?: 'memory' | 'redis' | 'none';
  ttl?: number;          // seconds; default 3600
  maxSize?: number;      // max entries for memory strategy; default 1000
  redisUrl?: string;     // connection string when strategy is 'redis'
  redisClient?: RedisClientLike; // existing ioredis / node-redis instance
  keyPrefix?: string;    // Redis key prefix; default 'rdapify:'
  customCache?: unknown; // custom ICachePort implementation
}
```

### `retry`

**Type:** `boolean | RetryOptions` — **Default:** exponential backoff, 3 attempts

`true` enables retries with defaults; `false` disables retries entirely.

```typescript
interface RetryOptions {
  maxAttempts?: number;              // default 3
  initialDelay?: number;             // ms; default 1000
  maxDelay?: number;                 // ms; default 10000
  backoff?: 'linear' | 'exponential' | 'fixed'; // default 'exponential'
  retryableStatusCodes?: number[];   // default [408, 429, 500, 502, 503, 504]
}
```

### `ssrfProtection`

**Type:** `boolean | SSRFProtectionOptions` — **Default:** enabled, blocks private IPs and localhost

`false` disables SSRF protection entirely (not recommended in production).

```typescript
interface SSRFProtectionOptions {
  enabled?: boolean;
  blockPrivateIPs?: boolean;    // RFC 1918 ranges; default true
  blockLocalhost?: boolean;     // 127.0.0.1 / ::1; default true
  blockLinkLocal?: boolean;     // 169.254.x.x; default true
  blockedDomains?: string[];    // additional domains to reject
  allowedDomains?: string[];    // whitelist (takes priority over block rules)
}
```

### `privacy`

**Type:** `boolean | PrivacyOptions` — **Default:** enabled, redacts `email`, `phone`, `fax`

Controls automatic PII redaction. `false` disables it; `true` enables with defaults.

```typescript
interface PrivacyOptions {
  redactPII?: boolean;
  redactFields?: string[];     // default ['email', 'phone', 'fax']
  redactionText?: string;      // replacement value; default '[REDACTED]'
}
```

### `timeout`

**Type:** `number | TimeoutOptions` — **Default:** `{ connect: 5000, request: 10000, dns: 3000 }`

A single number is applied to all three timeout types simultaneously.

```typescript
interface TimeoutOptions {
  connect?: number;  // TCP connect timeout in ms
  request?: number;  // full request timeout in ms
  dns?: number;      // DNS resolution timeout in ms
}
```

### `logging`

**Type:** `LoggingOptions` — **Default:** `{ level: 'warn' }`

```typescript
interface LoggingOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  logger?: (level: LogLevel, message: string, meta?: unknown) => void;
}
```

### `rateLimit`

**Type:** `boolean | RateLimitOptions` — **Default:** disabled

```typescript
interface RateLimitOptions {
  enabled?: boolean;
  maxRequests?: number;  // default 100
  windowMs?: number;     // default 60000 (1 minute)
}
```

### `debug`

**Type:** `boolean | DebugOptions` — **Default:** disabled

`true` enables debug output to the built-in logger. Pass an object to supply a custom logger.

```typescript
interface DebugOptions {
  enabled?: boolean;
  logger?: {
    debug: (message: string, metadata?: Record<string, unknown>) => void;
    info:  (message: string, metadata?: Record<string, unknown>) => void;
    warn:  (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, metadata?: Record<string, unknown>) => void;
  };
}
```

### `backend`

**Type:** `'auto' | 'native' | 'typescript'` — **Default:** `'auto'`

Selects the query execution backend.

| Value | Behaviour |
|-------|-----------|
| `'auto'` | Uses the Rust native backend if `rdapify-nd` is installed; falls back to TypeScript silently |
| `'native'` | Always uses the Rust backend; throws at construction time if `rdapify-nd` is absent |
| `'typescript'` | Always uses the TypeScript backend, even when `rdapify-nd` is present |

The native backend processes the five core query methods in compiled Rust. Middleware hooks, rate limiting, audit logging, and other TypeScript-layer features are bypassed when the native backend is active.

### `deduplication`

**Type:** `boolean | { windowMs?: number }` — **Default:** disabled

When enabled, concurrent in-flight queries for the same target are collapsed into a single network request within the deduplication window.

```typescript
client = new RDAPClient({ deduplication: true });          // 100 ms window
client = new RDAPClient({ deduplication: { windowMs: 250 } });
```

### `middleware`

**Type:** `MiddlewareHooksConfig` — **Default:** `{}`

Register lifecycle hooks at construction time. Equivalent to calling `.use()` immediately after construction.

### Other options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `userAgent` | `string` | `'RDAPify/0.1.8 (https://rdapify.com)'` | `User-Agent` header sent to RDAP servers |
| `includeRaw` | `boolean` | `false` | Attach the raw RDAP server response on `result.raw` |
| `followRedirects` | `boolean` | `true` | Follow HTTP redirects |
| `maxRedirects` | `number` | `5` | Maximum redirects per request |
| `headers` | `Record<string, string>` | `{}` | Additional HTTP headers |
| `bootstrapUrl` | `string` | `'https://data.iana.org/rdap'` | IANA bootstrap base URL |

---

## Query Methods

All five query methods are `async` and resolve to a normalized response object. Each response carries a `metadata` object:

```typescript
metadata: {
  source: string;    // RDAP server URL that answered the query
  timestamp: string; // ISO 8601 timestamp
  cached: boolean;   // true when served from cache
}
```

---

### `domain(domain)`

```typescript
domain(domain: string): Promise<DomainResponse>
```

Queries registration data for a domain name. The RDAP server is discovered automatically from the IANA bootstrap registry.

```typescript
const result = await client.domain('example.com');

result.query                // "example.com"
result.objectClass          // "domain"
result.handle               // registry handle (optional)
result.ldhName              // LDH form of the domain
result.unicodeName          // Unicode form (IDN)
result.status               // RDAPStatus[]
result.nameservers          // string[] — delegated nameservers
result.registrar?.name      // sponsoring registrar name
result.registrar?.handle
result.registrar?.url
result.entities             // RDAPEntity[] — registrant, admin, tech contacts, etc.
result.events               // RDAPEvent[] — registration, expiration, last changed
result.links                // RDAPLink[]
result.remarks              // RDAPRemark[]
result.raw                  // raw RDAP response (only when includeRaw: true)
result.metadata             // { source, timestamp, cached }
```

---

### `ip(ip)`

```typescript
ip(ip: string): Promise<IPResponse>
```

Queries RDAP data for an IPv4 or IPv6 address. The authoritative Regional Internet Registry is discovered from the IANA bootstrap registry.

```typescript
const result = await client.ip('8.8.8.8');

result.query          // "8.8.8.8"
result.objectClass    // "ip network"
result.handle         // network handle (e.g. "NET-8-8-8-0-2")
result.startAddress   // first address in the allocation
result.endAddress     // last address in the allocation
result.ipVersion      // "v4" | "v6"
result.name           // network name (e.g. "GOOGL-2")
result.type           // allocation type
result.country        // ISO 3166-1 alpha-2 country code
result.status         // RDAPStatus[]
result.entities       // RDAPEntity[]
result.events         // RDAPEvent[]
result.metadata       // { source, timestamp, cached }
```

---

### `asn(asn)`

```typescript
asn(asn: string | number): Promise<ASNResponse>
```

Queries RDAP data for an Autonomous System Number. Accepts a bare number (`15169`) or the `AS`-prefixed string form (`"AS15169"`).

```typescript
const result = await client.asn('AS15169');
// or:
const result = await client.asn(15169);

result.query          // "AS15169"
result.objectClass    // "autnum"
result.handle
result.startAutnum    // first ASN in the range
result.endAutnum      // last ASN in the range
result.name           // e.g. "GOOGLE"
result.type
result.country        // ISO 3166-1 alpha-2
result.status         // RDAPStatus[]
result.entities       // RDAPEntity[]
result.events         // RDAPEvent[]
result.metadata       // { source, timestamp, cached }
```

---

### `nameserver(nameserver)`

```typescript
nameserver(nameserver: string): Promise<NameserverResponse>
```

Queries RDAP data for a nameserver hostname.

```typescript
const result = await client.nameserver('ns1.google.com');

result.query             // "ns1.google.com"
result.objectClass       // "nameserver"
result.ldhName
result.unicodeName
result.status            // RDAPStatus[]
result.ipAddresses?.v4   // string[] — IPv4 glue records
result.ipAddresses?.v6   // string[] — IPv6 glue records
result.entities          // RDAPEntity[]
result.events            // RDAPEvent[]
result.metadata          // { source, timestamp, cached }
```

---

### `entity(handle, serverUrl)`

```typescript
entity(handle: string, serverUrl: string): Promise<EntityResponse>
```

Queries RDAP data for an entity (contact, registrar, or registrant) by handle. There is no global IANA bootstrap registry for entities, so an explicit RDAP server URL is required.

```typescript
const result = await client.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');

result.query          // "ARIN-HN-1"
result.objectClass    // "entity"
result.handle
result.vcardArray     // vCard 4.0 array representation
result.roles          // RoleType[]
result.status         // RDAPStatus[]
result.entities       // RDAPEntity[] — sub-entities
result.events         // RDAPEvent[]
result.metadata       // { source, timestamp, cached }
```

---

## Lifecycle Hooks

Register hooks via the constructor `middleware` option or the fluent `.use()` method. Hooks run synchronously or asynchronously; errors are silently caught and never interrupt the query pipeline.

```typescript
client.use({
  beforeQuery(ctx) {
    // ctx.queryType: 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity'
    // ctx.query:     the raw input string
    // ctx.startTime: Date.now() at query start
  },
  afterQuery(ctx) {
    // ctx.duration:  elapsed milliseconds
    // ctx.fromCache: true when result was served from cache
    // ctx.result:    the RDAPResponse
  },
  onError(ctx) {
    // ctx.error: the thrown Error
  },
  onCacheHit(ctx)  { /* ctx.query */ },
  onCacheMiss(ctx) { /* ctx.query */ },
  onRetry(ctx) {
    // ctx.attempt: current attempt number
    // ctx.delay:   backoff delay in ms before this retry
  },
});
```

`.use()` returns `this`, enabling chaining:

```typescript
client
  .use({ beforeQuery: (ctx) => logger.info('start', ctx.query) })
  .use({ afterQuery:  (ctx) => logger.info('done', ctx.duration) });
```

---

## Utility Methods

### `clearCache()`

```typescript
clearCache(): Promise<void>
```

Clears the response cache and the bootstrap discovery cache.

---

### `clearAll()`

```typescript
clearAll(): Promise<void>
```

Clears the response cache, bootstrap cache, collected metrics, and in-memory logs.

---

### `getStats()`

```typescript
getStats(): Promise<{
  cache: { size: number; enabled: boolean; ttl: number };
  bootstrap: { size: number; types: string[] };
}>
```

Returns current cache and bootstrap statistics.

---

### `getMetrics(since?)`

```typescript
getMetrics(since?: number): MetricsSummary
```

Returns a performance summary for all queries. The optional `since` parameter is a Unix timestamp (ms) to filter metrics from that point forward.

---

### `getConnectionPoolStats()`

```typescript
getConnectionPoolStats(): ConnectionPoolStats
```

Returns statistics for the internal HTTP connection pool.

---

### `getConfig()`

```typescript
getConfig(): Required<RDAPClientOptions>
```

Returns the merged configuration (user options deep-merged with defaults).

---

### `getRateLimiter()`

```typescript
getRateLimiter(): RateLimiter
```

Returns the internal `RateLimiter` instance for inspection or programmatic control.

---

### `getBatchProcessor()`

```typescript
getBatchProcessor(): BatchProcessor
```

Returns the internal `BatchProcessor` for advanced batch query patterns.

---

### `getDeduplicatorStats()`

```typescript
getDeduplicatorStats(): DeduplicatorStats
```

Returns deduplication statistics (pending queries, coalesced request counts).

---

### `getLogger()`

```typescript
getLogger(): Logger
```

Returns the internal `Logger` instance.

---

### `getLogs(count?)`

```typescript
getLogs(count?: number): LogEntry[]
```

Returns recent log entries. `count` limits the number of entries returned.

---

### `getMiddlewareManager()`

```typescript
getMiddlewareManager(): MiddlewareManager
```

Returns the `MiddlewareManager` for introspecting registered hooks or clearing them programmatically.

---

### `destroy()`

```typescript
destroy(): void
```

Releases resources held by the client — rate limiter timers and the connection pool. Call this when the client will no longer be used (e.g., in test teardown or process shutdown handlers).

---

## Response Entity Types

All five response types include the following shared entity sub-types:

```typescript
interface RDAPEvent {
  eventAction: string;   // e.g. "registration", "expiration", "last changed"
  eventDate: string;     // ISO 8601 datetime string
  links?: RDAPLink[];
}

interface RDAPEntity {
  handle?: string;
  objectClass: string;
  roles?: string[];
  vcardArray?: any[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
}

interface RDAPLink {
  value: string;
  rel: string;
  href: string;
  type?: string;
}

interface RDAPRemark {
  title?: string;
  description: string[];
  links?: RDAPLink[];
}
```

---

## Error Handling

All query methods throw typed errors on failure:

| Error class | Cause |
|-------------|-------|
| `ValidationError` | Invalid input (malformed domain, IP, ASN) |
| `SSRFError` | Query target blocked by SSRF protection |
| `BootstrapError` | Failed to discover the authoritative RDAP server |
| `FetchError` | Network error or non-2xx response after all retries |
| `NativeBackendError` | `rdapify-nd` unavailable and `backend: 'native'` was set |

```typescript
import { ValidationError, FetchError } from 'rdapify';

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('bad input:', error.message);
  } else if (error instanceof FetchError) {
    console.error('network error:', error.message);
  }
}
```

---

Next: [Privacy Controls](./privacy-controls.md)
