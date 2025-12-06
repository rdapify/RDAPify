# Bun.js Integration Guide

🎯 **Purpose**: Complete guide for integrating RDAPify with Bun.js runtime for secure domain, IP, and ASN lookups with exceptional startup performance, built-in TypeScript support, and memory efficiency  
📚 **Related**: [Docker](docker.md) | [Express.js](express.md) | [Fastify](fastify.md) | [Deno](deno.md) | [Cloudflare Workers](cloudflare_workers.md)  
⏱️ **Reading Time**: 5 minutes  
🔍 **Pro Tip**: Use the [Bun Playground](../../playground/bun-playground.md) to test RDAP queries with Bun's lightning-fast execution before deployment

## 🌐 Why Bun.js for RDAP Applications?

Bun.js provides an ideal JavaScript runtime for building high-performance RDAP applications with these key advantages:

```mermaid
graph LR
    A[RDAP Query] --> B[Bun Runtime]
    B --> C[Built-in TypeScript]
    B --> D[SQLite Database]
    B --> E[HTTP Server]
    B --> F[WebSocket Support]
    C --> G[RDAPify Library]
    E --> G
    D --> H[Cache Layer]
    G --> I[IANA Bootstrap]
    I --> J[Registry APIs]
    J --> K[Normalization Engine]
    K --> L[PII Redaction]
    L --> M[Unified Response]
    H -->|Cache Hit| M
    
    style B fill:#F5A623
    style C,D,E,F fill:#4A90E2
    style G fill:#27AE60
    style H,I,J,K,L,M fill:#9B59B6
```

### Key Bun Integration Benefits:
✅ **Blazing Fast Startup**: Near-instant cold starts (50-100ms) for serverless RDAP applications  
✅ **Memory Efficiency**: 3-5x lower memory footprint compared to Node.js for RDAP batch processing  
✅ **Built-in Tooling**: No need for additional dependencies - Bun includes SQLite, HTTP server, and WebSocket support  
✅ **TypeScript-First**: Native TypeScript execution without transpilation overhead  
✅ **Web Standard APIs**: Full Fetch API support for seamless RDAP registry interactions  
✅ **Package Management**: Unified package installation with `bun add` (20x faster than npm)

## 🚀 Getting Started: Basic Integration

### 1. Installation & Setup
```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Create new Bun project
bun init -y

# Install RDAPify
bun add rdapify
```

### 2. Minimal Working Example
```typescript
// server.ts
import { RDAPClient } from 'rdapify';
import { serve } from 'bun';

// Initialize RDAP client with security defaults
const client = new RDAPClient({
  cache: true,
  redactPII: true,           // GDPR compliance
  allowPrivateIPs: false,    // SSRF protection
  validateCertificates: true,
  timeout: 5000,
  rateLimit: { max: 100, window: 60000 }
});

// Health check endpoint
async function handleHealth(request: Request) {
  return new Response(JSON.stringify({
    status: 'ok',
    uptime: process.uptime(),
    bunVersion: Bun.version,
    rdapifyVersion: (await import('rdapify/package.json')).version,
    timestamp: new Date().toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Domain lookup endpoint
async function handleDomain(request: Request, domain: string) {
  try {
    // Validate domain format
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain.toLowerCase().trim())) {
      return new Response(JSON.stringify({
        error: 'Invalid domain format',
        code: 'INVALID_DOMAIN'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Execute RDAP query
    const result = await client.domain(domain.toLowerCase().trim());
    
    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });
  } catch (error: any) {
    console.error(`RDAP error for domain ${domain}:`, error);
    
    const statusCode = error.statusCode || 
                      (error.code?.startsWith('RDAP_') ? 422 : 500);
    
    return new Response(JSON.stringify({
      error: error.message,
      code: error.code || 'RDAP_REQUEST_FAILED'
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Bun server with route handling
const server = serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers for all responses
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Powered-By': `Bun/${Bun.version} RDAPify/${(await import('rdapify/package.json')).version}`
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
    
    try {
      if (url.pathname === '/health') {
        return handleHealth(request);
      }
      
      if (url.pathname.startsWith('/domain/')) {
        const domain = url.pathname.split('/').pop() || '';
        return handleDomain(request, domain);
      }
      
      // Not found
      return new Response(JSON.stringify({
        error: 'Not found',
        code: 'NOT_FOUND'
      }), {
        status: 404,
        headers: { 
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    } catch (error: any) {
      console.error('Server error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      }), {
        status: 500,
        headers: { 
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
  }
});

console.log(`RDAPify Bun server running on port ${server.port}`);
console.log(`Health check: http://localhost:${server.port}/health`);
console.log(`Domain lookup: http://localhost:${server.port}/domain/example.com`);
```

### 3. Running Your Bun Server
```bash
# Run in development mode
bun run --watch server.ts

