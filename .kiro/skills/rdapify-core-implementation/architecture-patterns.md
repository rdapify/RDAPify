# Architecture Patterns

## Layer Communication Pattern

```typescript
// Client orchestrates, never implements business logic
class RDAPClient {
  async queryDomain(domain: string): Promise<RDAPResponse> {
    const validated = this.validator.validateDomain(domain);
    const cached = await this.cache.get(validated);
    if (cached) return cached;
    
    const url = await this.fetcher.discoverServer(validated);
    const raw = await this.fetcher.fetch(url);
    const normalized = this.normalizer.normalize(raw);
    
    await this.cache.set(validated, normalized);
    return normalized;
  }
}
```

## Error Hierarchy

```typescript
// Base error class
export class RDAPError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RDAPError';
  }
}

// Specific error types
export class ValidationError extends RDAPError {
  name = 'ValidationError';
}

export class NetworkError extends RDAPError {
  name = 'NetworkError';
}

export class BootstrapError extends RDAPError {
  name = 'BootstrapError';
}
```

## Dependency Injection Pattern

```typescript
// Constructor injection for testability
export class RDAPClient {
  constructor(
    private readonly fetcher: Fetcher,
    private readonly normalizer: Normalizer,
    private readonly cache: CacheManager,
    private readonly validator: Validator
  ) {}
}

// Factory function for easy instantiation
export function createRDAPClient(options?: RDAPOptions): RDAPClient {
  const cache = new CacheManager(new InMemoryCache());
  const ssrf = new SSRFProtection();
  const fetcher = new Fetcher(ssrf, options);
  const normalizer = new Normalizer(options);
  const validator = new Validator();
  
  return new RDAPClient(fetcher, normalizer, cache, validator);
}
```

## Interface Segregation

```typescript
// Small, focused interfaces
export interface Cache {
  get(key: string): Promise<RDAPResponse | null>;
  set(key: string, value: RDAPResponse, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Validator {
  validateDomain(domain: string): string;
  validateIP(ip: string): string;
  validateASN(asn: number): number;
}

export interface SecurityValidator {
  validateURL(url: string): void;
  isPrivateIP(ip: string): boolean;
}
```
