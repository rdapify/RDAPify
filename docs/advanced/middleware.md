# Middleware / Lifecycle Hooks

RDAPify exposes six lifecycle hooks that fire at defined points in the query pipeline. Hooks are registered via the constructor `middleware` option or the fluent `.use()` method on a `RDAPClient` instance.

---

## Available hooks

```typescript
interface MiddlewareOptions {
  /** Called before each query, before the cache lookup */
  beforeQuery?: (ctx: QueryContext) => Promise<void> | void;

  /** Called after a successful query (from network or cache) */
  afterQuery?: (ctx: QueryResultContext) => Promise<void> | void;

  /** Called when a query throws an error */
  onError?: (ctx: QueryResultContext) => Promise<void> | void;

  /** Called when the cache has a valid entry for the query */
  onCacheHit?: (ctx: QueryContext) => Promise<void> | void;

  /** Called when the cache has no entry for the query */
  onCacheMiss?: (ctx: QueryContext) => Promise<void> | void;

  /** Called each time a retry is about to be attempted */
  onRetry?: (ctx: QueryContext & { attempt: number; delay: number }) => Promise<void> | void;
}
```

---

## Context objects

### `QueryContext`

```typescript
interface QueryContext {
  queryType:  'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
  query:      string;     // raw input (e.g. 'example.com')
  normalized: string;     // normalised form
  startTime:  number;     // Date.now() at query start
  cached?:    boolean;
  serverUrl?: string;     // RDAP server URL (available after bootstrap discovery)
  attempt?:   number;
}
```

### `QueryResultContext`

```typescript
interface QueryResultContext extends QueryContext {
  duration:  number;           // elapsed milliseconds
  result?:   RDAPResponse;     // the response (undefined on error)
  error?:    Error;            // the thrown error (undefined on success)
  fromCache: boolean;
}
```

---

## Registration

### Constructor option

```typescript
const client = new RDAPClient({
  middleware: {
    beforeQuery(ctx) {
      console.log(`[${ctx.queryType}] ${ctx.query}`);
    },
    afterQuery(ctx) {
      console.log(`done in ${ctx.duration} ms`);
    },
  },
});
```

### Fluent `.use()` method

```typescript
const client = new RDAPClient();

client.use({
  beforeQuery(ctx) {
    console.log(`querying ${ctx.queryType}: ${ctx.query}`);
  },
});

// .use() returns `this` — chaining is supported
client
  .use({ afterQuery:  (ctx) => console.log(`${ctx.duration} ms`) })
  .use({ onCacheHit:  (ctx) => console.log(`cache hit: ${ctx.query}`) });
```

Later `.use()` calls override earlier ones for the same hook name.

---

## Error isolation

Hook errors are silently caught. A failing hook **never** interrupts the query pipeline or surfaces to the caller:

```typescript
client.use({
  afterQuery(ctx) {
    throw new Error('hook error'); // silently swallowed
  },
});

// query still succeeds
const result = await client.domain('example.com');
```

---

## Practical examples

### Request logging

```typescript
client.use({
  beforeQuery(ctx) {
    console.log(`START ${ctx.queryType} ${ctx.query} at ${new Date(ctx.startTime).toISOString()}`);
  },
  afterQuery(ctx) {
    const status = ctx.fromCache ? 'CACHE' : 'NETWORK';
    console.log(`END   ${ctx.query} [${status}] ${ctx.duration} ms`);
  },
  onError(ctx) {
    console.error(`ERROR ${ctx.query} — ${ctx.error?.message}`);
  },
});
```

### Metrics collection

```typescript
const counters = { hits: 0, misses: 0, errors: 0 };

client.use({
  onCacheHit()  { counters.hits++; },
  onCacheMiss() { counters.misses++; },
  onError()     { counters.errors++; },
});
```

### Retry visibility

```typescript
client.use({
  onRetry(ctx) {
    console.warn(`Retry #${ctx.attempt} for ${ctx.query} in ${ctx.delay} ms`);
  },
});
```

### Structured logging with a custom logger

```typescript
import pino from 'pino';
const logger = pino();

client.use({
  beforeQuery(ctx) {
    logger.info({ queryType: ctx.queryType, query: ctx.query }, 'rdap query start');
  },
  afterQuery(ctx) {
    logger.info(
      { query: ctx.query, durationMs: ctx.duration, fromCache: ctx.fromCache },
      'rdap query end',
    );
  },
  onError(ctx) {
    logger.error({ query: ctx.query, err: ctx.error }, 'rdap query failed');
  },
});
```

---

## Inspecting registered hooks

```typescript
const manager = client.getMiddlewareManager();

// Names of hooks that currently have handlers
console.log(manager.getRegisteredHooks());
// ['beforeQuery', 'afterQuery', 'onError']

// Remove all hooks
manager.clear();
```

---

## Important notes

- Hooks run in the **TypeScript backend only**. When `backend: 'native'` is active (using `rdapify-nd`), hooks are bypassed — the Rust pipeline does not call into the TypeScript middleware layer.
- Hooks are **not** called for cache hits that occur before the query reaches the orchestrator (bootstrap cache).
- `onRetry` fires before each retry attempt, not after the failure that triggered it.

---

## See also

- [RDAPClient — `.use()`](../api-reference/client.md#usehooks)
- [MiddlewareOptions type](../api-reference/types/options.md#middlewarehooksconfig)
