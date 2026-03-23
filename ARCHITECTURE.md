# Architecture Overview

**RDAPify** follows **Hexagonal Architecture** (Ports & Adapters) principles combined with **Clean Architecture** layering for maintainability, testability, and scalability.

## Current State (v0.3.0)

### Key Features
- **Streaming API**: Process large batch queries efficiently with memory streaming
- **Observability**: Prometheus metrics, OpenTelemetry integration, GraphQL introspection
- **Multi-region Bootstrap**: Distributed IANA bootstrap discovery with geographic routing
- **Advanced Caching**: Circuit breaker pattern, Redis pipeline optimization, LRU + TTL management
- **Runtime Support**: Node.js 20+, Bun, Deno, Cloudflare Workers
- **Native Bindings**: Rust implementation, Python (PyO3), Go (cgo) bindings available

## Layer Structure

```
┌──────────────────────────────────────────┐
│      Application Layer                   │  ← Entry Point
│  (RDAPClient, QueryOrchestrator,         │
│   BatchProcessor, MiddlewareManager)     │
├──────────────────────────────────────────┤
│      Core Layer                          │  ← Business Logic
│  (Ports/Interfaces, Domain Models)       │
├──────────────────────────────────────────┤
│      Infrastructure Layer                │  ← External Services
│  (Fetcher, Cache, Bootstrap, SSRF,       │
│   Logger, Metrics, RateLimiter)          │
├──────────────────────────────────────────┤
│      Shared Layer                        │  ← Cross-cutting Concerns
│  (Types, Errors, Validators, Constants)  │
└──────────────────────────────────────────┘
```

### Dependency Rule

```
Shared ← Core ← Application ← Infrastructure
```

- **Core** never depends on Infrastructure
- **Infrastructure** implements Core interfaces (Dependency Inversion Principle)
- **Application** orchestrates everything through dependency injection
- **Shared** is used by all layers

## Key Components

### 1. RDAPClient (Application Layer)

Main entry point for all RDAP queries. Orchestrates the entire query pipeline.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  timeout: 10000,
  cache: { ttl: 3600, maxSize: 1000 },
  privacy: { redactPII: true },
  metrics: { enabled: true }
});

// Simple queries
const domain = await client.domain('example.com');
const ip = await client.ip('192.0.2.1');
const asn = await client.asn('AS65000');

// Batch processing with streaming
const batchResults = client.batch()
  .add('domain', 'example.com')
  .add('domain', 'google.com')
  .stream()
  .on('data', (result) => console.log(result))
  .on('error', (error) => console.error(error));
```

### 2. Core Ports (Interfaces)

Define contracts for external services:

```typescript
// Caching interface
interface ICachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  clear(): Promise<void>;
}

// HTTP fetching interface
interface IFetcherPort {
  fetch(url: URL, options: FetchOptions): Promise<Response>;
  validateURL(url: URL): void;
}

// Registry discovery interface
interface IBootstrapPort {
  discover(query: string, type: QueryType): Promise<string[]>;
  cache(): Promise<void>;
}

// Data normalization interface
interface INormalizerPort {
  normalize(data: unknown, type: QueryType): Promise<NormalizedResponse>;
}

// PII redaction interface
interface IPIIRedactorPort {
  redact(data: Record<string, unknown>, level: PrivacyLevel): Record<string, unknown>;
}
```

### 3. Infrastructure Implementations

Concrete implementations of core ports:

- **CacheManager** - In-memory LRU cache with TTL, circuit breaker pattern, Redis support
- **Fetcher** - HTTP client with connection pooling, retry logic, streaming support
- **BootstrapDiscovery** - IANA bootstrap registry discovery with multi-region support
- **Normalizer** - JSONPath-based data transformation with type safety
- **PIIRedactor** - GDPR/CCPA-compliant PII removal with configurable levels
- **SSRFProtection** - Security validation against private IP ranges and DNS rebinding
- **MetricsCollector** - Prometheus metrics, performance tracking
- **AuditLogger** - Structured logging for compliance
- **RateLimiter** - Token bucket implementation for quota management
- **ConnectionPool** - HTTP/2 connection pooling and reuse

## Design Patterns

### 1. Dependency Inversion
Core defines interfaces, Infrastructure implements them.

```typescript
class QueryOrchestrator {
  constructor(
    private cache: ICachePort,
    private fetcher: IFetcherPort,
    private bootstrap: IBootstrapPort,
    private normalizer: INormalizerPort
  ) {}
}
```

### 2. Repository Pattern
Cache acts as a repository for RDAP responses.

```typescript
const cachedResult = await cache.get(`domain:example.com`);
if (!cachedResult) {
  const result = await fetcher.fetch(url);
  await cache.set(`domain:example.com`, result, 3600);
}
```

### 3. Strategy Pattern
Different normalizers for different data types.

```typescript
const normalizer = new Normalizer({
  domain: domainNormalizationStrategy,
  ip: ipNormalizationStrategy,
  asn: asnNormalizationStrategy
});
```

### 4. Chain of Responsibility
Error handling with retry logic and fallbacks.

```typescript
const response = await retryStrategy
  .withMaxAttempts(3)
  .withBackoff(exponentialBackoff)
  .withFallback(fallbackRegistry)
  .execute(() => fetcher.fetch(url));
