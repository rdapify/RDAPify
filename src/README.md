# RDAPify Source Code - Clean Architecture

This directory contains the RDAPify library source code organized using **Clean Architecture** principles.

## Quick Links

- **[Application Layer](application/README.md)** - Main client and orchestration
- **[Core Layer](core/README.md)** - Business logic and interfaces
- **[Infrastructure Layer](infrastructure/README.md)** - External implementations
- **[Shared Layer](shared/README.md)** - Cross-cutting concerns

## Directory Structure

```
src/
├── application/               # 🎭 Application Layer (Orchestration)
│   ├── client/               # Main client interface
│   │   └── RDAPClient.ts    # Primary API entry point
│   ├── services/             # Application services
│   │   └── QueryOrchestrator.ts  # Query coordination
│   ├── dto/                  # Data Transfer Objects (future)
│   └── README.md             # Layer documentation
│
├── core/                      # 🎯 Core Business Logic (Framework-agnostic)
│   ├── ports/                # Interfaces (Dependency Inversion)
│   │   ├── bootstrap.port.ts
│   │   ├── cache.port.ts
│   │   ├── fetcher.port.ts
│   │   ├── normalizer.port.ts
│   │   └── pii-redactor.port.ts
│   ├── domain/               # Domain models (future)
│   ├── use-cases/            # Business logic (future)
│   └── README.md             # Layer documentation
│
├── infrastructure/            # 🔧 External Implementations
│   ├── cache/                # Caching implementations
│   │   ├── InMemoryCache.ts # LRU cache with TTL
│   │   ├── CacheManager.ts  # Cache strategy manager
│   │   └── README.md
│   ├── http/                 # HTTP and data fetching
│   │   ├── Fetcher.ts       # HTTP client
│   │   ├── BootstrapDiscovery.ts  # IANA bootstrap
│   │   ├── Normalizer.ts    # Response normalization
│   │   └── README.md
│   ├── security/             # Security implementations
│   │   ├── SSRFProtection.ts  # SSRF prevention
│   │   ├── PIIRedactor.ts   # PII redaction
│   │   └── README.md
│   └── README.md             # Layer documentation
│
├── shared/                    # 🔗 Shared Utilities (Cross-cutting)
│   ├── types/                # TypeScript type definitions
│   │   ├── responses.ts     # RDAP response types
│   │   ├── options.ts       # Configuration options
│   │   ├── entities.ts      # RDAP entities
│   │   ├── enums.ts         # Enumerations
│   │   └── README.md
│   ├── errors/               # Error classes
│   │   └── base.error.ts    # Base error hierarchy
│   ├── constants/            # Application constants
│   │   ├── rdap.constants.ts
│   │   └── http.constants.ts
│   ├── utils/                # Utility functions
│   │   ├── validators/      # Input validation
│   │   ├── helpers/         # Helper functions
│   │   └── README.md
│   └── README.md             # Layer documentation
│
├── index.ts                   # Public API exports
└── README.md                  # This file
```

## Architecture Principles

### 1. Dependency Rule
```
Shared ← Core ← Application ← Infrastructure
```

Dependencies flow inward:
- **Shared** has no dependencies (foundation)
- **Core** depends only on Shared (business logic)
- **Application** depends on Core and Shared (orchestration)
- **Infrastructure** depends on Core and Shared (implementations)

### 2. Layer Responsibilities

#### Shared Layer (Foundation)
- TypeScript type definitions
- Error classes with context
- Utility functions (validators, helpers)
- Application constants
- No dependencies on other layers

**Key Components:**
- 10+ error classes with error codes
- 20+ utility functions
- Complete type system
- Validators for domain, IP, ASN

**Documentation:** [shared/README.md](shared/README.md)

#### Core Layer (Business Logic)
- Pure business logic
- Interface definitions (ports)
- Domain models (future)
- Use cases (future)
- Framework-agnostic

**Key Components:**
- 5 port interfaces (IBootstrapPort, ICachePort, IFetcherPort, INormalizerPort, IPIIRedactorPort)
- Dependency Inversion Principle
- No external dependencies

**Documentation:** [core/README.md](core/README.md)

#### Infrastructure Layer (Implementations)
- Concrete implementations of Core ports
- External service integrations
- HTTP clients and caching
- Security implementations
- Can depend on external libraries

**Key Components:**
- **Cache:** InMemoryCache (LRU), CacheManager
- **HTTP:** Fetcher, BootstrapDiscovery, Normalizer
- **Security:** SSRFProtection, PIIRedactor

**Documentation:** [infrastructure/README.md](infrastructure/README.md)

#### Application Layer (Orchestration)
- Main entry point (RDAPClient)
- Orchestrates use cases
- Coordinates between layers
- Handles application flow

**Key Components:**
- RDAPClient - Main API
- QueryOrchestrator - Query coordination
- Configuration management

**Documentation:** [application/README.md](application/README.md)

### 3. Benefits

✅ **Testability** - Easy to mock dependencies via ports  
✅ **Maintainability** - Clear separation of concerns  
✅ **Scalability** - Easy to add new implementations  
✅ **Flexibility** - Swap implementations without changing core  
✅ **Enterprise-Ready** - Follows industry best practices

## Import Guidelines

