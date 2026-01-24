# Core Layer - Business Logic & Interfaces

The Core layer contains the pure business logic and defines contracts (ports) for external dependencies. It is **framework-agnostic** and has **no dependencies** on Infrastructure or Application layers.

## Architecture Role

```
Core Layer (Business Logic + Interfaces)
    ↓ defines interfaces
Infrastructure Layer (Implementations)
    ↓ uses
Application Layer (Orchestration)
```

## Directory Structure

```
core/
├── domain/              # Domain models (currently empty - future use)
│   ├── entities/       # Domain entities
│   ├── value-objects/  # Value objects
│   └── errors/         # Domain-specific errors
├── use-cases/          # Business logic use cases (currently empty - future use)
└── ports/              # Interface definitions (Dependency Inversion)
    ├── bootstrap.port.ts
    ├── cache.port.ts
    ├── fetcher.port.ts
    ├── normalizer.port.ts
    ├── pii-redactor.port.ts
    └── index.ts
```

## Current Implementation Status

### ✅ Implemented: Ports (Interfaces)

The Core layer currently defines **5 port interfaces** that establish contracts for infrastructure implementations:

1. **IBootstrapPort** - RDAP server discovery
2. **ICachePort** - Response caching
3. **IFetcherPort** - HTTP data fetching
4. **INormalizerPort** - Response normalization
5. **IPIIRedactorPort** - PII redaction

### 📦 Placeholder: Domain & Use Cases

The `domain/` and `use-cases/` directories are currently empty. RDAPify uses a simplified architecture where:

- **Domain types** are defined in `shared/types/`
- **Business logic** is implemented in `application/services/QueryOrchestrator`

These directories are reserved for future enhancements when the application grows in complexity.

## Ports (Interfaces)

### 1. IBootstrapPort

**Purpose:** Discover appropriate RDAP server for a given query

**Contract:**
```typescript
interface IBootstrapPort {
  discoverDomain(domain: string): Promise<string>;
  discoverIPv4(ip: string): Promise<string>;
  discoverIPv6(ip: string): Promise<string>;
  discoverASN(asn: number): Promise<string>;
  clearCache(): void;
}
```

**Implementation:** `infrastructure/http/BootstrapDiscovery.ts`

**Responsibilities:**
- Query IANA bootstrap registries
- Map domains/IPs/ASNs to appropriate RDAP servers
- Cache bootstrap results for performance
- Handle bootstrap errors gracefully

**Example:**
```typescript
const serverUrl = await bootstrap.discoverDomain('example.com');
// Returns: "https://rdap.verisign.com/com/v1"
```

### 2. ICachePort

**Purpose:** Cache RDAP responses to reduce network calls

**Contract:**
```typescript
interface ICachePort {
  get(key: string): Promise<RDAPResponse | null>;
  set(key: string, value: RDAPResponse, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
}
```

**Implementations:**
- `infrastructure/cache/InMemoryCache.ts` (LRU with TTL)
- `infrastructure/cache/CacheManager.ts` (Wrapper with strategy pattern)
- Future: Redis, Memcached

**Responsibilities:**
- Store normalized RDAP responses
- Implement TTL (Time To Live) expiration
- Provide cache statistics
- Support multiple cache strategies

**Example:**
```typescript
const cached = await cache.get('domain:example.com');
if (!cached) {
  const response = await fetch(...);
  await cache.set('domain:example.com', response, 3600);
}
```

### 3. IFetcherPort

**Purpose:** Fetch data from RDAP servers via HTTP

**Contract:**
```typescript
interface IFetcherPort {
  fetch(url: string): Promise<RawRDAPResponse>;
}
```

**Implementation:** `infrastructure/http/Fetcher.ts`

**Responsibilities:**
- Make HTTP requests to RDAP servers
- Handle timeouts and connection errors
- Validate SSL certificates
- Apply SSRF protection
- Set appropriate headers (User-Agent, Accept)