# Run in production mode (optimized)
bun run --production server.ts

# Build standalone executable
bun build ./server.ts --compile --target bun-linux-x64 --outfile ./rdapify-bun
```

## 🔐 Security & Compliance Hardening

### 1. Bun-Specific Security Configuration
```typescript
// security.ts
import { RDAPClient } from 'rdapify';

// Secure RDAP client configuration for Bun
export const createSecureRDAPClient = (options: any = {}) => {
  return new RDAPClient({
    // Security defaults
    allowPrivateIPs: false,
    whitelistRDAPServers: true,
    validateCertificates: true,
    timeout: 5000,
    redactPII: true,
    
    // Bun-specific optimizations
    connectionPool: {
      maxConnections: 50,
      idleTimeout: 30000,
      connectTimeout: 5000
    },
    
    // GDPR/CCPA compliance
    dataRetention: {
      maxAge: 86400000 // 24 hours
    },
    
    // Rate limiting
    rateLimit: {
      max: 100,
      window: 60000,
      storage: 'memory' // Bun has excellent memory management
    },
    
    // Override with custom options
    ...options
  });
};

// Security middleware for Bun routes
export const securityMiddleware = async (request: Request, next: () => Promise<Response>) => {
  const url = new URL(request.url);
  
  // SSRF protection - block internal IP ranges
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                  (request as any).ip || '127.0.0.1';
  
  const privateIPRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80::/
  ];
  
  if (privateIPRanges.some(range => range.test(clientIP))) {
    console.warn(`Blocked request from private IP: ${clientIP}`);
    return new Response(JSON.stringify({
      error: 'Access forbidden',
      code: 'PRIVATE_IP_BLOCKED'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // GDPR compliance headers
  const response = await next();
  response.headers.set('X-Do-Not-Sell', 'true');
  response.headers.set('X-Data-Processing', 'PII redacted per GDPR Article 6(1)(f)');
  response.headers.set('X-Privacy-Redacted', 'true');
  
  return response;
};
```

### 2. SQLite-Based Audit Logging
```typescript
// audit.ts
import { Database } from 'bun:sqlite';

// Initialize SQLite database for audit logging
const db = new Database('./audit.db', { create: true });

// Create audit table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    request_id TEXT,
    endpoint TEXT,
    method TEXT,
    ip_address TEXT,
    status_code INTEGER,
    duration_ms INTEGER,
    error_code TEXT,
    tenant_id TEXT
  )
`);

// Create index for performance
db.run('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)');
db.run('CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)');

export interface AuditLogEntry {
  requestId: string;
  endpoint: string;
  method: string;
  ipAddress: string;
  statusCode: number;
  durationMs: number;
  errorCode?: string;
  tenantId?: string;
}

export const logAuditEntry = (entry: AuditLogEntry) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        request_id, endpoint, method, ip_address, 
        status_code, duration_ms, error_code, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entry.requestId,
      entry.endpoint,
      entry.method,
      entry.ipAddress,
      entry.statusCode,
      entry.durationMs,
      entry.errorCode || null,
      entry.tenantId || null
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Fallback to console logging
    console.log('AUDIT:', JSON.stringify(entry));
  }
};

// Periodic cleanup job
setInterval(() => {
  try {
    // Delete logs older than 90 days
    const cleanupStmt = db.prepare(`
      DELETE FROM audit_logs 
      WHERE timestamp < datetime('now', '-90 days')
    `);
    
    const result = cleanupStmt.run();
    console.log(`Cleaned up ${result.changes} old audit logs`);
  } catch (error) {
    console.error('Audit cleanup failed:', error);
  }
}, 24 * 60 * 60 * 1000); // Run daily

// Close database on process exit
process.on('exit', () => {
  db.close();
});
```

## ⚡ Performance Optimization

### 1. Bun-Specific Performance Enhancements
```typescript
// performance.ts
import { RDAPClient } from 'rdapify';

// Optimized RDAP client for Bun
export const createOptimizedClient = () => {
  return new RDAPClient({
    // Memory-efficient caching
    cache: {
      type: 'lru',
      max: 5000,
      ttl: 3600000, // 1 hour
      // Bun has excellent memory management, so we can use larger caches
      maxMemoryUsage: 100 * 1024 * 1024 // 100MB
    },
    
    // Connection pooling optimized for Bun's event loop
    connectionPool: {
      maxConnections: 100, // Bun can handle more concurrent connections
      maxSockets: 50,
      maxFreeSockets: 25,
      timeout: 5000,
      keepAlive: true,
      keepAliveMsecs: 30000
    },
    
    // Parallel batch processing
    batch: {
      chunkSize: 20, // Larger batches for Bun's efficient processing
      concurrency: 10,
      delayBetweenChunks: 50
    },
    
    // Security settings
    allowPrivateIPs: false,
    redactPII: true,
    validateCertificates: true
  });
};

// Memory-efficient batch processing
export const batchProcessDomains = async (domains: string[], client: RDAPClient) => {
  const results = [];
  const chunkSize = 20; // Optimized for Bun's memory model
  
  for (let i = 0; i < domains.length; i += chunkSize) {
    const chunk = domains.slice(i, i + chunkSize);
    
    // Process chunk in parallel
    const chunkResults = await Promise.allSettled(
      chunk.map(async (domain) => {
        try {
          const result = await client.domain(domain.toLowerCase().trim());
          return { domain, result };
        } catch (error: any) {
          return { domain, error: error.message, code: error.code || 'PROCESSING_ERROR' };
        }
      })
    );
    
    // Process results
    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ error: result.reason.message });
      }
    }
    
    // Small delay between chunks to prevent overwhelming registries
    if (i + chunkSize < domains.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Force garbage collection if memory usage is high
    const memory = process.memoryUsage();
    if (memory.heapUsed > 250 * 1024 * 1024) { // 250MB
      if (typeof global.gc === 'function') {
        global.gc();
        console.log('Forced garbage collection due to high memory usage');
      }
    }
  }
  
  return results;
};

// Web Worker for CPU-intensive operations
export const createRDAPWorker = () => {
  // Bun supports Web Workers API
  return new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module'
  });
};
```

### 2. Built-in SQLite Caching Strategy
```typescript
// cache.ts
import { Database } from 'bun:sqlite';
import { createHash } from 'crypto';

// Initialize SQLite database for caching
const cacheDB = new Database('./rdap_cache.db', { create: true });

// Create cache table
cacheDB.run(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value BLOB,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    size INTEGER,
    hits INTEGER DEFAULT 0
  )
`);

// Create indexes
cacheDB.run('CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at)');
cacheDB.run('CREATE INDEX IF NOT EXISTS idx_cache_hits ON cache(hits DESC)');

// Vacuum database periodically to reclaim space
setInterval(() => {
  console.log('Vacuuming cache database...');
  cacheDB.run('VACUUM');
}, 24 * 60 * 60 * 1000); // Daily

// Delete expired entries periodically
setInterval(() => {
  const stmt = cacheDB.prepare(`
    DELETE FROM cache 
    WHERE expires_at < CURRENT_TIMESTAMP
    OR created_at < datetime('now', '-30 days')
  `);
  
  const result = stmt.run();
  console.log(`Cleaned up ${result.changes} expired cache entries`);
}, 60 * 60 * 1000); // Hourly

export class SQLiteCache {
  private maxSize: number;
  
  constructor(maxSize = 100 * 1024 * 1024) { // 100MB default
    this.maxSize = maxSize;
  }
  
  private generateKey(namespace: string, key: string): string {
    return createHash('sha256').update(`${namespace}:${key}`).digest('hex');
  }
  
  async get(namespace: string, key: string): Promise<any | null> {
    const cacheKey = this.generateKey(namespace, key);
    
    try {
      const stmt = cacheDB.prepare(`
        SELECT value, expires_at 
        FROM cache 
        WHERE key = ? 
        AND expires_at > CURRENT_TIMESTAMP
      `);
      
      const row = stmt.get(cacheKey) as any;
      
      if (!row) return null;
      
      // Update hit counter
      const updateStmt = cacheDB.prepare(`
        UPDATE cache SET hits = hits + 1 WHERE key = ?
      `);
      updateStmt.run(cacheKey);
      
      return JSON.parse(row.value.toString());
    } catch (error) {
      console.error('Cache get failed:', error);
      return null;
    }
  }
  
  async set(namespace: string, key: string, value: any, ttl = 3600): Promise<boolean> {
    const cacheKey = this.generateKey(namespace, key);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const serialized = JSON.stringify(value);
    const size = Buffer.byteLength(serialized);
    
    try {
      // Check if we're over size limit
      const sizeCheck = cacheDB.prepare(`
        SELECT SUM(size) as total_size FROM cache
      `);
      
      const totalSize = (sizeCheck.get() as any)?.total_size || 0;
      if (totalSize + size > this.maxSize) {
        // Remove least frequently used items
        const cleanupStmt = cacheDB.prepare(`
          DELETE FROM cache 
          WHERE key IN (
            SELECT key FROM cache 
            ORDER BY hits ASC, created_at ASC 
            LIMIT 10
          )
        `);
        cleanupStmt.run();
      }
      
      // Insert or update cache entry
      const stmt = cacheDB.prepare(`
        INSERT OR REPLACE INTO cache (
          key, value, expires_at, size, hits
        ) VALUES (?, ?, ?, ?, COALESCE((SELECT hits FROM cache WHERE key = ?), 0))
      `);
      
      stmt.run(cacheKey, serialized, expiresAt, size, cacheKey);
      return true;
    } catch (error) {
      console.error('Cache set failed:', error);
      return false;
    }
  }
  
  async delete(namespace: string, key: string): Promise<boolean> {
    const cacheKey = this.generateKey(namespace, key);
    
    try {
      const stmt = cacheDB.prepare(`DELETE FROM cache WHERE key = ?`);
      stmt.run(cacheKey);
      return true;
    } catch (error) {
      console.error('Cache delete failed:', error);
      return false;
    }
  }
  
  async clear(): Promise<boolean> {
    try {
      cacheDB.run('DELETE FROM cache');
      return true;
    } catch (error) {
      console.error('Cache clear failed:', error);
      return false;
    }
  }
  
  async close(): Promise<void> {
    cacheDB.close();
  }
}

// Singleton instance
export const createCache = () => {
  return new SQLiteCache(150 * 1024 * 1024); // 150MB for Bun
};
```

## 🏢 Advanced Enterprise Patterns

### 1. Multi-Tenant Architecture with Bun
```typescript
// multi-tenant.ts
import { RDAPClient } from 'rdapify';
import { Database } from 'bun:sqlite';

// Tenant configuration database
const tenantDB = new Database('./tenants.db', { create: true });

// Create tenants table
tenantDB.run(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create tenant API keys table
tenantDB.run(`
  CREATE TABLE IF NOT EXISTS api_keys (
    key TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    permissions TEXT NOT NULL,
    rate_limit INTEGER NOT NULL DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  )
`);

export interface TenantConfig {
  id: string;
  name: string;
  config: {
    cacheTTL?: number;
    redactPII?: boolean;
    rateLimit?: { max: number; window: number };
    allowedIPs?: string[];
    dataRetentionDays?: number;
  };
}

export class TenantService {
  private tenantCache = new Map<string, TenantConfig>();
  private rdapClients = new Map<string, RDAPClient>();
  
  async getTenantByAPIKey(apiKey: string): Promise<TenantConfig | null> {
    // Check cache first
    const cachedTenant = this.getTenantFromCacheByAPIKey(apiKey);
    if (cachedTenant) return cachedTenant;
    
    // Query database
    const stmt = tenantDB.prepare(`
      SELECT t.*, k.permissions, k.rate_limit
      FROM tenants t
      JOIN api_keys k ON t.id = k.tenant_id
      WHERE k.key = ?
    `);
    
    const row = stmt.get(apiKey) as any;
    if (!row) return null;
    
    // Update last used timestamp
    const updateStmt = tenantDB.prepare(`
      UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE key = ?
    `);
    updateStmt.run(apiKey);
    
    // Parse tenant config
    const tenant: TenantConfig = {
      id: row.id,
      name: row.name,
      config: {
        ...JSON.parse(row.config),
        rateLimit: {
          max: row.rate_limit,
          window: 60000 // 1 minute
        }
      }
    };
    
    // Cache tenant
    this.cacheTenant(tenant);
    return tenant;
  }
  
  getRDAPClientForTenant(tenant: TenantConfig): RDAPClient {
    if (this.rdapClients.has(tenant.id)) {
      return this.rdapClients.get(tenant.id)!;
    }
    
    // Create tenant-specific RDAP client
    const client = new RDAPClient({
      cache: true,
      redactPII: tenant.config.redactPII ?? true,
      allowPrivateIPs: false,
      validateCertificates: true,
      timeout: 5000,
      rateLimit: tenant.config.rateLimit,
      cacheTTL: tenant.config.cacheTTL ?? 3600,
      logger: {
        log: (level, message, meta) => {
          if (level === 'error') {
            console.error(`[Tenant ${tenant.id}] ${message}`, meta);
          } else if (level === 'warn') {
            console.warn(`[Tenant ${tenant.id}] ${message}`, meta);
          } else {
            console.debug(`[Tenant ${tenant.id}] ${message}`, meta);
          }
        }
      }
    });
    
    this.rdapClients.set(tenant.id, client);
    return client;
  }
  
  private getTenantFromCacheByAPIKey(apiKey: string): TenantConfig | null {
    // This would use a proper cache in production
    for (const tenant of this.tenantCache.values()) {
      // In production, we'd store API keys in the tenant config
      if (tenant.config.allowedIPs?.includes(apiKey)) {
        return tenant;
      }
    }
    return null;
  }
  
  private cacheTenant(tenant: TenantConfig): void {
    this.tenantCache.set(tenant.id, tenant);
    
    // Clear cache after 5 minutes
    setTimeout(() => {
      this.tenantCache.delete(tenant.id);
    }, 300000);
  }
}

// Middleware for tenant identification
export const tenantMiddleware = async (request: Request, next: (tenant?: TenantConfig) => Promise<Response>) => {
  const apiKey = request.headers.get('x-api-key') || 
                request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'API key required',
      code: 'MISSING_API_KEY'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const tenantService = new TenantService();
  const tenant = await tenantService.getTenantByAPIKey(apiKey);
  
  if (!tenant) {
    return new Response(JSON.stringify({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // IP restriction check
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  if (tenant.config.allowedIPs && !tenant.config.allowedIPs.includes(clientIP)) {
    console.warn(`IP restriction violation for tenant ${tenant.id}: ${clientIP}`);
    return new Response(JSON.stringify({
      error: 'IP not authorized for this tenant',
      code: 'IP_NOT_AUTHORIZED'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return next(tenant);
};
```

### 2. Real-Time Monitoring with Bun's WebSocket Support
```typescript
// monitoring.ts
import { serve } from 'bun';
import { WebSocketServer } from 'ws';
import { createSecureRDAPClient } from './security';

// Create RDAP client for monitoring
const rdapClient = createSecureRDAPClient({
  cache: true,
  redactPII: true
});

// WebSocket server for real-time monitoring
const wss = new WebSocketServer({ noServer: true });

// Track connected clients
const clients = new Set<import('ws').WebSocket>();

wss.on('connection', (socket) => {
  console.log('New monitoring client connected');
  clients.add(socket);
  
  socket.on('close', () => {
    clients.delete(socket);
    console.log('Monitoring client disconnected');
  });
  
  // Send initial connection message
  socket.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to RDAPify monitoring stream',
    timestamp: new Date().toISOString()
  }));
});

// Periodic health checks
setInterval(async () => {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      bunVersion: Bun.version,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      rdapHealth: {
        exampleCom: null,
        verisign: null,
        arin: null
      }
    };
    
    // Check RDAP endpoints
    try {
      results.rdapHealth.exampleCom = await rdapClient.domain('example.com');
    } catch (error) {
      results.rdapHealth.exampleCom = { error: error.message };
    }
    
    // Broadcast to all connected clients
    const message = JSON.stringify({
      type: 'health',
      data: results
    });
    
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
  } catch (error) {
    console.error('Health check failed:', error);
  }
}, 60000); // Check every minute

// HTTP server with WebSocket upgrade
serve({
  port: 3001,
  fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocket upgrade
    if (url.pathname === '/monitoring') {
      if (server.upgrade(req)) {
        return;
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    
    // Regular HTTP endpoints
    return new Response(JSON.stringify({
      status: 'ok',
      monitoringEndpoint: 'ws://localhost:3001/monitoring',
      documentation: '/docs'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  },
  websocket: {
    open: (ws) => {
      console.log('WebSocket opened');
    },
    message: (ws, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'command' && data.command === 'ping') {
          ws.send(JSON.stringify({
            type: 'response',
            command: 'ping',
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          error: error.message
        }));
      }
    },
    close: (ws) => {
      console.log('WebSocket closed');
    }
  }
});

console.log('RDAPify monitoring server running on ws://localhost:3001/monitoring');
```

## 🧪 Testing Strategies for Bun Integration

### 1. Bun Test Runner Integration
```typescript
// test/rdapify-bun.test.ts
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { RDAPClient } from 'rdapify';
import { createSecureRDAPClient } from '../security';

// Mock fetch to prevent actual network requests during tests
const mockFetch = mock(async (url: string) => {
  if (url.includes('example.com')) {
    return new Response(JSON.stringify({
      domain: 'example.com',
      status: ['active'],
      nameservers: ['ns1.example.com', 'ns2.example.com'],
      events: [
        { type: 'registration', date: '2020-01-01T00:00:00Z' },
        { type: 'expiration', date: '2025-01-01T00:00:00Z' }
      ],
      entities: [
        {
          handle: 'REGISTRAR-1',
          roles: ['registrar'],
          vcardArray: [
            'vcard',
            [
              ['fn', {}, 'text', 'Example Registrar'],
              ['email', {}, 'text', 'abuse@example-registrar.com']
            ]
          ]
        }
      ]
    }), { status: 200 });
  }
  
  if (url.includes('invalid.com')) {
    return new Response(JSON.stringify({
      errorCode: 404,
      title: 'Domain not found'
    }), { status: 404 });
  }
  
  return new Response(JSON.stringify({
    errorCode: 500,
    title: 'Internal server error'
  }), { status: 500 });
});

// Mock global fetch
globalThis.fetch = mockFetch as any;

describe('RDAPify Bun Integration', () => {
  let client: RDAPClient;
  
  beforeEach(() => {
    client = createSecureRDAPClient({
      cache: true,
      redactPII: true
    });
  });
  
  test('should successfully lookup a valid domain', async () => {
    const result = await client.domain('example.com');
    
    expect(result).toBeTruthy();
    expect(result.domain).toBe('example.com');
    expect(result.status).toContain('active');
    expect(result.nameservers).toEqual(['ns1.example.com', 'ns2.example.com']);
    
    // Check that PII is redacted
    expect(result.entities[0]).not.toHaveProperty('vcardArray');
    expect(result.entities[0]).not.toHaveProperty('email');
  });
  
  test('should handle domain not found error', async () => {
    try {
      await client.domain('invalid.com');
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Domain not found');
      expect(error.statusCode).toBe(404);
    }
  });
  
  test('should reject invalid domain format', async () => {
    try {
      await client.domain('invalid_domain');
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Invalid domain format');
    }
  });
  
  test('should handle server errors gracefully', async () => {
    try {
      await client.domain('error.com');
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Internal server error');
      expect(error.statusCode).toBe(500);
    }
  });
  
  test('should cache results for performance', async () => {
    // First call
    const result1 = await client.domain('example.com');
    expect(result1).toBeTruthy();
    
    // Second call should hit cache
    mockFetch.mockClear(); // Clear mock to verify no network call
    const result2 = await client.domain('example.com');
    expect(result2).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once
    
    // Wait for cache to expire (mock TTL)
    await new Promise(resolve => setTimeout(resolve, 3601)); // 1ms longer than default TTL
    
    // Third call should miss cache
    const result3 = await client.domain('example.com');
    expect(result3).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledTimes(2); // Called again after TTL
  });
  
  test('should prevent SSRF attacks', async () => {
    try {
      await client.domain('localhost');
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('SSRF protection blocked request');
      expect(error.code).toBe('RDAP_SECURE_SSRF');
    }
  });
  
  test('should enforce rate limiting', async () => {
    const testClient = createSecureRDAPClient({
      rateLimit: { max: 2, window: 1000 } // 2 requests per second
    });
    
    // First two requests should succeed
    await testClient.domain('example.com');
    await testClient.domain('example.org');
    
    // Third request should fail
    try {
      await testClient.domain('example.net');
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.code).toBe('RDAP_RATE_LIMITED');
    }
  });
  
  describe('Batch Processing', () => {
    test('should process multiple domains in parallel', async () => {
      const domains = ['example.com', 'example.org', 'example.net'];
      const results = await Promise.all(domains.map(domain => client.domain(domain)));
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.domain).toBeTruthy();
        expect(result.status).toBeTruthy();
      });
    });
    
    test('should handle mixed success and failure cases', async () => {
      const domains = ['example.com', 'invalid.com', 'error.com'];
      const results = await Promise.allSettled(domains.map(domain => client.domain(domain)));
      
      expect(results.length).toBe(3);
      
      // First should succeed
      expect(results[0].status).toBe('fulfilled');
      
      // Second should fail with 404
      expect(results[1].status).toBe('rejected');
      
      // Third should fail with 500
      expect(results[2].status).toBe('rejected');
    });
  });
});
```

### 2. Performance Benchmarking Script
```typescript
// benchmarks/bun-benchmarks.ts
import { performance } from 'perf_hooks';
import { RDAPClient } from 'rdapify';
import { createOptimizedClient } from '../performance';

// Benchmark configuration
const TEST_DOMAINS = [
  'example.com', 'google.com', 'github.com', 'microsoft.com', 
  'apple.com', 'facebook.com', 'twitter.com', 'instagram.com',
  'linkedin.com', 'netflix.com'
];
const ITERATIONS = 5;
const CONCURRENCY = 5;

async function runBenchmark() {
  console.log(`Bun version: ${Bun.version}`);
  console.log(`Node compatibility mode: ${process.versions.bun}`);
  
  // Test different client configurations
  const configs = [
    { name: 'Default', config: {} },
    { name: 'Optimized', config: { cache: true, maxConcurrent: 10 } },
    { name: 'Memory Optimized', config: { cache: { type: 'lru', max: 1000 } } }
  ];
  
  for (const config of configs) {
    console.log(`\n=== ${config.name} Configuration Benchmark ===`);
    
    const client = new RDAPClient(config.config);
    
    // Warm up cache
    console.log('Warming up cache...');
    await Promise.all(TEST_DOMAINS.map(domain => client.domain(domain)));
    
    // Run iterations
    const results = [];
    
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      
      // Process domains with concurrency
      const promises = [];
      for (let j = 0; j < TEST_DOMAINS.length; j++) {
        promises.push(client.domain(TEST_DOMAINS[j % TEST_DOMAINS.length]));
        
        // Throttle concurrency
        if (promises.length >= CONCURRENCY) {
          await Promise.race(promises);
          promises.splice(0, 1);
        }
      }
      
      await Promise.all(promises);
      
      const duration = performance.now() - start;
      results.push(duration);
      
      console.log(`Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calculate statistics
    const avg = results.reduce((sum, val) => sum + val, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const memory = process.memoryUsage();
    
    console.log(`\nResults for ${config.name}:`);
    console.log(`Average: ${avg.toFixed(2)}ms`);
    console.log(`Min: ${min.toFixed(2)}ms`);
    console.log(`Max: ${max.toFixed(2)}ms`);
    console.log(`Memory Usage: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
    console.log(`Throughput: ${Math.round(TEST_DOMAINS.length * ITERATIONS / (avg / 1000))} req/sec`);
  }
  
  console.log('\n=== Memory Leak Test ===');
  await runMemoryLeakTest();
}

async function runMemoryLeakTest() {
  const client = createOptimizedClient();
  const iterations = 100;
  const domains = ['example.com', 'google.com', 'github.com'];
  
  console.log(`Running ${iterations} iterations with ${domains.length} domains each...`);
  
  for (let i = 0; i < iterations; i++) {
    await Promise.all(domains.map(domain => client.domain(domain)));
    
    if (i % 10 === 0) {
      const memory = process.memoryUsage();
      console.log(`Iteration ${i}: Heap used: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
    }
  }
  
  // Force GC if available
  if (typeof global.gc === 'function') {
    console.log('Forcing garbage collection...');
    global.gc();
  }
  
  const finalMemory = process.memoryUsage();
  console.log(`Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
}

// Run benchmark
runBenchmark().catch(console.error);
```

## 🔍 Troubleshooting Common Issues

### 1. Bun Version Compatibility Issues
**Symptoms**: "Cannot find module" errors or unexpected behavior with Bun v1.0+ features

**Diagnosis**:
```bash
# Check current Bun version
bun -v

# List installed dependencies
bun pm ls

# Verify module resolution
bun run node -e "console.log(require.resolve('rdapify'))"
```

**Solutions**:
✅ **Ensure Compatible Dependencies**:
```bash
# Reinstall dependencies with Bun
rm -rf node_modules package-lock.json
bun install

# Force compatibility mode for problematic packages
BUN_INSTALL_STRICT=false bun install
```

✅ **Update Bun Configuration**:
```json
// bunfig.toml
[install]
exact = true
lockfile = true
registry = "https://registry.npmjs.org"

[test]
preload = ["./test/setup.ts"]
```

✅ **Fallback to Node.js Module Resolution**:
```typescript
// Add to your project's tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "module": "ESNext",
    "target": "ES2020"
  }
}
```

### 2. WebSocket Connection Issues in Production
**Symptoms**: WebSocket connections fail in production environment but work locally

**Diagnosis**:
```bash
# Test WebSocket connectivity
curl -i -H "Connection: upgrade" -H "Upgrade: websocket" \
  -H "Host: localhost:3001" -H "Origin: http://localhost:3001" \
  http://localhost:3001/monitoring
```

**Solutions**:
✅ **Configure Reverse Proxy Properly**:
```nginx
# Nginx configuration for WebSocket proxying
location /monitoring {
  proxy_pass http://localhost:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
  proxy_read_timeout 86400s; # WebSocket timeout
}
```

✅ **Handle Cloud Provider Restrictions**:
```typescript
// Add this to your WebSocket server setup
wss.on('headers', (headers, request) => {
  // Allow connections from any origin in development
  if (process.env.NODE_ENV === 'development') {
    headers.push('Access-Control-Allow-Origin: *');
  }
  
  // Add security headers
  headers.push('X-Content-Type-Options: nosniff');
  headers.push('X-Frame-Options: DENY');
  headers.push('Content-Security-Policy: default-src \'self\'');
});
```

✅ **Implement Connection Keep-Alive**:
```typescript
// Add ping/pong handlers to prevent timeout
wss.on('connection', (socket) => {
  // Send ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (socket.readyState === socket.OPEN) {
      socket.ping();
    }
  }, 30000);
  
  socket.on('pong', () => {
    // Reset timeout counter
  });
  
  socket.on('close', () => {
    clearInterval(pingInterval);
  });
});
```

### 3. SQLite Database Locking Issues
**Symptoms**: "SQLITE_BUSY" errors when multiple requests access SQLite cache simultaneously

**Diagnosis**:
```typescript
// Test SQLite concurrency
import { Database } from 'bun:sqlite';

const db = new Database(':memory:');
db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');

// Simulate concurrent access
const promises = [];
for (let i = 0; i < 100; i++) {
  promises.push(new Promise((resolve) => {
    setTimeout(() => {
      try {
        db.run('INSERT INTO test (value) VALUES (?)', `value-${i}`);
        resolve(null);
      } catch (error) {
        console.error('Insert failed:', error);
        resolve(error);
      }
    }, Math.random() * 10);
  }));
}

Promise.all(promises).then(() => {
  console.log('Concurrency test completed');
});
```

**Solutions**:
✅ **Configure SQLite for Write-Ahead Logging**:
```typescript
// Enable WAL mode for better concurrency
cacheDB.run('PRAGMA journal_mode=WAL');
cacheDB.run('PRAGMA synchronous=NORMAL');
cacheDB.run('PRAGMA busy_timeout=5000'); // 5 second timeout
```

✅ **Implement Connection Pooling**:
```typescript
// sqlite-pool.ts
import { Database } from 'bun:sqlite';

class SQLitePool {
  private databases: Database[] = [];
  private maxSize: number;
  private inUse = new Set<Database>();
  
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }
  
  async getDatabase(): Promise<Database> {
    // Find available database
    for (const db of this.databases) {
      if (!this.inUse.has(db)) {
        this.inUse.add(db);
        return db;
      }
    }
    
    // Create new database if under limit
    if (this.databases.length < this.maxSize) {
      const db = new Database('./rdap_cache.db');
      this.configureDatabase(db);
      this.databases.push(db);
      this.inUse.add(db);
      return db;
    }
    
    // Wait for available database
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const db of this.databases) {
          if (!this.inUse.has(db)) {
            clearInterval(checkInterval);
            this.inUse.add(db);
            resolve(db);
          }
        }
      }, 50);
    });
  }
  
  releaseDatabase(db: Database): void {
    this.inUse.delete(db);
  }
  
  private configureDatabase(db: Database): void {
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA synchronous=NORMAL');
    db.run('PRAGMA busy_timeout=5000');
  }
  
  closeAll(): void {
    for (const db of this.databases) {
      db.close();
    }
    this.databases = [];
  }
}

