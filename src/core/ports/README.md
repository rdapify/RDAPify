# Ports - Interface Definitions

Ports define contracts between Core and Infrastructure layers using the **Dependency Inversion Principle**.

## What are Ports?

Ports are **interfaces** that define what the Core layer needs from external systems without specifying how those systems work. This allows:

- Core layer to remain independent of implementation details
- Easy swapping of implementations (e.g., in-memory cache → Redis)
- Simple mocking for unit tests
- Clear contracts between layers

## Available Ports

### IBootstrapPort
**File:** `bootstrap.port.ts`  
**Purpose:** RDAP server discovery via IANA bootstrap

**Methods:**
- `discoverDomain(domain: string): Promise<string>` - Find RDAP server for domain
- `discoverIPv4(ip: string): Promise<string>` - Find RDAP server for IPv4
- `discoverIPv6(ip: string): Promise<string>` - Find RDAP server for IPv6
- `discoverASN(asn: number): Promise<string>` - Find RDAP server for ASN
- `clearCache(): void` - Clear bootstrap cache

**Implementation:** `infrastructure/http/BootstrapDiscovery.ts`

### ICachePort
**File:** `cache.port.ts`  
**Purpose:** Response caching with TTL support

**Methods:**
- `get(key: string): Promise<RDAPResponse | null>` - Retrieve cached response
- `set(key: string, value: RDAPResponse, ttl?: number): Promise<void>` - Store response
- `delete(key: string): Promise<void>` - Remove cached item
- `clear(): Promise<void>` - Clear all cache
- `has(key: string): Promise<boolean>` - Check if key exists
- `size(): Promise<number>` - Get cache size

**Implementations:**
- `infrastructure/cache/InMemoryCache.ts` (LRU with TTL)
- `infrastructure/cache/CacheManager.ts` (Strategy wrapper)

### IFetcherPort
**File:** `fetcher.port.ts`  
**Purpose:** HTTP data fetching from RDAP servers

**Methods:**
- `fetch(url: string): Promise<RawRDAPResponse>` - Fetch RDAP data

**Implementation:** `infrastructure/http/Fetcher.ts`

### INormalizerPort
**File:** `normalizer.port.ts`  
**Purpose:** Transform raw RDAP responses to standard format

**Methods:**
- `normalize(raw, query, source, cached, includeRaw): RDAPResponse` - Normalize response

**Implementation:** `infrastructure/http/Normalizer.ts`

### IPIIRedactorPort
**File:** `pii-redactor.port.ts`  
**Purpose:** Remove Personally Identifiable Information

**Methods:**
- `redact<T extends RDAPResponse>(response: T): T` - Redact PII from response
- `isEnabled(): boolean` - Check if redaction is enabled

**Implementation:** `infrastructure/security/PIIRedactor.ts`

## Usage Pattern

### 1. Define Port (Core Layer)
```typescript
// core/ports/cache.port.ts
export interface ICachePort {
  get(key: string): Promise<RDAPResponse | null>;
  set(key: string, value: RDAPResponse): Promise<void>;
}
```

### 2. Implement Port (Infrastructure Layer)
```typescript
// infrastructure/cache/InMemoryCache.ts
export class InMemoryCache implements ICachePort {
  private cache = new Map();
  
  async get(key: string): Promise<RDAPResponse | null> {
    return this.cache.get(key) || null;
  }
  
  async set(key: string, value: RDAPResponse): Promise<void> {
    this.cache.set(key, value);
  }
}
```

### 3. Use Port (Application Layer)
```typescript
// application/client/RDAPClient.ts
export class RDAPClient {
  constructor(private cache: ICachePort) {}
  
  async domain(domain: string): Promise<DomainResponse> {
    const cached = await this.cache.get(domain);
    if (cached) return cached;
    // ... fetch and cache
  }
}
```

## Benefits

### Testability
```typescript
// Easy to mock in tests
class MockCache implements ICachePort {
  async get() { return mockData; }
  async set() { }
}

const client = new RDAPClient(new MockCache());
```

### Flexibility
```typescript
// Swap implementations without changing application code
const devCache: ICachePort = new InMemoryCache();
const prodCache: ICachePort = new RedisCache();
```

### Maintainability
- Clear contracts between layers
- Changes to implementation don't affect core logic
- Easy to understand dependencies

## Design Principles

### Single Responsibility
Each port has one clear purpose (caching, fetching, normalizing, etc.)

### Interface Segregation
Ports are small and focused - clients only depend on methods they use

### Dependency Inversion
High-level modules (Core) depend on abstractions (Ports), not implementations

## Adding New Ports

When adding a new port:

1. **Create interface** in `core/ports/`
2. **Export** from `core/ports/index.ts`
3. **Implement** in `infrastructure/`
4. **Use** in `application/`

Example:
```typescript
// 1. Create port
export interface IValidatorPort {
  validate(input: string): boolean;
}

// 2. Export
export * from './validator.port';

// 3. Implement
export class DomainValidator implements IValidatorPort {
  validate(domain: string): boolean {
    return /^[a-z0-9.-]+$/.test(domain);
  }
}

// 4. Use
constructor(private validator: IValidatorPort) {}
```

## Related

- **Core Layer**: `src/core/README.md`
- **Infrastructure Implementations**: `src/infrastructure/README.md`
- **Application Usage**: `src/application/README.md`

---

**Purpose**: Define contracts between layers  
**Pattern**: Dependency Inversion Principle  
**Status**: 5 ports implemented and in use
