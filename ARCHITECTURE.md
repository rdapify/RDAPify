# Architecture Overview

**RDAPify** follows **Clean Architecture** principles for maintainability, testability, and scalability.

## Quick Reference

### Layer Structure
```
┌─────────────────────────────────────┐
│         Application Layer           │  ← Entry Point (RDAPClient)
│    (Orchestration & Coordination)   │
├─────────────────────────────────────┤
│            Core Layer               │  ← Business Logic
│   (Domain Models & Use Cases)       │
├─────────────────────────────────────┤
│       Infrastructure Layer          │  ← External Services
│  (HTTP, Cache, Security, Bootstrap) │
├─────────────────────────────────────┤
│          Shared Layer               │  ← Cross-cutting Concerns
│   (Types, Utils, Constants, Errors) │
└─────────────────────────────────────┘
```

### Dependency Rule
```
Shared ← Core ← Application ← Infrastructure
```

- **Core** never depends on Infrastructure
- **Infrastructure** implements Core interfaces (Dependency Inversion)
- **Application** orchestrates everything
- **Shared** is used by all layers

## Key Components

### 1. RDAPClient (Application Layer)
Main entry point for all RDAP queries.

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');
```

### 2. Core Ports (Interfaces)
Define contracts for external services:
- `ICachePort` - Caching interface
- `IFetcherPort` - HTTP fetching interface
- `IBootstrapPort` - Registry discovery interface
- `INormalizerPort` - Data normalization interface
- `IPIIRedactorPort` - Privacy protection interface

### 3. Infrastructure Implementations
Concrete implementations of core ports:
- `CacheManager` - In-memory LRU cache with TTL
- `Fetcher` - HTTP client with retry logic
- `BootstrapDiscovery` - IANA bootstrap registry discovery
- `Normalizer` - JSONPath-based data transformation
- `PIIRedactor` - GDPR-compliant PII removal
- `SSRFProtection` - Security validation

## Design Patterns

### 1. Dependency Inversion
Core defines interfaces, Infrastructure implements them.

### 2. Repository Pattern
Cache acts as a repository for RDAP responses.

### 3. Strategy Pattern
Different normalizers for different data types (Domain, IP, ASN).

### 4. Chain of Responsibility
Error handling with retry logic and fallbacks.

### 5. Factory Pattern
Client factory for creating configured instances.

## Data Flow

```
User Request
    ↓
RDAPClient (Application)
    ↓
QueryOrchestrator (Application)
    ↓
├─→ CacheManager (Infrastructure) → Cache Hit? → Return
│       ↓ Cache Miss
├─→ BootstrapDiscovery (Infrastructure) → Find Registry
│       ↓
├─→ SSRFProtection (Infrastructure) → Validate URL
│       ↓
├─→ Fetcher (Infrastructure) → HTTP Request
│       ↓
├─→ Normalizer (Infrastructure) → Transform Data
│       ↓
└─→ PIIRedactor (Infrastructure) → Remove PII
        ↓
    Cache & Return
```

## Security Architecture

### Defense in Depth
1. **Input Validation** - Validate all user inputs
2. **SSRF Protection** - Block internal/private IPs
3. **Certificate Validation** - Verify SSL certificates
4. **PII Redaction** - Remove personal data by default
5. **Rate Limiting** - Prevent abuse (future)

### Privacy by Design
- PII redaction enabled by default
- Configurable privacy levels
- GDPR/CCPA compliant
- No data persistence (in-memory only)

## Performance Architecture

### Caching Strategy
- **L1 Cache**: In-memory LRU (1-hour TTL)
- **L2 Cache**: Redis (available via `RedisCache` adapter)
- **L3 Cache**: CDN edge cache (future)

### Optimization Techniques
- Parallel bootstrap discovery
- Connection pooling
- Batch processing
- Response streaming (future)

## Testing Architecture

### Test Pyramid
```
        /\
       /E2E\         ← Few, slow, expensive
      /──────\
     /Integr.\      ← Some, medium speed
    /──────────\
   /   Unit     \   ← Many, fast, cheap
  /──────────────\
```

### Test Coverage
- Unit Tests: ≥80% coverage (branches, functions, lines, statements)
- Integration Tests: Critical paths
- E2E Tests: User scenarios (future)

## Extensibility

### Plugin System
```typescript
client.use(customMiddleware);
client.use(customCache);
client.use(customNormalizer);
```

### Custom Implementations
Implement core ports for custom behavior:
```typescript
class RedisCache implements ICachePort {
  // Custom implementation
}

const client = new RDAPClient({
  cache: new RedisCache()
});
```

## Documentation

For detailed documentation, see [`docs/`](docs/):
- [`docs/core-concepts/architecture.md`](docs/core-concepts/architecture.md) — in-depth architecture guide
- [`docs/guides/`](docs/guides/) — caching, error handling, performance
- [`docs/security/`](docs/security/) — SSRF protection, PII redaction, threat model

---

**Last Updated**: March 21, 2026
**Version**: 0.1.8