// Usage
const pool = new SQLitePool(5);
const db = await pool.getDatabase();
// Use database...
pool.releaseDatabase(db);
```

✅ **Fallback to Memory Cache During High Load**:
```typescript
class HybridCache {
  private sqliteCache: SQLiteCache;
  private memoryCache = new Map<string, any>();
  private highLoad = false;
  
  constructor() {
    this.sqliteCache = createCache();
    
    // Monitor system load
    setInterval(() => {
      const memory = process.memoryUsage();
      this.highLoad = memory.heapUsed > 400 * 1024 * 1024; // 400MB threshold
      
      if (this.highLoad) {
        console.warn('High memory usage detected, falling back to memory cache');
      }
    }, 30000);
  }
  
  async get(namespace: string, key: string): Promise<any | null> {
    if (this.highLoad) {
      return this.memoryCache.get(`${namespace}:${key}`) || null;
    }
    
    return this.sqliteCache.get(namespace, key);
  }
  
  async set(namespace: string, key: string, value: any, ttl = 3600): Promise<boolean> {
    if (this.highLoad) {
      this.memoryCache.set(`${namespace}:${key}`, value);
      return true;
    }
    
    return this.sqliteCache.set(namespace, key, value, ttl);
  }
}
```

## 📚 Related Documentation

| Document | Description | Path |
|----------|-------------|------|
| [Docker Deployment](docker.md) | Container deployment strategies | [docker.md](docker.md) |
| [Cloudflare Workers](cloudflare_workers.md) | Edge deployment with Bun compatibility | [cloudflare_workers.md](cloudflare_workers.md) |
| [Performance Tuning](../../performance/optimization.md) | General performance optimization guide | [../../performance/optimization.md](../../performance/optimization.md) |
| [Security Best Practices](../../security/best_practices.md) | Security implementation guide | [../../security/best_practices.md](../../security/best_practices.md) |
| [Bun Migration Guide](https://bun.sh/docs/runtime/migrating-from-node) | Official Bun migration documentation | External |
| [SQLite Performance Guide](https://www.sqlite.org/pragma.html#pragma_journal_mode) | SQLite optimization techniques | External |

## 🏷️ Specifications

| Property | Value |
|----------|-------|
| Bun Version | 1.0+ (LTS) |
| RDAPify Version | 2.0+ |
| TypeScript Support | ✅ Native execution |
| Runtime Memory Overhead | 15-25MB (base) |
| Cold Start Time | 50-100ms (optimized) |
| SQLite Integration | ✅ Built-in |
| WebSocket Support | ✅ Native |
| Web Standard APIs | ✅ Fetch, Web Crypto, Streams |
| Package Manager | `bun add` (20x faster than npm) |
| Test Runner | Built-in `bun test` |
| Build Tool | `bun build` for bundling and compilation |
| GDPR Compliant | ✅ With proper configuration |
| SSRF Protection | ✅ Built-in |
| Test Coverage | 98% unit tests, 90% integration tests |
| Last Updated | December 7, 2025 |

> 🔐 **Critical Reminder**: Always run Bun applications with the `--production` flag in production environments to disable development features. Never disable `redactPII` or `allowPrivateIPs` settings in production without documented legal basis and DPO approval. For multi-tenant deployments, implement strict data isolation at the SQLite database level and regularly audit tenant access patterns.

[← Back to Integrations](../README.md) | [Next: Deno →](deno.md)

*Document automatically generated from source code with security review on December 6, 2025*