### From Core
```typescript
// ✅ GOOD - Core imports from Shared only
import type { RDAPResponse } from '../../shared/types';
import { ValidationError } from '../../shared/errors';

// ❌ BAD - Core should NOT import from Infrastructure
import { Fetcher } from '../../infrastructure/http';
```

### From Infrastructure
```typescript
// ✅ GOOD - Infrastructure implements Core ports
import type { IFetcherPort } from '../../core/ports';
import { NetworkError } from '../../shared/errors';
```

### From Application
```typescript
// ✅ GOOD - Application uses all layers
import { RDAPClient } from './client';
import type { ICachePort } from '../../core/ports';
import { CacheManager } from '../../infrastructure/cache';
```

## Adding New Features

### 1. Add a new cache implementation
1. Create interface in `core/ports/cache.port.ts`
2. Implement in `infrastructure/cache/redis.cache.ts`
3. Export from `infrastructure/cache/index.ts`

### 2. Add a new use case
1. Create in `core/use-cases/batch-query.ts`
2. Use existing ports
3. Call from Application layer

### 3. Add a new validator
1. Create in `shared/utils/validators/`
2. Export from `shared/utils/validators/index.ts`
3. Use anywhere in the codebase

## Migration from Old Structure

The old structure has been backed up to `src_backup/`. Key changes:

- `src/client/` → `src/application/client/`
- `src/cache/` → `src/infrastructure/cache/`
- `src/fetcher/` → `src/infrastructure/http/`
- `src/normalizer/` → `src/infrastructure/http/` & `infrastructure/security/`
- `src/types/` → `src/shared/types/`
- `src/utils/` → `src/shared/utils/`

All imports have been automatically updated.

## Public API (index.ts)

The `index.ts` file exports the public API:

### Main Export
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: true,
  privacy: true,
  retry: { maxAttempts: 3 }
});

const domain = await client.domain('example.com');
```

### Exported Types
- **Response Types:** `DomainResponse`, `IPResponse`, `ASNResponse`, `RDAPResponse`
- **Entity Types:** `RDAPEntity`, `RDAPEvent`, `RDAPLink`, `RDAPRemark`, `RDAPNameserver`
- **Option Types:** `RDAPClientOptions`, `CacheOptions`, `RetryOptions`, etc.
- **Enum Types:** `QueryType`, `ObjectClass`, `RDAPStatus`, `EventType`, `RoleType`

### Exported Errors
- `RDAPifyError` (base)
- `ValidationError`, `NetworkError`, `TimeoutError`
- `RDAPServerError`, `NoServerFoundError`
- `SSRFProtectionError`, `CacheError`, `RateLimitError`

### Exported Utilities
- **Validators:** `validateDomain`, `validateIP`, `validateASN`
- **Normalizers:** `normalizeDomain`, `normalizeIP`, `normalizeASN`
- **Network:** `isPrivateIP`, `isLocalhost`, `isLinkLocal`

### Exported Interfaces
- `ICachePort` - For custom cache implementations

## Getting Started

### Basic Usage
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

// Query domain
const domain = await client.domain('example.com');
console.log(domain.registrar?.name);

// Query IP
const ip = await client.ip('8.8.8.8');
console.log(ip.name);

// Query ASN
const asn = await client.asn(15169);
console.log(asn.name);
```

### Advanced Configuration
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: {
    strategy: 'memory',
    ttl: 3600,
    maxSize: 1000
  },
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax']
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential'
  },
  timeout: {
    connect: 5000,
    request: 10000
  },
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true
  }
});
```

### Error Handling
```typescript
import { 
  RDAPClient, 
  ValidationError, 
  NetworkError,
  TimeoutError 
} from 'rdapify';

const client = new RDAPClient();

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.context);
  } else if (error instanceof NetworkError) {
    console.error('Network issue:', error.statusCode);
  } else if (error instanceof TimeoutError) {
    console.error('Request timeout');
  }
}
```

## Development Guidelines

### Testing Strategy

**Unit Tests** (`tests/unit/`)
- Test each component in isolation
- Mock dependencies via ports
- Test error conditions
- Test edge cases

**Integration Tests** (`tests/integration/`)
- Test component interactions
- Test with real RDAP servers
- Test cache behavior
- Test security features

**Test Coverage:** >90% for all layers

### Code Quality

**Type Safety:**
- All functions have explicit types
- No `any` types
- Strict TypeScript mode

**Error Handling:**
- Use specific error types
- Include context data
- Proper error propagation

**Security:**
- SSRF protection on all external URLs
- Input validation on all user data
- PII redaction by default

## Related Documentation

- **[Application Layer](application/README.md)** - RDAPClient and QueryOrchestrator
- **[Core Layer](core/README.md)** - Ports and business logic
- **[Infrastructure Layer](infrastructure/README.md)** - Implementations
- **[Shared Layer](shared/README.md)** - Types, errors, utilities
- **[Architecture Overview](../ARCHITECTURE.md)** - High-level architecture
- **[API Reference](../docs/api_reference/)** - Complete API documentation
- **[Examples](../examples/)** - Code examples

---

**Version:** 0.1.0-alpha.4  
**Status:** Alpha - Core functionality implemented and tested  
**Test Coverage:** >90%  
**Architecture:** Clean Architecture with Dependency Inversion
