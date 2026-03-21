# Options Types

Complete type definitions for `RDAPClientOptions` and all nested configuration objects.

> For a narrative explanation of each option see the [RDAPClient constructor reference](../client.md#constructor-options).

---

## `RDAPClientOptions`

```typescript
interface RDAPClientOptions {
  cache?:          boolean | CacheOptions;
  retry?:          boolean | RetryOptions;
  ssrfProtection?: boolean | SSRFProtectionOptions;
  privacy?:        boolean | PrivacyOptions;
  timeout?:        number  | TimeoutOptions;
  logging?:        LoggingOptions;
  rateLimit?:      boolean | RateLimitOptions;
  debug?:          boolean | DebugOptions;
  userAgent?:      string;
  includeRaw?:     boolean;
  followRedirects?: boolean;
  maxRedirects?:   number;
  headers?:        Record<string, string>;
  bootstrapUrl?:   string;
  middleware?:     MiddlewareHooksConfig;
  deduplication?:  boolean | DeduplicationConfig;
  backend?:        'auto' | 'native' | 'typescript';
}
```

---

## `CacheOptions`

```typescript
interface CacheOptions {
  strategy?:    'memory' | 'redis' | 'none';
  ttl?:         number;          // seconds; default 3600
  maxSize?:     number;          // max entries for memory strategy; default 1000
  redisUrl?:    string;          // connection string when strategy is 'redis'
  redisClient?: RedisClientLike; // existing ioredis / node-redis instance
  keyPrefix?:   string;          // Redis key prefix; default 'rdapify:'
  customCache?: unknown;         // custom ICachePort implementation
}
```

**Shorthand forms:**

```typescript
cache: true   // enable with defaults: memory, 3600s TTL, 1000 entries
cache: false  // disable caching
```

---

## `RetryOptions`

```typescript
interface RetryOptions {
  maxAttempts?:           number;          // default 3
  initialDelay?:          number;          // ms; default 1000
  maxDelay?:              number;          // ms; default 10000
  backoff?:               BackoffStrategy; // default 'exponential'
  retryableStatusCodes?:  number[];        // default [408, 429, 500, 502, 503, 504]
}

type BackoffStrategy = 'linear' | 'exponential' | 'fixed';
```

---

## `SSRFProtectionOptions`

```typescript
interface SSRFProtectionOptions {
  enabled?:         boolean;    // default true
  blockPrivateIPs?: boolean;    // RFC 1918 ranges; default true
  blockLocalhost?:  boolean;    // 127.x / ::1; default true
  blockLinkLocal?:  boolean;    // 169.254.x.x; default true
  blockedDomains?:  string[];   // additional domains to reject
  allowedDomains?:  string[];   // whitelist (takes priority over block rules)
}
```

---

## `PrivacyOptions`

```typescript
interface PrivacyOptions {
  redactPII?:      boolean;    // default true
  redactFields?:   string[];   // default ['email', 'phone', 'fax']
  redactionText?:  string;     // replacement value; default '[REDACTED]'
}
```

---

## `TimeoutOptions`

```typescript
interface TimeoutOptions {
  connect?: number;  // TCP connect timeout in ms; default 5000
  request?: number;  // full request timeout in ms; default 10000
  dns?:     number;  // DNS resolution timeout in ms; default 3000
}
```

A bare number (`timeout: 10000`) sets all three fields simultaneously.

---

## `LoggingOptions`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggingOptions {
  level?:  LogLevel;
  logger?: (level: LogLevel, message: string, meta?: unknown) => void;
}
```

---

## `RateLimitOptions`

```typescript
interface RateLimitOptions {
  enabled?:     boolean;  // default false
  maxRequests?: number;   // default 100
  windowMs?:    number;   // default 60000 (1 minute)
}
```

---

## `DebugOptions`

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

A bare `debug: true` enables debug output to the built-in logger.

---

## `DeduplicationConfig`

```typescript
interface DeduplicationConfig {
  windowMs?: number;  // deduplication window; default 100 ms
}
```

---

## `MiddlewareHooksConfig`

A `Record<string, HookFn | undefined>` — accepts the same hook names as `MiddlewareOptions`:

```typescript
interface MiddlewareOptions {
  beforeQuery?:  (ctx: QueryContext)       => Promise<void> | void;
  afterQuery?:   (ctx: QueryResultContext) => Promise<void> | void;
  onError?:      (ctx: QueryResultContext) => Promise<void> | void;
  onCacheHit?:   (ctx: QueryContext)       => Promise<void> | void;
  onCacheMiss?:  (ctx: QueryContext)       => Promise<void> | void;
  onRetry?:      (ctx: QueryContext & { attempt: number; delay: number }) => Promise<void> | void;
}
```

---

## Default values

```typescript
const DEFAULT_OPTIONS = {
  cache:          { strategy: 'memory', ttl: 3600, maxSize: 1000 },
  retry:          { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000,
                    backoff: 'exponential',
                    retryableStatusCodes: [408, 429, 500, 502, 503, 504] },
  ssrfProtection: { enabled: true, blockPrivateIPs: true,
                    blockLocalhost: true, blockLinkLocal: true,
                    blockedDomains: [], allowedDomains: [] },
  privacy:        { redactPII: true, redactFields: ['email', 'phone', 'fax'],
                    redactionText: '[REDACTED]' },
  timeout:        { connect: 5000, request: 10000, dns: 3000 },
  logging:        { level: 'warn' },
  rateLimit:      { enabled: false, maxRequests: 100, windowMs: 60000 },
  debug:          { enabled: false },
  userAgent:      'RDAPify/0.1.8 (https://rdapify.com)',
  includeRaw:     false,
  followRedirects: true,
  maxRedirects:   5,
  headers:        {},
  bootstrapUrl:   'https://data.iana.org/rdap',
  middleware:     {},
  deduplication:  false,
  backend:        'auto',
};
```

---

## See also

- [RDAPClient constructor](../client.md#constructor-options)
- [Privacy controls](../privacy-controls.md)
