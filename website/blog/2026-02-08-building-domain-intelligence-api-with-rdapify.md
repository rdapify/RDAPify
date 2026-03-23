---
date: 2026-02-08
slug: building-domain-intelligence-api-with-rdapify
title: "Building a Domain Intelligence API with RDAPify"
authors: [rdapify]
tags: [tutorial, api, domain-intelligence, nodejs, express]
description: "Build a production-ready domain intelligence REST API using RDAPify and Express. Features domain lookup, IP investigation, batch queries, and caching — with full source code."
keywords: [domain intelligence api, domain lookup api, build whois api, rdap api nodejs, domain information api, domain data api, ip lookup api]
image: /img/rdapify-social-card.png
---
date: 2026-02-08

Want to build your own domain intelligence API? In this tutorial, we'll create a production-ready REST API that provides domain, IP, and ASN lookups using RDAPify. Full source code included — deploy it in minutes.

<!-- truncate -->

## What We're Building

A REST API with these endpoints:

```
GET /api/domain/:name        → Domain registration info
GET /api/ip/:address         → IP network info
GET /api/asn/:number         → ASN operator info
POST /api/batch/domains      → Batch domain lookup
GET /api/health              → Health check
```

Features:
- RDAP-powered lookups with automatic server discovery
- Response caching for performance
- Rate limiting for protection
- Input validation
- Clean, normalized JSON responses
- Error handling

## Project Setup

```bash
mkdir domain-intel-api && cd domain-intel-api
npm init -y
npm install express rdapify cors helmet
npm install -D typescript @types/express @types/cors @types/node tsx
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

## Step 1: RDAP Service Layer

Create a service that wraps RDAPify with normalization:

```typescript
// src/services/rdap.service.ts
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: { ttl: 3600 },
  timeout: 15000,
});

export interface DomainInfo {
  domain: string;
  status: string[];
  registrar: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  expiryDate: string | null;
  nameservers: string[];
  dnssec: boolean;
  daysUntilExpiry: number | null;
}

export interface IPInfo {
  query: string;
  network: string | null;
  handle: string | null;
  startAddress: string | null;
  endAddress: string | null;
  country: string | null;
  type: string | null;
}

export interface ASNInfo {
  asn: number;
  handle: string | null;
  name: string | null;
  type: string | null;
  status: string[];
  registrationDate: string | null;
}

function findEvent(events: any[] | undefined, action: string): string | null {
  return events?.find((e: any) => e.eventAction === action)?.eventDate ?? null;
}