**Example:**
```typescript
const raw = await fetcher.fetch('https://rdap.verisign.com/com/v1/domain/example.com');
```

### 4. INormalizerPort

**Purpose:** Transform raw RDAP responses to standardized format

**Contract:**
```typescript
interface INormalizerPort {
  normalize(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): RDAPResponse;
}
```

**Implementation:** `infrastructure/http/Normalizer.ts`

**Responsibilities:**
- Extract data using JSONPath expressions
- Standardize field names across registries
- Handle missing or malformed data
- Add metadata (query, source, cached status)
- Optionally include raw response

**Example:**
```typescript
const normalized = normalizer.normalize(
  rawResponse,
  'example.com',
  'https://rdap.verisign.com/com/v1',
  false,
  false
);
```

### 5. IPIIRedactorPort

**Purpose:** Remove Personally Identifiable Information for privacy compliance

**Contract:**
```typescript
interface IPIIRedactorPort {
  redact<T extends RDAPResponse>(response: T): T;
  isEnabled(): boolean;
}
```

**Implementation:** `infrastructure/security/PIIRedactor.ts`

**Responsibilities:**
- Detect and redact email addresses
- Detect and redact phone numbers
- Detect and redact physical addresses
- Support custom redaction patterns
- GDPR/CCPA compliance

**Example:**
```typescript
const redacted = piiRedactor.redact(response);
// email: "john@example.com" → "***@***.***"
// phone: "+1-555-1234" → "***-***-****"
```

## Dependency Inversion Principle

The Core layer **defines interfaces** but **does not implement** them. This follows the Dependency Inversion Principle:

```
High-level modules (Core) should not depend on low-level modules (Infrastructure).
Both should depend on abstractions (Ports/Interfaces).
```

### Benefits

✅ **Testability** - Easy to mock dependencies in tests
✅ **Flexibility** - Swap implementations without changing core logic
✅ **Maintainability** - Clear contracts between layers
✅ **Scalability** - Add new implementations without modifying core

### Example: Swapping Cache Implementation

```typescript
// Development: In-memory cache
const cache: ICachePort = new InMemoryCache({ maxSize: 100 });

// Production: Redis cache
const cache: ICachePort = new RedisCache({ host: 'localhost' });

// Both implement ICachePort, so application code doesn't change
```

## Domain Layer (Future)

The `domain/` directory is reserved for future domain models:

### Entities (domain/entities/)

Domain entities represent core business objects with identity:

```typescript
// Future: Domain entity example
class DomainEntity {
  constructor(
    private readonly handle: string,
    private status: DomainStatus[],
    private nameservers: Nameserver[]
  ) {}
  
  isActive(): boolean {
    return this.status.includes('active');
  }
  
  addNameserver(ns: Nameserver): void {
    this.nameservers.push(ns);
  }
}
```

### Value Objects (domain/value-objects/)

Value objects represent concepts without identity:

```typescript
// Future: Value object example
class EmailAddress {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new ValidationError('Invalid email');
    }
  }
  
  private isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  toString(): string {
    return this.value;
  }
}
```

### Domain Errors (domain/errors/)

Domain-specific error types:

```typescript
// Future: Domain error example
class InvalidDomainError extends Error {
  constructor(domain: string, reason: string) {
    super(`Invalid domain "${domain}": ${reason}`);
    this.name = 'InvalidDomainError';
  }
}
```

## Use Cases Layer (Future)

The `use-cases/` directory is reserved for business logic use cases:

```typescript
// Future: Use case example
class QueryDomainUseCase {
  constructor(
    private cache: ICachePort,
    private fetcher: IFetcherPort,
    private normalizer: INormalizerPort
  ) {}
  
  async execute(domain: string): Promise<DomainResponse> {
    // Business logic here
    const cached = await this.cache.get(domain);
    if (cached) return cached;
    
    const raw = await this.fetcher.fetch(url);
    const normalized = this.normalizer.normalize(raw);
    
    await this.cache.set(domain, normalized);
    return normalized;
  }
}
```