```

### 5. Factory Pattern
Client factory for creating configured instances.

```typescript
const client = RDAPClient.create({
  presets: 'production',
  customCache: new RedisCache(),
  metrics: prometheusCollector
});
```

### 6. Observer Pattern
Event-driven architecture for streaming and monitoring.

```typescript
client.on('query', (event) => console.log(event));
client.on('cache-hit', (event) => metrics.recordHit());
client.on('fetch-error', (event) => alerting.notify(event));
```

## Data Flow

### Simple Query Pipeline

```
User Request
    ↓
RDAPClient.domain('example.com')
    ↓
QueryOrchestrator.execute()
    ├─ InputValidator: Validate domain format
    │   ↓
    ├─ CacheManager: Check L1/L2 cache
    │   ├→ Cache Hit? Return (emit event)
    │   └→ Cache Miss? Continue
    │       ↓
    ├─ BootstrapDiscovery: Find authoritative server
    │   └→ Query IANA bootstrap registry
    │       ↓
    ├─ SSRFProtection: Validate bootstrap URL
    │   └→ Check private IP ranges, DNS rebinding
    │       ↓
    ├─ Fetcher: Fetch from RDAP server
    │   └→ HTTP request with connection pooling
    │       ↓
    ├─ Normalizer: Transform raw RDAP to schema
    │   └→ JSONPath-based extraction
    │       ↓
    ├─ PIIRedactor: Remove personal data (GDPR/CCPA)
    │   └→ Redact email, phone, addresses based on privacy level
    │       ↓
    ├─ CacheManager: Store normalized result
    │   └→ L1 (in-memory) + L2 (Redis) if configured
    │       ↓
    └─ Return DomainResponse
        ↓
    User receives result
```

### Batch Processing with Streaming

```
BatchProcessor.stream()
    ↓
For each query in batch:
  ├─ Enqueue to processing queue
  │   ↓
  ├─ Worker processes with deduplication
  │   ├─ Check if same query in-flight
  │   ├─ Merge results if duplicate
  │   └─ Execute pipeline (cache → bootstrap → fetch → normalize → redact)
  │       ↓
  └─ Emit 'data' event with result
        ↓
    Stream to application