export async function lookupDomain(name: string): Promise<DomainInfo> {
  const result = await client.domain(name);

  const expiryDate = findEvent(result.events, 'expiration');
  let daysUntilExpiry: number | null = null;
  if (expiryDate) {
    const diff = new Date(expiryDate).getTime() - Date.now();
    daysUntilExpiry = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  const registrar = result.entities?.find(
    (e: any) => e.roles?.includes('registrar')
  );
  const registrarName = registrar?.vcardArray?.[1]?.find(
    (f: any) => f[0] === 'fn'
  )?.[3] ?? null;

  return {
    domain: result.ldhName ?? name,
    status: result.status ?? [],
    registrar: registrarName,
    createdDate: findEvent(result.events, 'registration'),
    updatedDate: findEvent(result.events, 'last changed'),
    expiryDate,
    nameservers: result.nameservers?.map((ns: any) => ns.ldhName) ?? [],
    dnssec: result.secureDNS?.delegationSigned ?? false,
    daysUntilExpiry,
  };
}

export async function lookupIP(address: string): Promise<IPInfo> {
  const result = await client.ip(address);

  return {
    query: address,
    network: result.name ?? null,
    handle: result.handle ?? null,
    startAddress: result.startAddress ?? null,
    endAddress: result.endAddress ?? null,
    country: result.country ?? null,
    type: result.type ?? null,
  };
}

export async function lookupASN(number: number): Promise<ASNInfo> {
  const result = await client.asn(number);

  return {
    asn: number,
    handle: result.handle ?? null,
    name: result.name ?? null,
    type: result.type ?? null,
    status: result.status ?? [],
    registrationDate: findEvent(result.events, 'registration'),
  };
}
```

## Step 2: Input Validation

```typescript
// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';

const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

export function validateDomain(req: Request, res: Response, next: NextFunction) {
  const { name } = req.params;
  if (!name || name.length > 253 || !DOMAIN_REGEX.test(name)) {
    return res.status(400).json({
      error: 'Invalid domain name',
      message: 'Provide a valid domain name (e.g., example.com)',
    });
  }
  next();
}

export function validateIP(req: Request, res: Response, next: NextFunction) {
  const { address } = req.params;
  if (!address || (!IPV4_REGEX.test(address) && !IPV6_REGEX.test(address))) {
    return res.status(400).json({
      error: 'Invalid IP address',
      message: 'Provide a valid IPv4 or IPv6 address',
    });
  }
  next();
}

export function validateASN(req: Request, res: Response, next: NextFunction) {
  const num = parseInt(req.params.number, 10);
  if (isNaN(num) || num < 1 || num > 4294967295) {
    return res.status(400).json({
      error: 'Invalid ASN',
      message: 'Provide a valid ASN number (1-4294967295)',
    });
  }
  next();
}
```

## Step 3: Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import { Request, Response, NextFunction } from 'express';

const requests = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;  // 1 minute
const MAX_REQUESTS = 60;   // 60 requests per minute

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter,
    });
  }

  entry.count++;
  next();
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requests) {
    if (now > entry.resetAt) requests.delete(ip);
  }
}, 300_000);
```

## Step 4: API Routes

```typescript
// src/routes/api.ts
import { Router } from 'express';
import { lookupDomain, lookupIP, lookupASN } from '../services/rdap.service';
import { validateDomain, validateIP, validateASN } from '../middleware/validation';

const router = Router();

// Domain lookup
router.get('/domain/:name', validateDomain, async (req, res) => {
  try {
    const result = await lookupDomain(req.params.name.toLowerCase());
    res.json({ success: true, data: result });
  } catch (error: any) {
    const status = error.code === 'NOT_FOUND' ? 404 : 502;
    res.status(status).json({
      success: false,
      error: status === 404 ? 'Domain not found' : 'RDAP query failed',
      message: error.message,
    });
  }
});

// IP lookup
router.get('/ip/:address', validateIP, async (req, res) => {
  try {
    const result = await lookupIP(req.params.address);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: 'IP lookup failed',
      message: error.message,
    });
  }
});

// ASN lookup
router.get('/asn/:number', validateASN, async (req, res) => {
  try {
    const num = parseInt(req.params.number, 10);
    const result = await lookupASN(num);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: 'ASN lookup failed',
      message: error.message,
    });
  }
});

// Batch domain lookup
router.post('/batch/domains', async (req, res) => {
  const { domains } = req.body;

  if (!Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Provide an array of domain names',
    });
  }

  if (domains.length > 20) {
    return res.status(400).json({
      error: 'Too many domains',
      message: 'Maximum 20 domains per batch request',
    });
  }

  const results = await Promise.allSettled(
    domains.map((d: string) => lookupDomain(d.toLowerCase()))
  );

  const data = results.map((r, i) => ({
    domain: domains[i],
    ...(r.status === 'fulfilled'
      ? { success: true, data: r.value }
      : { success: false, error: r.reason?.message ?? 'Lookup failed' }),
  }));

  res.json({ success: true, data });
});

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
```

## Step 5: Server Entry Point

```typescript
// src/server.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRoutes from './routes/api';
import { rateLimit } from './middleware/rate-limit';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/api', rateLimit);

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Domain Intelligence API running on port ${PORT}`);
});
```

## Running the API

```bash
# Development
npx tsx src/server.ts

# Production
npx tsc && node dist/server.js
```

## Example Requests

```bash
# Domain lookup
curl http://localhost:3000/api/domain/google.com

# Response:
{
  "success": true,
  "data": {
    "domain": "google.com",
    "status": ["client delete prohibited", "client transfer prohibited"],
    "registrar": "MarkMonitor Inc.",
    "createdDate": "1997-09-15T04:00:00Z",
    "expiryDate": "2028-09-14T04:00:00Z",
    "nameservers": ["ns1.google.com", "ns2.google.com", ...],
    "dnssec": false,
    "daysUntilExpiry": 907
  }
}

# IP lookup
curl http://localhost:3000/api/ip/8.8.8.8

# ASN lookup
curl http://localhost:3000/api/asn/15169

# Batch domains
curl -X POST http://localhost:3000/api/batch/domains \
  -H "Content-Type: application/json" \
  -d '{"domains": ["google.com", "github.com", "cloudflare.com"]}'
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
docker build -t domain-intel-api .
docker run -p 3000:3000 domain-intel-api
```

### Railway / Fly.io / Render

Most PaaS platforms auto-detect Node.js. Add a start script:

```json
{
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsc"
  }
}
```

## Going Further

- **Add authentication** — API keys or JWT for production use
- **Add a database** — Store query history and analytics
- **Add webhooks** — Notify when monitored domains change
- **Add OpenAPI docs** — Swagger/OpenAPI specification
- **Use RDAPify Pro** — Bulk monitoring, change detection, and webhooks built-in

---
date: 2026-02-08

*Full source code on [GitHub](https://github.com/rdapify/rdapify/tree/main/examples). Need help? Join [GitHub Discussions](https://github.com/rdapify/rdapify/discussions).*
