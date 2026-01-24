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
const result = await client.queryDomain('example.com');
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
- **L2 Cache**: Redis (future)
- **L3 Cache**: CDN edge cache (future)

### Optimization Techniques
- Parallel bootstrap discovery
- Connection pooling
- Response streaming (future)
- Batch processing (future)

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
- Unit Tests: >90% coverage
- Integration Tests: Critical paths
- E2E Tests: User scenarios (future)

## Extensibility

### Plugin System (Future)
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

For detailed architecture documentation, see:
- `docs/architecture/overview.md` - Complete architecture guide
- `docs/architecture/layer-design.md` - Layer responsibilities
- `docs/architecture/decision-records.md` - ADRs
- `src/README.md` - Source code structure

## Diagrams

Visual architecture diagrams available in:
- `diagrams/architecture_overview.mmd`
- `diagrams/data_flow.mmd`
- `diagrams/cache_strategy.mmd`

---

**Last Updated**: January 24, 2026  
**Version**: 0.1.0-alpha.4