```

## Query Types

RDAPify supports 5 core query types:

1. **Domain**: `client.domain('example.com')` - TLD/SLD registration info
2. **IP**: `client.ip('192.0.2.1')` - Network registration info
3. **ASN**: `client.asn('AS65000')` - Autonomous system info
4. **Nameserver**: `client.nameserver('ns1.example.com')` - DNS server info
5. **Entity**: `client.entity('contact-id')` - Registrant/contact info

Each supports:
- Individual queries
- Batch processing
- Streaming results
- Custom normalizers
- Privacy redaction levels

## Security Architecture

### Defense in Depth

1. **Input Validation**
   - Domain format validation (length, characters)
   - IP address validation (IPv4, IPv6 CIDR)
   - ASN format validation
   - Query type whitelist

2. **SSRF Protection**
   - Private IP range blocking (RFC 1918, 6598, 4193)
   - Loopback address filtering
   - Link-local address filtering
   - DNS rebinding protection (re-validate before connection)

3. **Certificate Validation**
   - TLS certificate verification
   - Hostname validation
   - HSTS support
   - Certificate pinning (configurable)

4. **PII Redaction**
   - Email addresses redaction by default
   - Phone numbers redaction
   - Postal addresses redaction
   - Names/persons redaction (configurable)
   - GDPR Article 32 compliance

5. **Rate Limiting**
   - Token bucket algorithm
   - Per-IP or per-API-key quotas
   - Backpressure handling
   - Adaptive throttling

### Privacy by Design

- PII redaction enabled by default
- Configurable privacy levels (strict, standard, permissive)
- No telemetry collection by default (opt-in only)
- Audit logging for compliance
- Data minimization principle

## Performance Architecture

### Caching Strategy

**Three-tier caching system:**

- **L1 Cache**: In-memory LRU (1-hour default TTL)
  - Fast, process-local
  - Configurable max size (default: 1000 entries)

- **L2 Cache**: Redis (via RedisCache adapter)
  - Persistent across restarts
  - Shareable across processes
  - TTL inheritance from L1

- **L3 Cache**: CDN edge cache (future)
  - Geographic distribution
  - Reduced latency to RDAP servers

### Optimization Techniques

- **Connection Pooling**: HTTP/2 multiplexing with keep-alive
- **Bootstrap Caching**: IANA bootstrap registry cached locally
- **Query Deduplication**: In-flight request merging
- **Batch Processing**: Stream large query sets efficiently
- **Compression**: gzip/brotli response compression
- **Circuit Breaker**: Fail-fast for degraded services
- **Metrics-driven**: Observability for performance tuning

### Benchmarks

```
Domain lookup (cached):     < 1ms
Domain lookup (uncached):   100-500ms
IP lookup:                  50-200ms
Batch 1000 queries:         5-30s (depends on cache hit rate)
Memory overhead:            ~1-5MB per 1000 cached entries
CPU usage (idle):           <1% single query
```

## Extensibility

### Plugin System

Customize behavior through middleware:

```typescript
// Authentication middleware
client.use({
  async beforeFetch(context) {
    context.headers['Authorization'] = `Bearer ${token}`;
    return context;
  }
});

// Custom caching strategy
client.use({
  getCache: () => new RedisCache(),
  setCache: (key, value, ttl) => redisCache.set(key, value, ttl)
});

// Custom normalizer
client.use({
  getNormalizer: () => new CustomNormalizer()
});

// Custom logger
client.use({
  log: (level, message, context) => {
    console.log(`[${level}] ${message}`, context);
  }
});
```

### Custom Implementations

Implement core ports for custom behavior:

```typescript
// Custom cache implementation
class DynamoDBCache implements ICachePort {
  async get<T>(key: string): Promise<T | null> {
    const item = await dynamodb.getItem({
      TableName: 'rdap-cache',
      Key: { pk: { S: key } }
    });
    return item.Item?.data?.S ? JSON.parse(item.Item.data.S) : null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await dynamodb.putItem({
      TableName: 'rdap-cache',
      Item: {
        pk: { S: key },
        data: { S: JSON.stringify(value) },
        ttl: { N: String((Date.now() + (ttl || 3600) * 1000) / 1000) }
      }
    });
  }

  async clear(): Promise<void> {
    await dynamodb.deleteTable({ TableName: 'rdap-cache' });
  }
}

const client = new RDAPClient({
  cache: new DynamoDBCache()
});
```

## Testing Architecture

### Test Pyramid

```
        ╱╲
       ╱E2E╲         ← Few, slow, expensive
      ╱──────╲
     ╱Integr.╲      ← Some, medium speed
    ╱──────────╲
   ╱   Unit     ╲   ← Many, fast, cheap
  ╱──────────────╲
```

### Test Coverage

- **Unit Tests**: ≥80% coverage (branches, functions, lines, statements)
- **Integration Tests**: Critical paths, multi-component flows
- **E2E Tests**: User scenarios, real RDAP servers (live tests)
- **Security Tests**: SSRF protection, input validation, PII redaction
- **Performance Tests**: Benchmarks for cache, batch processing

### Test Organization

```
tests/
├── unit/
│   ├── core/
│   │   ├── domain-models.test.ts
│   │   └── ports.test.ts
│   ├── application/
│   │   └── rdap-client.test.ts
│   ├── infrastructure/
│   │   ├── cache.test.ts
│   │   ├── fetcher.test.ts
│   │   └── ssrf-protection.test.ts
│   └── shared/
│       └── validators.test.ts
├── integration/
│   ├── query-orchestrator.integration.ts
│   ├── cache-bootstrap.integration.ts
│   └── batch-processing.integration.ts
├── security/
│   ├── ssrf.security.test.ts
│   ├── pii-redaction.security.test.ts
│   └── injection.security.test.ts
└── e2e/
    ├── domain-lookup.e2e.ts
    ├── batch-processing.e2e.ts
    └── error-handling.e2e.ts
