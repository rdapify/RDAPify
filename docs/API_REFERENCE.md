# API Reference

**Package:** `rdapify`
**Version:** 0.3.2
**License:** MIT

> **Stability:** Pre-1.0.0. Core query methods, response shapes, and error types are stable.
> APIs marked **(evolving)** may change before v1.0.0.
> See [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) for the full 0.x → 1.0.0 upgrade plan.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Quick Example](#2-quick-example)
3. [RDAPClient](#3-rdapclient)
4. [Query Methods](#4-query-methods)
5. [Configuration](#5-configuration)
6. [Error Handling](#6-error-handling)
7. [Metrics & Monitoring](#7-metrics--monitoring)
8. [Middleware System](#8-middleware-system)
9. [Pro Plugin Integration](#9-pro-plugin-integration)
10. [Types & Interfaces](#10-types--interfaces)
11. [Environment Variables](#11-environment-variables)
12. [Advanced Examples](#12-advanced-examples)

---

## 1. Installation

### npm

```bash
npm install rdapify
```

### Bun

```bash
bun add rdapify
```

### Deno

```typescript
// deno.json
{
  "imports": {
    "rdapify": "npm:rdapify@^0.3.2"
  }
}
```

### Browser

rdapify works in browser environments via `BrowserFetcher`, which routes requests
through a developer-supplied CORS-enabled reverse proxy.

```typescript
import { RDAPClient, BrowserFetcher } from 'rdapify';

const fetcher = new BrowserFetcher({ proxyUrl: 'https://your-proxy.example.com/rdap' });
const client = new RDAPClient({ backend: 'typescript' });
```

> Note: SSRF protection is enforced on the proxy side. Never expose a RDAP proxy
> without SSRF protection on the server.

### Python Binding

```bash
pip install rdapify-py
```

```python
import rdapify_py as rdap

result = rdap.domain("example.com")
print(result["registrar"]["name"])
```

### Rust Crate

```toml
# Cargo.toml
[dependencies]
rdapify = "0.2"
```

```rust
use rdapify::RdapClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = RdapClient::new();
    let domain = client.domain("example.com").await?;
    println!("{:?}", domain.registrar);
    Ok(())
}
```

### Node.js Native Binding (optional — higher performance)

```bash
npm install rdapify rdapify-nd
```

When `rdapify-nd` is installed, `RDAPClient` uses it automatically in `'auto'` mode.
Set `backend: 'native'` to require it or `backend: 'typescript'` to disable it.

---

## 2. Quick Example

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

const domain = await client.domain('example.com');

console.log(domain.registrar?.name);   // 'RESERVED-Internet Assigned Numbers Authority'
console.log(domain.nameservers);       // ['a.iana-servers.net', 'b.iana-servers.net']
console.log(domain.status);            // ['client delete prohibited', ...]
console.log(domain.metadata.cached);  // false (first query)
```

---

## 3. RDAPClient

### Constructor

```typescript
new RDAPClient(options?: RDAPClientOptions)
```

Creates a new RDAP client. All options are optional — the client works with zero
configuration using secure defaults (memory cache, SSRF protection, retry, PII redaction).

```typescript
import { RDAPClient } from 'rdapify';

// Zero-config — safe defaults applied automatically
const client = new RDAPClient();

// Full configuration
const client = new RDAPClient({
  cache: { strategy: 'redis', redisClient: redis, ttl: 7200 },
  retry: { maxAttempts: 3, backoff: 'exponential' },
  rateLimit: { enabled: true, maxRequests: 50, windowMs: 60_000 },
  timeout: { request: 15_000, connect: 5_000 },
  logging: { level: 'warn' },
});
```

### Options

All options are optional. See [§5 Configuration](#5-configuration) for detailed documentation
of each option group.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cache` | `boolean \| CacheOptions` | `{ strategy: 'memory', ttl: 3600 }` | Response cache |
| `retry` | `boolean \| RetryOptions` | `{ maxAttempts: 3, backoff: 'exponential' }` | Retry on failure |
| `ssrfProtection` | `boolean \| SSRFProtectionOptions` | `{ enabled: true }` | Block private IPs |
| `privacy` | `boolean \| PrivacyOptions` | `{ redactPII: true }` | PII redaction |
| `timeout` | `number \| TimeoutOptions` | `{ request: 10_000, connect: 5_000 }` | Request timeouts |
| `logging` | `LoggingOptions` | `{ level: 'warn' }` | Log level |
| `rateLimit` | `boolean \| RateLimitOptions` | `{ enabled: false }` | Client-side rate limit |
| `debug` | `boolean \| DebugOptions` | `false` | Verbose debug output |
| `circuitBreaker` | `CircuitBreakerConfig \| false` | `{}` (enabled) | Per-registry circuit breaker |
| `backend` | `'auto' \| 'native' \| 'typescript'` | `'auto'` | Query execution backend |
| `bootstrap` | `BootstrapOptions` | `{ ttl: 86400, fallback: true }` | IANA bootstrap configuration |
| `telemetry` | `TelemetryOptions` | `{ enabled: false }` | OpenTelemetry tracing |
| `deduplication` | `boolean \| DeduplicationConfig` | `false` | In-flight deduplication |
| `http2` | `boolean` | `false` | HTTP/2 preference |
| `includeRaw` | `boolean` | `false` | Include raw RDAP response |
| `followRedirects` | `boolean` | `true` | Follow HTTP redirects |
| `maxRedirects` | `number` | `5` | Maximum redirect hops |
| `userAgent` | `string` | `RDAPify/{version}` | Custom User-Agent header |
| `headers` | `Record<string, string>` | `{}` | Additional HTTP headers |
| `signal` | `AbortSignal` | `undefined` | Cancellation signal |
| `usageTelemetry` | `{ enabled?: boolean; endpoint?: string }` | `{ enabled: false }` | Anonymous usage stats (opt-in) |

### Default Options

```typescript
const DEFAULT_OPTIONS = {
  cache: {
    strategy: 'memory',
    ttl: 3600,      // 1 hour
    maxSize: 1000,
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10_000,
    backoff: 'exponential',
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    blockLinkLocal: true,
    blockedDomains: [],
    allowedDomains: [],
    dnsRebinding: false,
  },
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },
  timeout: {
    connect: 5000,
    request: 10_000,
    dns: 3000,
  },
  logging: { level: 'warn' },
  rateLimit: { enabled: false, maxRequests: 100, windowMs: 60_000 },
  deduplication: false,
  backend: 'auto',
  http2: false,
  includeRaw: false,
  followRedirects: true,
  maxRedirects: 5,
};
```

### Instance Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `domain(name)` | `Promise<DomainResponse>` | Query domain RDAP data |
| `ip(address)` | `Promise<IPResponse>` | Query IP address RDAP data |
| `asn(number)` | `Promise<ASNResponse>` | Query Autonomous System RDAP data |
| `nameserver(hostname)` | `Promise<NameserverResponse>` | Query nameserver RDAP data |
| `entity(handle, serverUrl)` | `Promise<EntityResponse>` | Query entity RDAP data |
| `checkAvailability(domain)` | `Promise<AvailabilityResult>` | Check domain availability |
| `checkAvailabilityBatch(domains)` | `Promise<Map<string, AvailabilityResult>>` | Batch availability check |
| `searchDomains(pattern, serverUrl?)` | `Promise<SearchResult<DomainResponse>>` | Search domains by pattern |
| `searchEntities(pattern, serverUrl)` | `Promise<SearchResult<EntityResponse>>` | Search entities by pattern |
| `streamBatch(requests, options?)` | `AsyncGenerator<BatchQueryResult>` | Stream batch query results |
| `explain(query)` | `Promise<ExplainResult>` | Debug query pipeline without a real request |
| `validate()` | `Promise<ValidationResult>` | Validate client configuration |
| `getMetrics(since?)` | `MetricsSummary` | Get query metrics |
| `getCircuitBreakerStats()` | `Record<string, { state: string }>` | Get circuit breaker states |
| `getConnectionPoolStats()` | `object` | Get connection pool statistics |
| `getDeduplicatorStats()` | `object` | Get deduplicator statistics |
| `getStats()` | `Promise<ClientStats>` | Get cache and bootstrap statistics |
| `getConfig()` | `Required<RDAPClientOptions>` | Get active configuration |
| `getLogs(count?)` | `LogEntry[]` | Get recent log entries |
| `use(hooks)` | `this` | Register middleware hooks (chainable) |
| `getMiddlewareManager()` | `MiddlewareManager` | Access middleware manager directly |
| `clearCache()` | `Promise<void>` | Clear response and bootstrap caches |
| `clearAll()` | `Promise<void>` | Clear caches, metrics, and logs |
| `destroy()` | `void` | Release resources (rate limiter, connection pool) |

---

## 4. Query Methods

### `client.domain(name)`

Queries RDAP registration data for a domain name. Server discovery is automatic
via IANA Bootstrap.

**Signature:**
```typescript
async domain(domain: string): Promise<DomainResponse>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain` | `string` | Fully qualified domain name (e.g. `'example.com'`, `'münchen.de'`) |

IDN domains are accepted in both Unicode and ASCII/Punycode forms.

**Returns:** [`DomainResponse`](#domainresponse)

**Throws:**

| Error | Condition |
|-------|-----------|
| `ValidationError` | Domain name fails format validation |
| `NoServerFoundError` | No RDAP server found for this TLD via IANA bootstrap |
| `RDAPServerError` (404) | Domain not registered at this registry |
| `NetworkError` | Connection to the RDAP server failed |
| `TimeoutError` | Request exceeded the configured timeout |
| `SSRFProtectionError` | RDAP server URL resolves to a blocked IP range |
| `CircuitOpenError` | Circuit breaker for this registry is open |

**Example:**

```typescript
const result = await client.domain('example.com');

console.log(result.query);            // 'example.com'
console.log(result.handle);           // '2336799_DOMAIN_COM-VRSN'
console.log(result.registrar?.name);  // 'RESERVED-Internet Assigned...'
console.log(result.nameservers);      // ['a.iana-servers.net', ...]
console.log(result.status);           // ['client delete prohibited', ...]

const expiry = result.events?.find(e => e.type === 'expiration');
console.log(expiry?.date);            // '2024-08-13T04:00:00Z'

console.log(result.metadata.source);   // 'https://rdap.verisign.com/com/v1'
console.log(result.metadata.cached);   // true (on subsequent calls)
```

---

### `client.ip(address)`

Queries RDAP data for an IPv4 or IPv6 address. IP version is detected automatically.

**Signature:**
```typescript
async ip(ip: string): Promise<IPResponse>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ip` | `string` | IPv4 address (`8.8.8.8`) or IPv6 address (`2001:4860:4860::8888`) |

**Returns:** [`IPResponse`](#ipresponse)

**Throws:**

| Error | Condition |
|-------|-----------|
| `ValidationError` | Address is not a valid IPv4 or IPv6 address |
| `SSRFProtectionError` | Address is in a private/reserved range (RFC 1918, loopback, etc.) |
| `NoServerFoundError` | No RDAP server found for this IP block |
| `RDAPServerError` | Registry returned an error status |
| `NetworkError` | Connection to the RDAP server failed |

**Example:**

```typescript
const result = await client.ip('8.8.8.8');

console.log(result.name);          // 'GOGL'
console.log(result.country);       // 'US'
console.log(result.startAddress);  // '8.8.8.0'
console.log(result.endAddress);    // '8.8.8.255'
console.log(result.ipVersion);     // 'v4'
console.log(result.status);        // ['active']
```

---

### `client.asn(number)`

Queries RDAP data for an Autonomous System Number.

**Signature:**
```typescript
async asn(asn: string | number): Promise<ASNResponse>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `asn` | `string \| number` | ASN as a number (`15169`) or with prefix (`'AS15169'`) |

**Returns:** [`ASNResponse`](#asnresponse)

**Throws:**

| Error | Condition |
|-------|-----------|
| `ValidationError` | Input is not a valid ASN format |
| `NoServerFoundError` | No RDAP server found for this ASN range |
| `RDAPServerError` | Registry returned an error status |

**Example:**

```typescript
const result = await client.asn(15169);
// or: await client.asn('AS15169')

console.log(result.name);         // 'GOOGLE'
console.log(result.startAutnum);  // 15169
console.log(result.endAutnum);    // 15169
console.log(result.country);      // 'US'
console.log(result.type);         // 'DIRECT ALLOCATION'
```

---

### `client.nameserver(hostname)`

Queries RDAP data for a nameserver. Uses the IANA DNS TLD bootstrap for server
discovery.

**Signature:**
```typescript
async nameserver(nameserver: string): Promise<NameserverResponse>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `nameserver` | `string` | Fully qualified nameserver hostname (e.g. `'ns1.example.com'`) |

**Returns:** [`NameserverResponse`](#nameserverresponse)

**Throws:**

| Error | Condition |
|-------|-----------|
| `ValidationError` | Hostname fails format validation |
| `NoServerFoundError` | No RDAP server found for this nameserver's TLD |
| `RDAPServerError` | Registry returned an error status |

**Example:**

```typescript
const result = await client.nameserver('ns1.google.com');

console.log(result.ldhName);           // 'ns1.google.com'
console.log(result.ipAddresses?.v4);   // ['216.239.32.10']
console.log(result.ipAddresses?.v6);   // ['2001:4860:4802:32::a']
console.log(result.status);            // ['active']
```

---

### `client.entity(handle, serverUrl)`

Queries RDAP data for a contact, registrant, or registrar entity by handle.
There is no global IANA bootstrap for entities — the RDAP server URL must be
specified explicitly.

**Signature:**
```typescript
async entity(handle: string, serverUrl: string): Promise<EntityResponse>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `handle` | `string` | Entity handle (e.g. `'ARIN-HN-1'`, `'VRSN-96'`) |
| `serverUrl` | `string` | Base URL of the RDAP server (e.g. `'https://rdap.arin.net/registry'`) |

**Returns:** [`EntityResponse`](#entityresponse)

**Throws:**

| Error | Condition |
|-------|-----------|
| `ValidationError` | Handle or serverUrl fails validation |
| `RDAPServerError` (404) | No entity with this handle at the given server |
| `SSRFProtectionError` | serverUrl resolves to a blocked IP range |

**Example:**

```typescript
const result = await client.entity(
  'ARIN-HN-1',
  'https://rdap.arin.net/registry'
);

console.log(result.handle);       // 'ARIN-HN-1'
console.log(result.roles);        // ['registrant']
console.log(result.vcardArray);   // jCard-format contact data (RFC 7095)
```

---

### `client.checkAvailability(domain)`

Checks whether a domain name is available for registration using RDAP.
Returns `available: true` when the registry returns HTTP 404.

**Signature:**
```typescript
async checkAvailability(domain: string): Promise<AvailabilityResult>
```

**Returns:** [`AvailabilityResult`](#availabilityresult)

**Example:**

```typescript
const result = await client.checkAvailability('available-now.com');

if (result.available) {
  console.log('Domain is available!');
} else {
  console.log('Expires at:', result.expiresAt);
}
```

---

### `client.streamBatch(requests, options?)`

Streams query results as an async generator, yielding each result as soon as it
completes. At most `concurrency` requests are in-flight at any time. Suitable for
large query sets (1,000+ items) without memory growth.

**Signature:**
```typescript
streamBatch<T extends QueryTypeLiteral>(
  requests: BatchQueryRequest<T>[],
  options?: StreamBatchOptions
): AsyncGenerator<BatchQueryResult<T>>
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `requests` | `BatchQueryRequest<T>[]` | — | Array of typed query objects |
| `options.concurrency` | `number` | `5` | Maximum in-flight requests |
| `options.continueOnError` | `boolean` | `true` | Yield error results instead of throwing |

**Returns:** `AsyncGenerator<BatchQueryResult<T>>`

Each yielded `BatchQueryResult` has:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `QueryTypeLiteral` | Query type |
| `query` | `string` | Original query string |
| `success` | `boolean` | Whether the query succeeded |
| `result` | `T \| undefined` | Response data (when `success: true`) |
| `error` | `Error \| undefined` | Error (when `success: false`) |
| `duration` | `number` | Query duration in milliseconds |

**Example:**

```typescript
const requests = [
  { type: 'domain' as const, query: 'example.com' },
  { type: 'ip' as const, query: '8.8.8.8' },
  { type: 'asn' as const, query: 'AS15169' },
];

for await (const result of client.streamBatch(requests, { concurrency: 10 })) {
  if (result.success) {
    console.log(result.query, '→', result.result!.metadata.source);
  } else {
    console.error(result.query, '→', result.error!.message);
  }
}
```

---

### `client.explain(query)`

Runs the discovery pipeline for a given query without making a real RDAP request.
Returns the bootstrap server, constructed URL, cache status, and query type detection.
Useful for debugging.

**Signature:**
```typescript
async explain(query: string): Promise<ExplainResult>
```

**Example:**

```typescript
const info = await client.explain('example.com');

console.log(info.queryType);       // 'domain'
console.log(info.detectedType);    // 'domain'
console.log(info.bootstrapServer); // 'https://rdap.verisign.com/com/v1'
console.log(info.builtUrl);        // 'https://rdap.verisign.com/com/v1/domain/example.com'
console.log(info.cacheStatus);     // 'miss' | 'hit' | 'disabled'
console.log(info.latencyMs);       // 42
```

---

## 5. Configuration

### Cache

Controls response caching. Defaults to in-memory LRU with a 1-hour TTL.

```typescript
cache?: boolean | CacheOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `'memory' \| 'redis' \| 'stale-while-revalidate' \| 'none'` | `'memory'` | Cache backend |
| `ttl` | `number` | `3600` | Time-to-live in seconds |
| `maxSize` | `number` | `1000` | Maximum entries (memory cache) |
| `redisClient` | `RedisClientLike` | — | ioredis or node-redis instance (required when `strategy: 'redis'`) |
| `keyPrefix` | `string` | `'rdapify:'` | Redis key namespace |
| `revalidateCallback` | `Function` | — | Called when background refresh completes (stale-while-revalidate) |

**Examples:**

```typescript
// Disable cache
const client = new RDAPClient({ cache: false });

// Redis cache
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'myapp:rdap:',
    ttl: 7200,
  },
});

// Stale-while-revalidate
const client = new RDAPClient({
  cache: {
    strategy: 'stale-while-revalidate',
    ttl: 3600,
    revalidateCallback: (key, freshValue) => {
      console.log(`Cache refreshed: ${key}`);
    },
  },
});
```

---

### Rate Limit

Client-side request rate limiting. Disabled by default.

```typescript
rateLimit?: boolean | RateLimitOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable rate limiting |
| `maxRequests` | `number` | `100` | Maximum requests per window |
| `windowMs` | `number` | `60_000` | Window duration in milliseconds |
| `adapter` | `'memory' \| 'redis'` | `'memory'` | Rate limiter backend |
| `redisClient` | `unknown` | — | Redis client (required when `adapter: 'redis'`) |

**Example:**

```typescript
const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 50,
    windowMs: 60_000, // 50 requests per minute
  },
});
```

---

### Circuit Breaker

Per-registry circuit breaker that prevents request storms to degraded RDAP servers.
One circuit breaker is maintained per registry origin. Enabled by default.

```typescript
circuitBreaker?: {
  failureThreshold?: number;
  successThreshold?: number;
  halfOpenTimeout?: number;
  window?: number;
} | false
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | `number` | `5` | Consecutive failures within `window` that open the circuit |
| `successThreshold` | `number` | `1` | Consecutive successes in half-open that close the circuit |
| `halfOpenTimeout` | `number` | `30_000` | Milliseconds in open state before a test request is allowed |
| `window` | `number` | `60_000` | Rolling failure window in milliseconds |

**States:**

| State | Description |
|-------|-------------|
| `closed` | Normal operation; failures counted |
| `open` | All requests rejected immediately with `CircuitOpenError` |
| `half-open` | One test request allowed; closes on success, re-opens on failure |

**Example:**

```typescript
// Custom thresholds
const client = new RDAPClient({
  circuitBreaker: {
    failureThreshold: 10,
    halfOpenTimeout: 60_000,
  },
});

// Disable
const client = new RDAPClient({ circuitBreaker: false });

// Read state per registry
const stats = client.getCircuitBreakerStats();
// { 'https://rdap.verisign.com': { state: 'closed' }, ... }
```

---

### Telemetry (OpenTelemetry)

Exports RDAP query spans to any OTLP/HTTP endpoint using Web-standard `fetch`.
Does not require `@opentelemetry/sdk-node`. Errors are silently swallowed and never
affect query results.

```typescript
telemetry?: TelemetryOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | — | OTLP/HTTP endpoint URL (e.g. `'http://localhost:4318/v1/traces'`) |
| `serviceName` | `string` | `'rdapify'` | Service name in spans |
| `serviceVersion` | `string` | current version | Service version in spans |
| `enabled` | `boolean` | `true` when endpoint set | Enable/disable export |
| `resourceAttributes` | `Record<string, string>` | `{}` | Additional span resource attributes |

**Example:**

```typescript
const client = new RDAPClient({
  telemetry: {
    endpoint: 'http://localhost:4318/v1/traces',
    serviceName: 'my-api',
    resourceAttributes: { 'deployment.environment': 'production' },
  },
});
```

---

### Logging

```typescript
logging?: LoggingOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` | `'warn'` | Minimum log level |
| `logger` | `Function` | built-in | Custom log handler `(level, message, meta?) => void` |

```typescript
const client = new RDAPClient({
  logging: {
    level: 'info',
    logger: (level, message, meta) => {
      myLogger[level](message, meta);
    },
  },
});
```

Enable verbose debug output:

```typescript
const client = new RDAPClient({
  debug: {
    enabled: true,
    logger: {
      debug: (msg, meta) => console.debug('[RDAP]', msg, meta),
      info:  (msg, meta) => console.info('[RDAP]', msg, meta),
      warn:  (msg, meta) => console.warn('[RDAP]', msg, meta),
      error: (msg, meta) => console.error('[RDAP]', msg, meta),
    },
  },
});
```

---

### SSRF Protection

Blocks requests to private, loopback, and link-local IP ranges. Always enabled by
default. Cannot be disabled in production deployments (v1.0.0+).

```typescript
ssrfProtection?: boolean | SSRFProtectionOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable SSRF protection |
| `blockPrivateIPs` | `boolean` | `true` | Block RFC 1918 ranges (10.x, 172.16.x, 192.168.x) |
| `blockLocalhost` | `boolean` | `true` | Block 127.x and ::1 |
| `blockLinkLocal` | `boolean` | `true` | Block 169.254.x and fe80::/10 |
| `blockedDomains` | `string[]` | `[]` | Additional domain patterns to block |
| `allowedDomains` | `string[]` | `[]` | Domain allowlist (overrides block rules) |
| `dnsRebinding` | `boolean` | `false` | Resolve domain names and validate all returned IPs |

---

### Retry

```typescript
retry?: boolean | RetryOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAttempts` | `number` | `3` | Maximum total attempts (1 = no retry) |
| `initialDelay` | `number` | `1000` | Initial delay in milliseconds |
| `maxDelay` | `number` | `10_000` | Maximum delay cap in milliseconds |
| `backoff` | `'exponential' \| 'linear' \| 'fixed'` | `'exponential'` | Backoff strategy |
| `retryableStatusCodes` | `number[]` | `[408, 429, 500, 502, 503, 504]` | HTTP codes that trigger retry |

`ValidationError` is never retried regardless of configuration.

---

### Timeouts

Pass a single number for the request timeout, or an object for granular control.

```typescript
timeout?: number | TimeoutOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connect` | `number` | `5000` | TCP connection timeout (ms) |
| `request` | `number` | `10_000` | Total request timeout (ms) |
| `dns` | `number` | `3000` | DNS resolution timeout (ms) |

```typescript
// Simple: 15 second request timeout
const client = new RDAPClient({ timeout: 15_000 });

// Granular
const client = new RDAPClient({
  timeout: { connect: 3000, request: 20_000, dns: 2000 },
});
```

---

### Middleware

Register lifecycle hooks at construction or after construction via `client.use()`.

```typescript
middleware?: MiddlewareOptions
```

See [§8 Middleware System](#8-middleware-system) for hook signatures and examples.

---

### Connection Pool

Not directly configurable via `RDAPClientOptions`. The default pool uses:
- `maxConnections: 10`
- `keepAlive: true`

Access pool statistics:

```typescript
const stats = client.getConnectionPoolStats();
```

---

### Bootstrap

Controls IANA Bootstrap server discovery.

```typescript
bootstrap?: BootstrapOptions
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `customServers` | `{ tld: string; url: string }[]` | `[]` | Custom servers per TLD (consulted before IANA) |
| `ttl` | `number` | `86400` | Bootstrap cache TTL in seconds (24 hours) |
| `fallback` | `boolean` | `true` | Fall back to IANA when no custom server is defined |
| `regions` | `Array<'us' \| 'eu' \| 'ap'>` | — | Preferred regional bootstrap mirror order |

```typescript
const client = new RDAPClient({
  bootstrap: {
    customServers: [
      { tld: 'com', url: 'https://rdap.verisign.com/com/v1' },
      { tld: 'net', url: 'https://rdap.verisign.com/net/v1' },
    ],
    ttl: 43_200,  // 12 hours
    regions: ['eu', 'us'],
  },
});
```

---

## 6. Error Handling

All rdapify errors extend `RDAPifyError`. Every error exposes a `code` string, an
optional `statusCode`, a `context` object with query-specific details, and a
`suggestion` string for user-facing messages.

### Error Types

| Class | Code | HTTP Status | Description |
|-------|------|-------------|-------------|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Invalid input (domain, IP, ASN format) |
| `NetworkError` | `NETWORK_ERROR` | 500 | Connection failed (no response received) |
| `TimeoutError` | `TIMEOUT_ERROR` | 408 | Request exceeded configured timeout |
| `RDAPServerError` | `RDAP_SERVER_ERROR` | varies | Server returned an HTTP error status |
| `NoServerFoundError` | `NO_SERVER_FOUND` | 404 | No RDAP server discovered for input |
| `ParseError` | `PARSE_ERROR` | 500 | Failed to parse RDAP server response |
| `CacheError` | `CACHE_ERROR` | 500 | Cache read/write operation failed |
| `RateLimitError` | `RATE_LIMIT_ERROR` | 429 | Client-side rate limit exceeded |
| `SSRFProtectionError` | `SSRF_PROTECTION_ERROR` | 403 | Request blocked by SSRF protection |
| `SearchNotSupportedError` | `SEARCH_NOT_SUPPORTED` | 404 | Server does not support RDAP search |
| `QueryAbortedError` | `QUERY_ABORTED` | — | Query stopped by a `beforeQuery` middleware hook |
| `CircuitOpenError` | — | — | Circuit breaker is open for this registry |

### `RDAPifyError` Base Properties

```typescript
class RDAPifyError extends Error {
  code: string;           // Machine-readable error code
  statusCode?: number;    // HTTP status code (when applicable)
  context?: Record<string, any>; // Query-specific details
  timestamp: number;      // Unix ms when the error occurred
  suggestion?: string;    // Human-readable suggestion
  queryType?: string;     // From context
  queryValue?: string;    // From context
  serverUrl?: string;     // From context

  toJSON(): Record<string, any>;
  getUserMessage(): string;
  getDetailedMessage(): string;
}
```

### Handling Errors

```typescript
import {
  RDAPClient,
  ValidationError,
  RDAPServerError,
  NetworkError,
  TimeoutError,
  NoServerFoundError,
  SSRFProtectionError,
  RateLimitError,
  isRDAPifyError,
  isNetworkError,
} from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    // Bad input — do not retry
    console.error('Invalid input:', error.message);
    console.error('Suggestion:', error.suggestion);

  } else if (error instanceof RDAPServerError) {
    if (error.statusCode === 404) {
      console.log('Domain not found (may be available)');
    } else if (error.statusCode === 429) {
      console.warn('Registry rate limit hit, backing off...');
    } else {
      console.error(`Registry error ${error.statusCode}:`, error.message);
    }

  } else if (error instanceof TimeoutError) {
    console.warn('Request timed out. Increase timeout or retry later.');

  } else if (error instanceof NetworkError) {
    console.error('Network unreachable:', error.message);

  } else if (error instanceof NoServerFoundError) {
    console.error('No RDAP server for this TLD:', error.context);

  } else if (error instanceof SSRFProtectionError) {
    console.error('SSRF blocked — suspicious server URL');

  } else if (error instanceof RateLimitError) {
    const wait = error.retryAfter ?? 1000;
    console.warn(`Rate limited. Retry after ${wait}ms`);

  } else if (isRDAPifyError(error)) {
    // Catch-all for any rdapify error
    console.error(`[${error.code}] ${error.message}`);

  } else {
    throw error; // Unknown error — re-throw
  }
}
```

### Type Guards

```typescript
import {
  isRDAPifyError,
  isSSRFProtectionError,
  isNetworkError,
  isTimeoutError,
  isRateLimitError,
} from 'rdapify';

isRDAPifyError(error)         // error instanceof RDAPifyError
isSSRFProtectionError(error)  // error instanceof SSRFProtectionError
isNetworkError(error)         // error instanceof NetworkError
isTimeoutError(error)         // error instanceof TimeoutError
isRateLimitError(error)       // error instanceof RateLimitError
```

---

## 7. Metrics & Monitoring

### Metrics Collector

`MetricsCollector` is automatically active inside every `RDAPClient`. It stores up
to 10,000 query metrics in memory (configurable). Access the summary:

```typescript
const metrics = client.getMetrics();        // all-time
const recent  = client.getMetrics(Date.now() - 60_000); // last 60 seconds
```

**`MetricsSummary` fields:**

| Field | Type | Description |
|-------|------|-------------|
| `total` | `number` | Total queries executed |
| `successful` | `number` | Successful queries |
| `failed` | `number` | Failed queries |
| `successRate` | `number` | Success rate [0, 1] |
| `avgResponseTime` | `number` | Average duration (ms) |
| `minResponseTime` | `number` | Minimum duration (ms) |
| `maxResponseTime` | `number` | Maximum duration (ms) |
| `p50ResponseTime` | `number` | Median duration (ms) |
| `p90ResponseTime` | `number` | P90 duration (ms) |
| `p99ResponseTime` | `number` | P99 duration (ms) |
| `cacheHitRate` | `number` | Cache hit rate [0, 1] |
| `queriesByType` | `{ domain, ip, asn }` | Counts by query type |
| `errorsByType` | `Record<string, number>` | Error counts by error code |

---

### Prometheus Exporter

`PrometheusExporter` converts `MetricsSummary` data to the Prometheus text exposition
format (version 0.0.4).

```typescript
import { PrometheusExporter } from 'rdapify';

const exporter = new PrometheusExporter(
  client.getMetrics.bind(client),
  {
    prefix: 'rdapify',                        // metric name prefix
    labels: { instance: 'api-server-1' },    // constant labels
  }
);

// In your metrics HTTP handler:
res.setHeader('Content-Type', PrometheusExporter.CONTENT_TYPE);
res.end(exporter.export());
```

**Exported metrics** (all prefixed with `rdapify_` by default):

| Metric | Type | Description |
|--------|------|-------------|
| `queries_total` | gauge | Total queries |
| `queries_successful` | gauge | Successful queries |
| `queries_failed` | gauge | Failed queries |
| `success_rate` | gauge | Success rate [0, 1] |
| `response_time_avg_ms` | gauge | Average response time |
| `response_time_p50_ms` | gauge | P50 response time |
| `response_time_p90_ms` | gauge | P90 response time |
| `response_time_p99_ms` | gauge | P99 response time |
| `cache_hit_rate` | gauge | Cache hit rate [0, 1] |
| `queries_by_type` | gauge (with `type` label) | Queries split by type |

**Express / Fastify / Node.js http integration:**

```typescript
import http from 'node:http';

http.createServer((req, res) => {
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': PrometheusExporter.CONTENT_TYPE });
    res.end(exporter.export());
  }
}).listen(9090);
```

---

### OpenTelemetry Traces

`TelemetryExporter` sends RDAP query spans to any OTLP/HTTP JSON endpoint.

```typescript
// Configure at client construction:
const client = new RDAPClient({
  telemetry: {
    endpoint: 'http://localhost:4318/v1/traces',
    serviceName: 'my-service',
    serviceVersion: '1.0.0',
  },
});
```

Each RDAP query produces one span with attributes:
- `rdap.query.type` — `domain`, `ip`, `asn`, `nameserver`, `entity`
- `rdap.query.value` — the raw query string
- `rdap.server.url` — the RDAP server URL used
- `rdap.cache.hit` — `true` / `false`
- `http.status_code` — HTTP response status

Compatible backends: Jaeger, Grafana Tempo, Honeycomb, any OTLP/HTTP endpoint.

---

### `client.getCircuitBreakerStats()`

Returns the current state for each RDAP registry that has been contacted.
Only available when using the Node.js `Fetcher` (not Cloudflare Workers / Deno / Bun).

```typescript
const stats = client.getCircuitBreakerStats();
// {
//   'https://rdap.verisign.com': { state: 'closed' },
//   'https://rdap.arin.net':     { state: 'open' },
//   'https://rdap.ripe.net':     { state: 'half-open' },
// }

for (const [host, { state }] of Object.entries(stats)) {
  if (state !== 'closed') {
    console.warn(`Registry ${host} is ${state}`);
  }
}
```

---

### Grafana Dashboard

Import the built-in Grafana dashboard JSON:

```typescript
import { RDAPIFY_GRAFANA_DASHBOARD } from 'rdapify';

// Use with Grafana API or paste into Grafana UI → Import Dashboard
console.log(RDAPIFY_GRAFANA_DASHBOARD);
```

Panels included: total queries, success rate, cache hit rate, average response time,
P50/P90/P99 latency, queries by type, error breakdown.

---

## 8. Middleware System

The middleware system provides lifecycle hooks that run around every RDAP query.
Hook errors are silently swallowed — a failing hook never breaks the query pipeline.

### Hooks

```typescript
interface MiddlewareOptions {
  beforeQuery?:  (ctx: QueryContext)             => Promise<void> | void;
  afterQuery?:   (ctx: QueryResultContext)       => Promise<void> | void;
  onError?:      (ctx: QueryResultContext)       => Promise<void> | void;
  onCacheHit?:   (ctx: QueryContext)             => Promise<void> | void;
  onCacheMiss?:  (ctx: QueryContext)             => Promise<void> | void;
  onRetry?:      (ctx: QueryContext & { attempt: number; delay: number }) => Promise<void> | void;
}
```

### `QueryContext`

| Field | Type | Description |
|-------|------|-------------|
| `queryType` | `'domain' \| 'ip' \| 'asn' \| 'nameserver' \| 'entity'` | Query type |
| `query` | `string` | Original query string |
| `normalized` | `string` | Normalized query (lowercased, stripped) |
| `startTime` | `number` | Unix ms when the query started |
| `cached` | `boolean \| undefined` | Cache status (set after lookup) |
| `serverUrl` | `string \| undefined` | Discovered RDAP server URL |
| `attempt` | `number \| undefined` | Current attempt number |
| `abort` | `() => void` | Call to abort the query (only in `beforeQuery`) |

### `QueryResultContext`

Extends `QueryContext` with:

| Field | Type | Description |
|-------|------|-------------|
| `duration` | `number` | Total query duration in milliseconds |
| `result` | `RDAPResponse \| undefined` | Response (when successful) |
| `error` | `Error \| undefined` | Error (when failed) |
| `fromCache` | `boolean` | Whether the result was served from cache |

### Registration

**At construction:**
```typescript
const client = new RDAPClient({
  middleware: {
    beforeQuery: (ctx) => console.log('→', ctx.queryType, ctx.query),
    afterQuery:  (ctx) => console.log('←', ctx.duration, 'ms'),
  },
});
```

**After construction (chainable):**
```typescript
client
  .use({ beforeQuery: (ctx) => console.log('→', ctx.query) })
  .use({ afterQuery:  (ctx) => console.log('←', ctx.duration, 'ms') })
  .use({ onError:     (ctx) => metrics.increment('rdap.error') });
```

**With priority** (lower number = runs first):
```typescript
const manager = client.getMiddlewareManager();

manager.use({ beforeQuery: authHook }, 1);   // runs first
manager.use({ beforeQuery: loggingHook }, 2); // runs second
```

### Use Cases

**Request logging:**
```typescript
client.use({
  beforeQuery: (ctx) => {
    logger.info(`RDAP query started`, { type: ctx.queryType, query: ctx.query });
  },
  afterQuery: (ctx) => {
    logger.info(`RDAP query completed`, {
      type: ctx.queryType,
      duration: ctx.duration,
      cached: ctx.fromCache,
    });
  },
  onError: (ctx) => {
    logger.error(`RDAP query failed`, {
      type: ctx.queryType,
      error: ctx.error?.message,
    });
  },
});
```

**Query authorization (block queries):**
```typescript
client.use({
  beforeQuery: (ctx) => {
    if (!isAllowed(ctx.query)) {
      ctx.abort(); // throws QueryAbortedError to the caller
    }
  },
});
```

**Metrics instrumentation:**
```typescript
client.use({
  afterQuery: (ctx) => {
    prometheus.histogram('rdap_query_duration_ms', ctx.duration, {
      type: ctx.queryType,
      cached: String(ctx.fromCache),
    });
  },
  onCacheHit: (ctx) => {
    prometheus.counter('rdap_cache_hits_total').inc({ type: ctx.queryType });
  },
});
```

---

## 9. Pro Plugin Integration

`@rdapify/pro` extends `RDAPClient` with bulk monitoring, change detection,
analytics, webhook delivery, and data export. It requires a valid license key.

### Installation

```bash
npm install rdapify @rdapify/pro
```

### Setup

```typescript
import { RDAPClient } from 'rdapify';
import { ProPlugin } from '@rdapify/pro';

const client = new RDAPClient();

const plugin = await ProPlugin({
  licenseKey: process.env.RDAPIFY_LICENSE_KEY,
  gracePeriodDays: 30,       // offline grace period (default: 30)
  onlineValidation: false,   // set true to force online on every call
  expiryThresholds: [30, 14, 7], // days before expiry to alert
});

plugin.install(client);
```

After `plugin.install(client)`, the client gains:

| Property | Type | Description |
|----------|------|-------------|
| `client.monitor(targets, opts)` | `BulkMonitor` | Polls domains/IPs on an interval |
| `client.detect(targets)` | `ChangeDetector` | Diffs RDAP snapshots |
| `client.report()` | `Reporter` | Generates summary/detailed/trends reports |
| `client.history` | `HistoryTracker` | Stores RDAP snapshots in memory |
| `client.webhooks` | `WebhookManager` | Sends Slack/Discord/Teams/HTTP notifications |
| `client.export` | `Exporter` | Exports data as JSON/CSV/XLSX |
| `client.portfolio` | `PortfolioManager` | Named domain groups with per-group webhooks |
| `client.expiryChecker` | `ExpiryChecker` | Threshold-based expiry alerts |

### Bulk Monitoring

```typescript
const monitor = client.monitor(['example.com', 'google.com'], {
  interval: '1h',     // '30m' | '1h' | '6h' | '24h'
  concurrency: 5,
});

monitor.onChange((changes) => {
  for (const change of changes) {
    console.log(change.target, change.type, change.before, change.after);
  }
});

monitor.start();

// Stop monitoring
monitor.stop();
```

### Change Detection

```typescript
const before = await client.domain('example.com');
// ... time passes ...
const after  = await client.domain('example.com');

const detector = client.detect(['example.com']);
const changes  = detector.diff(before, after);

// Detected change types:
// 'nameserver_changed', 'status_changed', 'registrar_changed',
// 'expiry_changed', 'dnssec_changed'
```

### Webhook Notifications

```typescript
client.webhooks.register({
  type: 'slack',
  url: process.env.SLACK_WEBHOOK_URL,
});

client.webhooks.register({
  type: 'discord',
  url: process.env.DISCORD_WEBHOOK_URL,
});

// Notify on detected changes
client.webhooks.notify(changes);
```

### License Info

```typescript
console.log(plugin.license.valid);           // true
console.log(plugin.license.plan);            // 'pro' | 'team' | 'enterprise'
console.log(plugin.license.organization);    // 'Acme Corp'
console.log(plugin.license.activationCached); // true (served from local cache)
console.log(new Date(plugin.license.graceExpiresAt)); // when offline cache expires
```

---

## 10. Types & Interfaces

### `DomainResponse`

```typescript
interface DomainResponse {
  query: string;
  objectClass: 'domain';
  handle?: string;
  ldhName?: string;          // ASCII/Punycode hostname
  unicodeName?: string;      // Unicode hostname (IDN)
  status?: RDAPStatus[];
  nameservers?: string[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>; // non-standard RDAP extensions
  raw?: any;                 // raw server response (when includeRaw: true)
  metadata: {
    source: string;          // RDAP server URL used
    timestamp: string;       // ISO 8601 response timestamp
    cached: boolean;         // true if served from cache
  };
}
```

### `IPResponse`

```typescript
interface IPResponse {
  query: string;
  objectClass: 'ip network';
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  ipVersion?: 'v4' | 'v6';
  name?: string;
  type?: string;
  country?: string;
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `ASNResponse`

```typescript
interface ASNResponse {
  query: string;
  objectClass: 'autnum';
  handle?: string;
  startAutnum?: number;
  endAutnum?: number;
  name?: string;
  type?: string;
  country?: string;
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `NameserverResponse`

```typescript
interface NameserverResponse {
  query: string;
  objectClass: 'nameserver';
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  status?: RDAPStatus[];
  ipAddresses?: {
    v4?: string[];
    v6?: string[];
  };
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `EntityResponse`

```typescript
interface EntityResponse {
  query: string;
  objectClass: 'entity';
  handle?: string;
  vcardArray?: any[];        // jCard format (RFC 7095)
  roles?: RoleType[];
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  extensions?: Record<string, unknown>;
  raw?: any;
  metadata: { source: string; timestamp: string; cached: boolean };
}
```

### `RDAPEntity`

```typescript
interface RDAPEntity {
  handle?: string;
  roles?: RoleType[];
  vcardArray?: any[];
  publicIds?: Array<{ type: string; identifier: string }>;
  entities?: RDAPEntity[];
  remarks?: RDAPRemark[];
  links?: RDAPLink[];
  events?: RDAPEvent[];
  status?: RDAPStatus[];
}
```

### `RDAPEvent`

```typescript
interface RDAPEvent {
  type: EventType;  // 'registration' | 'expiration' | 'last changed' | ...
  date: string;     // ISO 8601 date string
  actor?: string;
}
```

### `RDAPLink`

```typescript
interface RDAPLink {
  href: string;
  rel?: string;
  type?: string;
  title?: string;
  value?: string;
  hreflang?: string[];
  media?: string;
}
```

### `AvailabilityResult`

```typescript
interface AvailabilityResult {
  domain: string;
  available: boolean;
  expiresAt?: Date; // present when available: false
}
```

### `ExplainResult`

```typescript
interface ExplainResult {
  query: string;
  queryType: 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
  detectedType: string;
  bootstrapServer: string | null;
  builtUrl: string | null;
  cacheStatus: 'hit' | 'miss' | 'disabled';
  latencyMs: number;
  error?: string;
}
```

### Enum Types

```typescript
type RDAPStatus =
  | 'validated' | 'renew prohibited' | 'update prohibited'
  | 'transfer prohibited' | 'delete prohibited' | 'proxy' | 'private'
  | 'removed' | 'obscured' | 'associated' | 'active' | 'inactive'
  | 'locked' | 'pending create' | 'pending renew' | 'pending transfer'
  | 'pending update' | 'pending delete';

type EventType =
  | 'registration' | 'reregistration' | 'last changed' | 'expiration'
  | 'deletion' | 'reinstantiation' | 'transfer' | 'locked' | 'unlocked';

type RoleType =
  | 'registrant' | 'technical' | 'administrative' | 'abuse'
  | 'billing' | 'registrar' | 'reseller' | 'sponsor' | 'proxy'
  | 'notifications' | 'noc';

type CacheStrategy = 'memory' | 'redis' | 'stale-while-revalidate' | 'none';
type BackoffStrategy = 'linear' | 'exponential' | 'fixed';
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
type QueryType = 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
```

### Validator Utilities

```typescript
import {
  validateDomain,    // throws ValidationError if invalid
  validateIP,        // throws ValidationError; returns 'v4' | 'v6'
  validateIPv4,
  validateIPv6,
  validateASN,       // throws ValidationError; returns numeric ASN
  validateNameserver,
  validateEntityHandle,
  normalizeDomain,   // 'EXAMPLE.COM' → 'example.com'
  normalizeIP,
  normalizeASN,
  normalizeNameserver,
  normalizeEntityHandle,
  isPrivateIP,       // returns boolean
  isLocalhost,
  isLinkLocal,
} from 'rdapify';
```

### `ICachePort` (custom cache implementations)

```typescript
import type { ICachePort } from 'rdapify';

class MyCache implements ICachePort {
  async get(key: string): Promise<any | null> { ... }
  async set(key: string, value: any, ttl?: number): Promise<void> { ... }
  async delete(key: string): Promise<void> { ... }
  async clear(): Promise<void> { ... }
  async has(key: string): Promise<boolean> { ... }
  async size(): Promise<number> { ... }
}
```

---

## 11. Environment Variables

### `rdapify` (open-source core)

| Variable | Used by | Description |
|----------|---------|-------------|
| `HOME` | `UsageTelemetry` | Base directory for telemetry config (`~/.rdapify/telemetry.json`) |
| `USERPROFILE` | `UsageTelemetry` | Windows fallback for `HOME` |

### `@rdapify/pro`

| Variable | Used by | Description |
|----------|---------|-------------|
| `RDAPIFY_LICENSE_KEY` | `ProPlugin` | License key — always load from env, never hardcode |
| `HOME` | `LicenseValidator` | Activation cache directory (`~/.rdapify/activation/`) |
| `USERPROFILE` | `LicenseValidator` | Windows fallback for `HOME` |

### Infrastructure (Cloudflare Workers — not consumed by the client library)

| Variable | Used by | Description |
|----------|---------|-------------|
| `LICENSE_SECRET` | License API Worker | AES-256-GCM key for license payload encryption |
| `ACTIVATION_HMAC_SECRET` | License API Worker | HMAC key for activation token signing |
| `PADDLE_WEBHOOK_SECRET` | License API Worker | Paddle webhook signature verification |
| `RESEND_API_KEY` | License delivery | Email delivery for license key after purchase |

> These variables are Cloudflare Worker secrets. They are never set in client
> applications and are documented here for operators managing the license API.

---

## 12. Advanced Examples

### Bulk Domain Queries with Error Isolation

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  rateLimit: { enabled: true, maxRequests: 20, windowMs: 1000 },
  cache: { strategy: 'memory', ttl: 3600 },
});

const domains = ['google.com', 'github.com', 'example.com', /* ... */];
const requests = domains.map(d => ({ type: 'domain' as const, query: d }));

const results: Record<string, any> = {};
const errors:  Record<string, string> = {};

for await (const item of client.streamBatch(requests, { concurrency: 5 })) {
  if (item.success) {
    results[item.query] = item.result;
  } else {
    errors[item.query] = item.error!.message;
  }
}

console.log(`Success: ${Object.keys(results).length}`);
console.log(`Errors:  ${Object.keys(errors).length}`);
```

---

### Domain Monitoring with Change Alerts (Pro)

```typescript
import { RDAPClient } from 'rdapify';
import { ProPlugin } from '@rdapify/pro';

const client = new RDAPClient();
const plugin  = await ProPlugin({ licenseKey: process.env.RDAPIFY_LICENSE_KEY });
plugin.install(client);

client.webhooks.register({
  type: 'slack',
  url: process.env.SLACK_WEBHOOK_URL,
});

const monitor = client.monitor(
  ['example.com', 'competitor.com', 'yourdomain.com'],
  { interval: '6h', concurrency: 3 }
);

monitor.onChange((changes) => {
  console.log(`Detected ${changes.length} change(s)`);
  client.webhooks.notify(changes);
  for (const c of changes) {
    client.history.record(c.target, c.queryType, JSON.stringify(c.after));
  }
});

monitor.start();
console.log('Monitoring started. Press Ctrl+C to stop.');
```

---

### Cache + Rate Limit for High-Traffic APIs

```typescript
import { createClient } from 'redis';
import { RDAPClient } from 'rdapify';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: 'rdap:prod:',
    ttl: 7200,   // 2-hour cache; RDAP data changes infrequently
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60_000,
    adapter: 'redis',
    redisClient: redis,
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 500,
  },
  timeout: { request: 15_000, connect: 5_000 },
});

// Warm up frequently-queried domains at startup
const domains = ['google.com', 'cloudflare.com', 'amazon.com'];
await Promise.allSettled(domains.map(d => client.domain(d)));
console.log('Cache warm-up complete');
```

---

### Using the Circuit Breaker in Production

```typescript
import { RDAPClient, CircuitOpenError } from 'rdapify';

const client = new RDAPClient({
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenTimeout: 60_000,  // 60s before retrying an open registry
    window: 120_000,           // count failures over a 2-minute window
  },
});

async function queryWithFallback(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      // The registry is unavailable — return a cached/degraded response
      console.warn(`Circuit open for ${domain}, returning stale data`);
      return getStaleData(domain);
    }
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = client.getCircuitBreakerStats();
  const degraded = Object.entries(stats)
    .filter(([, s]) => s.state !== 'closed')
    .map(([host]) => host);

  res.json({
    status: degraded.length > 0 ? 'degraded' : 'ok',
    circuits: stats,
  });
});
```

---

### Production Configuration

```typescript
import { RDAPClient, PrometheusExporter } from 'rdapify';
import { createClient } from 'redis';
import express from 'express';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const client = new RDAPClient({
  cache: {
    strategy: 'redis',
    redisClient: redis,
    keyPrefix: `rdap:${process.env.NODE_ENV}:`,
    ttl: Number(process.env.RDAP_CACHE_TTL ?? 3600),
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10_000,
  },
  rateLimit: {
    enabled: true,
    maxRequests: 200,
    windowMs: 60_000,
    adapter: 'redis',
    redisClient: redis,
  },
  circuitBreaker: {
    failureThreshold: 5,
    halfOpenTimeout: 30_000,
  },
  telemetry: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: process.env.SERVICE_NAME ?? 'rdap-service',
    resourceAttributes: {
      'deployment.environment': process.env.NODE_ENV ?? 'production',
    },
  },
  timeout: { request: 15_000, connect: 5_000, dns: 3_000 },
  logging: { level: 'warn' },
  deduplication: { windowMs: 100 },
  bootstrap: {
    ttl: 86_400,
    regions: ['eu', 'us'],  // prefer EU bootstrap mirror
  },
});

// Structured request logging
client.use({
  afterQuery: (ctx) => {
    if (process.env.LOG_RDAP_QUERIES === 'true') {
      console.info(JSON.stringify({
        level: 'info',
        event: 'rdap.query',
        type: ctx.queryType,
        duration: ctx.duration,
        cached: ctx.fromCache,
      }));
    }
  },
  onError: (ctx) => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'rdap.error',
      type: ctx.queryType,
      error: ctx.error?.message,
    }));
  },
});

// Prometheus metrics endpoint
const exporter = new PrometheusExporter(
  client.getMetrics.bind(client),
  { labels: { service: 'rdap', env: process.env.NODE_ENV ?? 'production' } }
);

const app = express();

app.get('/metrics', (_req, res) => {
  res.setHeader('Content-Type', PrometheusExporter.CONTENT_TYPE);
  res.send(exporter.export());
});

app.get('/health', (_req, res) => {
  const circuits = client.getCircuitBreakerStats();
  const degraded = Object.values(circuits).filter(c => c.state !== 'closed');
  res.status(degraded.length > 0 ? 503 : 200).json({
    status: degraded.length > 0 ? 'degraded' : 'ok',
    circuits,
    metrics: client.getMetrics(),
  });
});

app.get('/rdap/domain/:name', async (req, res) => {
  try {
    const result = await client.domain(req.params.name);
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      error: error.code ?? 'INTERNAL_ERROR',
      message: error.message,
    });
  }
});
```

---

> Last updated: 2026-03-25
> For breaking changes between 0.x and 1.0.0, see [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md).
> Report issues at [github.com/rdapify/RDAPify/issues](https://github.com/rdapify/RDAPify/issues).