## Current Architecture Decision

RDAPify currently uses a **simplified architecture** where:

1. **Types** are in `shared/types/` instead of domain entities
2. **Business logic** is in `application/services/QueryOrchestrator`
3. **Ports** define all infrastructure contracts

This approach is appropriate for the current scope. As the application grows, domain entities and use cases can be introduced without breaking changes.

## When to Add Domain/Use Cases

Consider adding domain entities and use cases when:

- **Complex business rules** emerge (e.g., domain validation rules)
- **Multiple use cases** share common logic
- **Domain concepts** become more sophisticated
- **Testing** requires isolated business logic

## Design Principles

### 1. Framework Independence
- No dependencies on Express, Fastify, or other frameworks
- Pure TypeScript/JavaScript
- Can be used in any environment

### 2. Database Independence
- No direct database dependencies
- Cache port abstracts storage mechanism
- Easy to add persistence layer

### 3. UI Independence
- No UI-specific code
- Can be used in CLI, web, or mobile apps
- Pure data transformation

### 4. Testability
- All dependencies injected via ports
- Easy to mock in tests
- No hidden dependencies

## Import Rules

### ✅ Core CAN import from:
```typescript
import type { RDAPResponse } from '../../shared/types';
import { ValidationError } from '../../shared/errors';
```

### ❌ Core CANNOT import from:
```typescript
// ❌ NO Infrastructure imports
import { Fetcher } from '../../infrastructure/http';

// ❌ NO Application imports
import { RDAPClient } from '../../application/client';
```

## Testing

### Port Testing Strategy

Ports are interfaces, so they don't need direct tests. Instead:

1. **Test implementations** in Infrastructure layer
2. **Test contracts** by ensuring implementations satisfy interfaces
3. **Test integration** in Application layer

### Example Test Structure

```typescript
describe('ICachePort Implementation', () => {
  let cache: ICachePort;
  
  beforeEach(() => {
    cache = new InMemoryCache();
  });
  
  it('should implement get/set contract', async () => {
    await cache.set('key', value);
    const result = await cache.get('key');
    expect(result).toEqual(value);
  });
});
```

## Related Documentation

- **Infrastructure Layer**: `src/infrastructure/README.md`
- **Application Layer**: `src/application/README.md`
- **Shared Layer**: `src/shared/README.md`
- **Architecture Overview**: `ARCHITECTURE.md`
- **Clean Architecture**: `docs/architecture/overview.md`

## Examples

### Using Ports in Application Layer

```typescript
class RDAPClient {
  constructor(
    private cache: ICachePort,
    private fetcher: IFetcherPort,
    private normalizer: INormalizerPort,
    private bootstrap: IBootstrapPort,
    private piiRedactor: IPIIRedactorPort
  ) {}
  
  async domain(domain: string): Promise<DomainResponse> {
    const serverUrl = await this.bootstrap.discoverDomain(domain);
    const raw = await this.fetcher.fetch(`${serverUrl}/domain/${domain}`);
    const normalized = this.normalizer.normalize(raw, domain, serverUrl, false, false);
    const redacted = this.piiRedactor.redact(normalized);
    return redacted;
  }
}
```

### Implementing a Port

```typescript
// Infrastructure layer
export class RedisCache implements ICachePort {
  constructor(private client: RedisClient) {}
  
  async get(key: string): Promise<RDAPResponse | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
  
  async set(key: string, value: RDAPResponse, ttl?: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttl || 3600);
  }
  
  // ... implement other methods
}
```

---

**Layer**: Core (Business Logic + Interfaces)  
**Dependencies**: Shared only  
**Dependents**: Application, Infrastructure  
**Status**: Ports implemented, Domain/Use Cases reserved for future