```

## Versioning & API Stability

### Semantic Versioning

- **MAJOR** (v1.0.0): Breaking changes, new architecture, major features
- **MINOR** (v0.3.0): New features, backward compatible
- **PATCH** (v0.3.1): Bug fixes, security patches, internal improvements

### API Stability

- **v0.x**: Alpha/Beta stability - APIs may change
- **v1.0**: Stable API, backward compatibility guaranteed for v1.x
- **Deprecation Engine**: Gradual API transitions with warnings

### Deprecation Policy

1. Mark API as deprecated in docs and code
2. Emit runtime warnings for 2 minor versions
3. Remove in next major version
4. Provide migration guides

## Module Architecture

### Core Modules

```
src/
├── application/              ← High-level orchestration
│   ├── rdap-client.ts       ← Main entry point
│   ├── query-orchestrator.ts ← Query execution pipeline
│   ├── batch-processor.ts    ← Batch query handling
│   └── middleware-manager.ts ← Plugin system
├── core/                      ← Business logic & interfaces
│   ├── ports/
│   │   ├── cache.port.ts
│   │   ├── fetcher.port.ts
│   │   ├── bootstrap.port.ts
│   │   ├── normalizer.port.ts
│   │   └── pii-redactor.port.ts
│   ├── domain-models/
│   │   ├── domain-response.ts
│   │   ├── ip-response.ts
│   │   └── query-context.ts
│   └── use-cases/
│       └── lookup-domain.use-case.ts
├── infrastructure/            ← External service implementations
│   ├── cache-manager.ts
│   ├── fetcher.ts
│   ├── bootstrap-discovery.ts
│   ├── normalizer.ts
│   ├── pii-redactor.ts
│   ├── ssrf-protection.ts
│   ├── metrics-collector.ts
│   ├── audit-logger.ts
│   ├── rate-limiter.ts
│   └── connection-pool.ts
├── shared/                    ← Cross-cutting concerns
│   ├── types/
│   │   ├── common.types.ts
│   │   └── responses.types.ts
│   ├── errors/
│   │   ├── base.error.ts
│   │   ├── rdap.error.ts
│   │   └── validation.error.ts
│   ├── utils/
│   │   ├── validators/
│   │   ├── transformers/
│   │   └── helpers/
│   └── constants/
│       └── index.ts
└── cli/                       ← Command-line interface
    └── index.ts
```

## Integration Points

### rdapify-rust Integration

RDAPify can use the optional Rust implementation (`rdapify-nd` Node.js binding) for:
- High-performance SSRF validation
- Batch query deduplication
- RDAP response normalization

```typescript
// Optional native acceleration
import { RDAPClientWithNative } from 'rdapify/native';

const client = new RDAPClientWithNative({
  useNativeSSRF: true,
  useNativeNormalizer: true
});
```

### @rdapify/pro Integration

The Pro plugin adds:
- License validation
- Bulk query monitoring
- Change detection
- Analytics and reporting
- Webhook integrations

```typescript
import { RDAPClient } from 'rdapify';
import { ProPlugin } from '@rdapify/pro';

const client = new RDAPClient();
client.use(ProPlugin({ licenseKey: 'pro-xxxx' }));
```

## Future Directions

### Planned Enhancements

1. **Performance**
   - CDN edge caching (L3)
   - WebAssembly SSRF validation
   - Streaming normalizer
   - Batch API optimization

2. **Features**
   - WHOIS fallback protocol
   - RFC 8982 support (privacy concerns)
   - GraphQL subscription support
   - WebSocket bidirectional streaming

3. **Integrations**
   - OpenTelemetry auto-instrumentation
   - Datadog/Grafana cloud integrations
   - AWS/Azure/GCP managed services
   - Kubernetes operators

4. **Compliance**
   - SOC2 Type II certification
   - ISO 27001 alignment
   - HIPAA compliance options
   - Zero-knowledge architecture

---

**Last Updated**: March 23, 2026
**Version**: 0.3.0
**Links**:
- [Security Guide](SECURITY.md)
- [Privacy Policy](PRIVACY.md)
- [Contributing Guide](CONTRIBUTING.md)
- [RDAP Protocol (RFC 7480)](https://tools.ietf.org/html/rfc7480)
- [Roadmap](https://github.com/rdapify/rdapify/discussions/categories/roadmap)
