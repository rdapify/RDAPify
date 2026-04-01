# RDAPify Integrations Guide

> Last updated: 2026-03-25 | Node.js 20+ required | v0.3.2

This guide covers deploying rdapify in ten runtime environments. Each section answers: when to use it, how to install, a working minimal example, production notes, and the mistakes most developers make.

---

## Table of Contents

1. [Node.js (Express)](#1-nodejs-express)
2. [NestJS](#2-nestjs)
3. [GraphQL](#3-graphql)
4. [Cloudflare Workers](#4-cloudflare-workers)
5. [AWS Lambda](#5-aws-lambda)
6. [Azure Functions](#6-azure-functions)
7. [Google Cloud Run](#7-google-cloud-run)
8. [Browser](#8-browser)
9. [Bun](#9-bun)
10. [Deno](#10-deno)

---

## 1. Node.js (Express)

### When to use

Traditional Node.js HTTP servers. Most common deployment pattern — long-lived process, shared client instance, full Node.js API available.

### Installation

```bash
npm install rdapify express
```

### Minimal example

rdapify ships an Express middleware factory that mounts three routes automatically:

```typescript
import express from 'express';
import { RDAPClient, rdapifyExpress } from 'rdapify';

const app = express();
const client = new RDAPClient({ cache: true, timeout: 10000 });

// Mounts GET /domain/:name, GET /ip/:address, GET /asn/:number
app.use('/rdap', rdapifyExpress(client));

app.listen(3000);
```

To attach to an existing router:

```typescript
import { Router } from 'express';
import { rdapifyExpress } from 'rdapify';

const router = Router();
rdapifyExpress(client, router);  // router is mutated in-place and returned
export default router;
```

### Production notes

- Initialize `RDAPClient` once at module scope — not per-request. The client holds the bootstrap cache and circuit breaker state.
- Set `timeout` to match your Express server timeout. The default (30 s) is safe but tune to your SLA.
- For Redis-backed caching, see [integrations/redis.md](integrations/redis.md).

### Common mistakes

| Mistake | Fix |
|---------|-----|
| `new RDAPClient()` inside route handler | Move it to module scope |
| Forgetting to handle `CircuitOpenError` | Wrap calls in try/catch; return 503 |
| `allowPrivateIPs: true` in production | Never enable this — SSRF protection is required |
| Using `req.params.domain` directly without sanitization | `rdapifyExpress` sanitizes for you; for custom handlers, trim/lower-case first |

---

## 2. NestJS

### When to use

Structured monoliths or microservices using the NestJS framework. The dynamic module pattern fits NestJS's DI model cleanly.

### Installation

```bash
npm install rdapify @nestjs/common @nestjs/core
```

### Minimal example

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { RdapifyModule } from 'rdapify';

@Module({
  imports: [
    RdapifyModule.forRoot({
      cache: true,
      timeout: 10000,
    }),
  ],
})
export class AppModule {}
```

```typescript
// domain.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRdapClient } from 'rdapify';
import type { RDAPClient } from 'rdapify';

@Injectable()
export class DomainService {
  constructor(@InjectRdapClient() private readonly rdap: RDAPClient) {}

  async lookup(domain: string) {
    return this.rdap.domain(domain);
  }
}
```

The injection token is exported for manual use:

```typescript
import { RDAPIFY_CLIENT_TOKEN } from 'rdapify';

// In a custom provider:
{ provide: RDAPIFY_CLIENT_TOKEN, useValue: myClient }
```

### Production notes

- `RdapifyModule.forRoot()` registers the client as a singleton provider. Import it once in `AppModule`.
- For async configuration (e.g., reading from `ConfigService`), use `forRootAsync` if you add it; otherwise, pass the options directly.
- NestJS does not require `@nestjs/axios` or any HTTP module — rdapify uses its own fetcher.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Importing `RdapifyModule` in multiple feature modules | Import once in `AppModule`; it registers globally via `global: true` |
| Injecting with `@Inject('RDAPIFY_CLIENT')` (string) | Use `@InjectRdapClient()` decorator or import `RDAPIFY_CLIENT_TOKEN` symbol |
| Forgetting `@Injectable()` on the service that injects the client | Add `@Injectable()` |

---

## 3. GraphQL

### When to use

When your application already exposes a GraphQL endpoint and you want RDAP data queryable via the same schema. Works with any GraphQL server (graphql-yoga, Apollo, Mercurius).

### Installation

```bash
npm install rdapify graphql
# Plus your GraphQL server, e.g.:
npm install graphql-yoga
```

### Minimal example

```typescript
import { createServer } from '@graphql-yoga/node';
import { RDAPClient, createRdapifySchema } from 'rdapify';

const client = new RDAPClient({ cache: true });
const { typeDefs, resolvers } = createRdapifySchema(client);

const server = createServer({ typeDefs, resolvers });
server.start();
```

Query example:

```graphql
query {
  domain(name: "example.com") {
    name
    status
    expiresAt
    nameservers { name }
    registrant { name email }
  }

  ip(address: "1.1.1.1") {
    address
    network
    country
  }

  asn(number: 13335) {
    number
    name
    country
  }
}
```

To merge with an existing schema, import the SDL string directly:

```typescript
import { RDAPIFY_TYPE_DEFS, createRdapifySchema } from 'rdapify';
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';

const { typeDefs: rdapTypeDefs, resolvers: rdapResolvers } = createRdapifySchema(client);

const typeDefs = mergeTypeDefs([yourTypeDefs, rdapTypeDefs]);
const resolvers = mergeResolvers([yourResolvers, rdapResolvers]);
```

### Production notes

- `createRdapifySchema` returns plain `{ typeDefs: string, resolvers: object }` — no special server coupling.
- `RDAPIFY_TYPE_DEFS` is the raw SDL string if you need to inspect or extend the schema without calling the factory.
- Enable persisted queries on your GraphQL server to avoid re-parsing the RDAP schema on every request.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Creating a new `RDAPClient` inside a resolver | Pass the client to `createRdapifySchema` once; resolvers close over it |
| Expecting `registrant.email` without `privacy: true` | Set `privacy: false` explicitly only if your use case has legal basis — email is redacted by default |
| Merging type definitions with `+` string concat | Use `@graphql-tools/merge` or `mergeTypeDefs` |

---

## 4. Cloudflare Workers

### When to use

Edge compute — globally distributed, low-latency lookups close to users. No Node.js APIs available; Workers run the V8 runtime only.

### Installation

```bash
npm install rdapify wrangler
```

### Minimal example

```typescript
// worker.ts
import { RDAPClient, CloudflareWorkersFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new CloudflareWorkersFetcher(),
  cache: false,        // Workers are stateless — no persistent cache
  timeout: 8000,       // Workers have a 30 s CPU limit; keep RDAP calls shorter
});

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
      return new Response(JSON.stringify({ error: 'Missing domain parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const result = await client.domain(domain);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
```

```toml
# wrangler.toml
name = "rdap-worker"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
```

### Production notes

- `CloudflareWorkersFetcher` uses `globalThis.fetch` and `AbortSignal.timeout()` — both available natively in Workers.
- SSRF protection operates differently at the edge: DNS-based private-range checks depend on what Workers' runtime resolves. Do not rely on SSRF protection alone — validate inputs with an allowlist.
- Workers are re-initialized per isolate start; do not store mutable state in module scope beyond the client.
- For caching across requests, use the [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) or [KV](https://developers.cloudflare.com/kv/).

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Using the default `Fetcher` (Node.js `http` module) | Always pass `new CloudflareWorkersFetcher()` |
| `cache: true` with default in-memory cache | Workers are stateless; use KV or the Cache API instead |
| Reading `process.env` | Use `wrangler.toml` `[vars]` or `env` parameter passed to the handler |
| Initializing client inside the `fetch` handler | Move initialization to module scope — Workers reuse the module across requests within an isolate |

---

## 5. AWS Lambda

### When to use

Event-driven or HTTP endpoints on AWS. Good fit for infrequent or bursty RDAP lookups where you pay per-invocation rather than for idle time.

### Installation

```bash
npm install rdapify
```

### Minimal example

```typescript
// handler.ts
import { RDAPClient, RDAPError } from 'rdapify';

// Initialize outside the handler — reused across warm invocations
const client = new RDAPClient({
  cache: true,
  timeout: 8000,    // Lambda default timeout is 3 s; raise it to at least 10 s in function config
});

interface APIGatewayEvent {
  pathParameters?: { type?: string; value?: string };
}

export const handler = async (event: APIGatewayEvent) => {
  const type = event.pathParameters?.type;
  const value = event.pathParameters?.value;

  if (!type || !value) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing path parameters' }) };
  }

  try {
    let result: unknown;
    if (type === 'domain')  result = await client.domain(value);
    else if (type === 'ip') result = await client.ip(value);
    else if (type === 'asn') result = await client.asn(Number(value));
    else return { statusCode: 400, body: JSON.stringify({ error: `Unknown type: ${type}` }) };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const status = err instanceof RDAPError && err.statusCode ? err.statusCode : 500;
    return { statusCode: status, body: JSON.stringify({ error: (err as Error).message }) };
  }
};
```

### Production notes

- Set Lambda timeout to at least **15 seconds** — RDAP queries can take 5–10 s to slow registries.
- Use **ARM64 (Graviton)** architecture for ~20% cost reduction with no code changes.
- Set memory to **512 MB** minimum — the bootstrap cache and connection pool benefit from heap space.
- For VPC deployments, ensure NAT Gateway or VPC Endpoint allows outbound HTTPS to RDAP servers.
- The `templates/cloud/aws_lambda/` directory in this repo contains a SAM template. Note: the template specifies `Runtime: nodejs18.x` — change it to `nodejs20.x` to match the project's Node.js requirement.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| `new RDAPClient()` inside `handler` | Move to module scope; warm invocations reuse the instance |
| Lambda timeout shorter than `client.timeout` | Lambda timeout must exceed `client.timeout` by a few seconds |
| Using synchronous `require()` inside handler | Move all requires to the top level |
| Not handling cold starts | First invocation is slower; set a longer timeout and use Provisioned Concurrency for latency-sensitive use cases |

---

## 6. Azure Functions

### When to use

HTTP-triggered or queue-triggered serverless on Azure. Pattern is similar to Lambda but uses Azure's runtime and `function.json` for routing.

### Installation

```bash
npm install rdapify
```

### Minimal example

```javascript
// index.js
const { RDAPClient, RDAPError } = require('rdapify');

// Module-scope client — reused across warm invocations
const client = new RDAPClient({
  cache: true,
  timeout: 8000,
});

module.exports = async function (context, req) {
  const { queryType, value } = context.bindingData;

  try {
    let result;
    switch (queryType) {
      case 'domain': result = await client.domain(value); break;
      case 'ip':     result = await client.ip(value); break;
      case 'asn':    result = await client.asn(Number(value)); break;
      default:
        context.res = { status: 400, body: { error: `Unknown query type: ${queryType}` } };
        return;
    }
    context.res = { status: 200, body: result };
  } catch (err) {
    const status = err instanceof RDAPError && err.statusCode ? err.statusCode : 500;
    context.res = { status, body: { error: err.message } };
  }
};
```

```json
// function.json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get"],
      "route": "{queryType}/{value}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

```json
// host.json
{
  "version": "2.0",
  "functionTimeout": "00:00:30",
  "extensions": {
    "http": {
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100,
      "routePrefix": "api"
    }
  }
}
```

### Production notes

- `functionTimeout: "00:00:30"` — 30 seconds is the maximum for Consumption plan. If you need longer, switch to Premium or Dedicated plan.
- Set `FUNCTIONS_WORKER_PROCESS_COUNT` to `1` to avoid multiple client instances competing for the same bootstrap cache.
- Cold start times on Consumption plan are typically 1–3 seconds for Node.js. Use Premium plan for latency-sensitive workloads.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Accessing `req.params` instead of `context.bindingData` | Use `context.bindingData.queryType` for route parameters |
| `async function` without `await` on the rdap call | Always `await` — the runtime marks the invocation as complete after the returned promise resolves |
| Hardcoded function key in client URLs | Use environment variables; inject the key via Application Settings |

---

## 7. Google Cloud Run

### When to use

Containerized HTTP services on GCP. Cloud Run auto-scales to zero and back, making it a cost-effective choice for moderate-traffic RDAP APIs.

### Installation

```bash
npm install rdapify express
```

### Minimal example

```typescript
// server.ts
import express from 'express';
import { RDAPClient, rdapifyExpress } from 'rdapify';

const app = express();
const client = new RDAPClient({ cache: true, timeout: 10000 });

app.use('/rdap', rdapifyExpress(client));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const port = parseInt(process.env.PORT ?? '8080', 10);
app.listen(port, () => console.log(`Listening on port ${port}`));
```

```dockerfile
# Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

Deploy:

```bash
gcloud run deploy rdap-service \
  --image gcr.io/PROJECT_ID/rdap-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 100 \
  --port 8080
```

### Production notes

- Always read `process.env.PORT` — Cloud Run injects it dynamically. Hardcoding `8080` works in most cases but is fragile.
- Set `--min-instances 1` to avoid cold starts on Consumption plan if latency matters.
- The bootstrap cache in `RDAPClient` is warmed on first use. On a fresh container instance, the first request is slower; a `GET /health` readiness probe at startup can pre-warm it.
- The `templates/cloud/google_cloud_run/Dockerfile` in this repo uses `node:18-alpine` — update it to `node:20-alpine` to match the project requirement.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoded port `8080` | Use `process.env.PORT ?? '8080'` |
| Running as `root` in container | Add a non-root user in Dockerfile (`adduser`) |
| No health check endpoint | Add `GET /health` — Cloud Run probes it for readiness |
| Deploying without `.dockerignore` | Exclude `node_modules`, `.git`, test files — keeps image small |

---

## 8. Browser

### When to use

Client-side JavaScript in a browser. Because browsers enforce CORS, rdapify cannot reach RDAP registries directly. You must proxy requests through your own server.

### Installation

```bash
npm install rdapify
```

### Minimal example

`BrowserFetcher` routes all RDAP requests through a proxy URL. The proxy appends `?url=<encoded-rdap-url>` and must forward the request server-side:

```typescript
import { RDAPClient, BrowserFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new BrowserFetcher({ proxyUrl: 'https://your-api.example.com/rdap-proxy' }),
  cache: true,
  timeout: 15000,
});

const result = await client.domain('example.com');
// → browser calls: GET https://your-api.example.com/rdap-proxy?url=https%3A%2F%2Frdap.verisign.com%2F...
```

Minimal proxy server (Express):

```typescript
import express from 'express';
import { RDAPClient } from 'rdapify';

const app = express();
const client = new RDAPClient({ cache: true });

// CORS headers required for browser access
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/rdap-proxy', async (req, res) => {
  const url = req.query.url as string;
  if (!url || !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url parameter' });
  }
  // The server-side client fetches the RDAP URL
  // For direct proxy use, fetch the URL through the server's RDAPClient
  // (or use a raw fetch with allowlist validation)
  res.status(501).json({ error: 'Implement server-side RDAP fetch here' });
});
```

> In practice, deploy `rdapifyExpress(client)` on your server and point the browser at your server's `/domain/:name` endpoint instead of using `BrowserFetcher` directly. `BrowserFetcher` is for advanced cases where you need the client API on the browser side.

### Production notes

- The proxy server **must** validate the `url` parameter against an allowlist of known RDAP server prefixes. Never proxy arbitrary URLs — this is an SSRF vector.
- `Access-Control-Allow-Origin: *` is acceptable for public RDAP data. For authenticated proxies, restrict to your domain.
- Browser bundle size: rdapify is CommonJS. Use a bundler (webpack, esbuild, Vite) with tree-shaking for minimal output.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Using default `RDAPClient` without `BrowserFetcher` | Always pass `fetcher: new BrowserFetcher(...)` in browser environments |
| Proxy server with unrestricted URL forwarding | Validate the `url` parameter against a hardcoded allowlist of RDAP prefixes |
| Missing CORS headers on proxy | Add `Access-Control-Allow-Origin: *` (or specific origin) |
| Expecting `privacy: true` to work in the browser | PII redaction happens at the client level and works normally; the proxy just transports data |

---

## 9. Bun

### When to use

Drop-in Node.js replacement with faster startup and built-in TypeScript. `BunFetcher` uses `Bun.fetch` instead of Node.js `http` for better performance.

### Installation

```bash
bun add rdapify
```

### Minimal example

```typescript
import { RDAPClient, BunFetcher } from 'rdapify';

const client = new RDAPClient({
  fetcher: new BunFetcher(),
  cache: true,
  timeout: 10000,
});

const result = await client.domain('example.com');
console.log(result);
```

`BunFetcher` detects the runtime automatically:

```typescript
// BunFetcher.resolveFetch() returns Bun.fetch when available,
// falls back to globalThis.fetch. You do not need to detect the runtime manually.
const fetcher = new BunFetcher();
```

For a minimal HTTP server:

```typescript
import { RDAPClient, BunFetcher, rdapifyExpress } from 'rdapify';
import express from 'express';

const app = express();
const client = new RDAPClient({ fetcher: new BunFetcher(), cache: true });
app.use('/rdap', rdapifyExpress(client));

Bun.serve({ port: 3000, fetch: app.fetch });
```

Or with Bun's native HTTP:

```typescript
import { RDAPClient, BunFetcher } from 'rdapify';

const client = new RDAPClient({ fetcher: new BunFetcher(), cache: true });

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const domain = url.searchParams.get('domain');
    if (!domain) return new Response('Missing domain', { status: 400 });
    const result = await client.domain(domain);
    return Response.json(result);
  },
});
```

### Production notes

- Bun supports most Node.js APIs. If you hit a compatibility issue, check [bun.sh/docs/runtime/nodejs-apis](https://bun.sh/docs/runtime/nodejs-apis).
- The `RDAPClient` bootstrap cache and circuit breaker behave identically to Node.js.
- Bun's native `Bun.serve` outperforms `express` on Bun. For greenfield services, prefer it.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Using default fetcher on Bun | Pass `fetcher: new BunFetcher()` to use `Bun.fetch` |
| Mixing `Bun.serve` and Express adapter incorrectly | `Bun.serve({ fetch: app.fetch })` requires Express 5 or a compatibility shim; test before deploying |
| Assuming `globalThis.Bun` is always defined | `BunFetcher` handles the fallback — do not guard it manually |

---

## 10. Deno

### When to use

Secure-by-default runtime with Web-standard APIs. `DenoFetcher` uses `globalThis.fetch` (built into Deno). No polyfills needed.

### Installation

```ts
// deno.json
{
  "imports": {
    "rdapify": "npm:rdapify@0.3.2"
  }
}
```

Or inline:

```typescript
import { RDAPClient, DenoFetcher } from 'npm:rdapify@0.3.2';
```

### Minimal example

```typescript
import { RDAPClient, DenoFetcher } from 'npm:rdapify@0.3.2';

const client = new RDAPClient({
  fetcher: new DenoFetcher(),
  cache: true,
  timeout: 10000,
});

const result = await client.domain('example.com');
console.log(result);
```

For a minimal HTTP server:

```typescript
import { RDAPClient, DenoFetcher } from 'npm:rdapify@0.3.2';

const client = new RDAPClient({ fetcher: new DenoFetcher(), cache: true });

Deno.serve({ port: 3000 }, async (req) => {
  const url = new URL(req.url);
  const domain = url.searchParams.get('domain');
  if (!domain) return new Response('Missing domain', { status: 400 });

  try {
    const result = await client.domain(domain);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
});
```

Run with network permission:

```bash
deno run --allow-net server.ts
```

### Production notes

- Deno requires explicit `--allow-net` flag. In production, restrict with `--allow-net=rdap.verisign.com,rdap.arin.net,...` (use the IANA RDAP bootstrap list for the full allowlist).
- Deno Deploy does not support npm specifiers in all environments — test before deploying.
- `DenoFetcher` uses `globalThis.fetch` (Web standard). No polyfill, no Node.js `http` module dependency.

### Common mistakes

| Mistake | Fix |
|---------|-----|
| Using default fetcher on Deno | Pass `fetcher: new DenoFetcher()` |
| Running without `--allow-net` | All network access requires explicit permission |
| Using `require()` | Deno is ESM-only; use `import` statements |
| Assuming full npm compatibility | Test each package before deploying to Deno Deploy or Deno's edge runtime |

---

## Runtime detection

If you need to select a fetcher at runtime based on the environment:

```typescript
import {
  RDAPClient,
  isCloudflareWorkers,
  isBun,
  isDeno,
  isBrowser,
  isNode,
  getRuntimeName,
  CloudflareWorkersFetcher,
  BunFetcher,
  DenoFetcher,
  BrowserFetcher,
} from 'rdapify';

function createFetcher() {
  if (isCloudflareWorkers()) return new CloudflareWorkersFetcher();
  if (isBun())               return new BunFetcher();
  if (isDeno())              return new DenoFetcher();
  if (isBrowser())           return new BrowserFetcher({ proxyUrl: '/rdap-proxy' });
  return undefined;           // Node.js default
}

const client = new RDAPClient({ fetcher: createFetcher(), cache: true });
console.log(`Running on: ${getRuntimeName()}`);
```

---

## Error handling across all environments

All environments use the same error classes:

```typescript
import {
  RDAPError,
  RDAPNotFoundError,
  RDAPTimeoutError,
  RDAPValidationError,
  CircuitOpenError,
  QueryAbortedError,
} from 'rdapify';

try {
  const result = await client.domain('example.com');
} catch (err) {
  if (err instanceof RDAPNotFoundError) {
    // 404 from registry — domain not found or not in RDAP
  } else if (err instanceof RDAPTimeoutError) {
    // Request exceeded timeout
  } else if (err instanceof CircuitOpenError) {
    // Circuit breaker open — registry is down
    // err.registry contains which registry tripped
  } else if (err instanceof RDAPValidationError) {
    // Input failed validation — bad domain/IP/ASN format
  } else if (err instanceof RDAPError) {
    // Generic RDAP error — check err.statusCode and err.message
  }
}
```

---

## Related documentation

| Document | Description |
|---|---|
| [API_REFERENCE.md](API_REFERENCE.md) | Full API reference — all exports, types, options |
| [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) | Upgrading from 0.x to 1.0.0 |
| [integrations/express.md](integrations/express.md) | Deep-dive Express guide with multi-tenant, monitoring, and Redis |
| [integrations/nestjs.md](integrations/nestjs.md) | Deep-dive NestJS guide |
| [integrations/bun.md](integrations/bun.md) | Deep-dive Bun guide |
| [integrations/deno.md](integrations/deno.md) | Deep-dive Deno guide |
| [integrations/cloudflare-workers.md](integrations/cloudflare-workers.md) | Deep-dive Cloudflare Workers guide |
| [integrations/cloud/aws-lambda.md](integrations/cloud/aws-lambda.md) | Deep-dive Lambda guide |
| [integrations/cloud/azure-functions.md](integrations/cloud/azure-functions.md) | Deep-dive Azure Functions guide |
| [integrations/cloud/google-cloud-run.md](integrations/cloud/google-cloud-run.md) | Deep-dive Cloud Run guide |
| [security/ssrf-prevention.md](security/ssrf-prevention.md) | SSRF protection internals |
