# Use Cases

This directory is reserved for application business logic following Clean Architecture principles.

## Current Status

**Status:** Empty (placeholder for future use)

RDAPify currently implements business logic in `application/services/QueryOrchestrator.ts`. This simplified approach is appropriate for the current scope.

## Purpose

Use cases represent **application-specific business rules** - the operations users can perform with the system.

Each use case:
- Orchestrates domain entities and services
- Implements a single user action or workflow
- Is independent of delivery mechanism (CLI, API, UI)
- Uses ports to interact with external systems

## Directory Structure

```
use-cases/
├── QueryDomainUseCase.ts
├── QueryIPUseCase.ts
├── QueryASNUseCase.ts
├── BatchQueryUseCase.ts
└── index.ts
```

## When to Add Use Cases

Consider adding use cases when:

1. **Multiple Entry Points** - Same logic needed in CLI, API, and UI
2. **Complex Workflows** - Multi-step operations with business rules
3. **Reusable Logic** - Same operation used in different contexts
4. **Testing Isolation** - Need to test business logic separately

## Future Examples

### Single Query Use Case

```typescript
// Future: QueryDomainUseCase example
export class QueryDomainUseCase {
  constructor(
    private cache: ICachePort,
    private bootstrap: IBootstrapPort,
    private fetcher: IFetcherPort,
    private normalizer: INormalizerPort,
    private piiRedactor: IPIIRedactorPort
  ) {}
  
  async execute(request: QueryDomainRequest): Promise<DomainResponse> {
    // 1. Validate input
    this.validateDomain(request.domain);
    
    // 2. Check cache
    const cacheKey = this.generateCacheKey(request.domain);
    const cached = await this.cache.get(cacheKey);
    if (cached && !request.bypassCache) {
      return this.piiRedactor.redact(cached) as DomainResponse;
    }
    
    // 3. Discover RDAP server
    const serverUrl = await this.bootstrap.discoverDomain(request.domain);
    
    // 4. Fetch data
    const queryUrl = `${serverUrl}/domain/${request.domain}`;
    const raw = await this.fetcher.fetch(queryUrl);
    
    // 5. Normalize response
    const normalized = this.normalizer.normalize(
      raw,
      request.domain,
      serverUrl,
      false,
      request.includeRaw
    );
    
    // 6. Cache result
    await this.cache.set(cacheKey, normalized, request.cacheTTL);
    
    // 7. Redact PII
    return this.piiRedactor.redact(normalized) as DomainResponse;
  }
  
  private validateDomain(domain: string): void {
    if (!domain || typeof domain !== 'string') {
      throw new ValidationError('Domain is required');
    }
    // Additional validation...
  }
  
  private generateCacheKey(domain: string): string {
    return `domain:${domain.toLowerCase()}`;
  }
}

interface QueryDomainRequest {
  domain: string;
  bypassCache?: boolean;
  cacheTTL?: number;
  includeRaw?: boolean;
}
```

### Batch Query Use Case

```typescript
// Future: BatchQueryUseCase example
export class BatchQueryUseCase {
  constructor(
    private queryDomain: QueryDomainUseCase,
    private queryIP: QueryIPUseCase,
    private queryASN: QueryASNUseCase
  ) {}
  
  async execute(request: BatchQueryRequest): Promise<BatchQueryResponse> {
    const results: QueryResult[] = [];
    const errors: QueryError[] = [];
    
    // Execute queries in parallel
    const promises = request.queries.map(async (query) => {
      try {
        const result = await this.executeQuery(query);
        results.push({ query, result, success: true });
      } catch (error) {
        errors.push({ query, error: error.message, success: false });
      }
    });
    
    await Promise.all(promises);
    
    return {
      total: request.queries.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }
  
  private async executeQuery(query: Query): Promise<RDAPResponse> {
    switch (query.type) {
      case 'domain':
        return this.queryDomain.execute({ domain: query.value });
      case 'ip':
        return this.queryIP.execute({ ip: query.value });
      case 'asn':
        return this.queryASN.execute({ asn: query.value });
      default:
        throw new ValidationError(`Unknown query type: ${query.type}`);
    }
  }
}

interface BatchQueryRequest {
  queries: Query[];
  parallel?: boolean;
  stopOnError?: boolean;
}

interface Query {
  type: 'domain' | 'ip' | 'asn';
  value: string | number;
}
```

### Monitoring Use Case

```typescript
// Future: MonitorDomainUseCase example
export class MonitorDomainUseCase {
  constructor(
    private queryDomain: QueryDomainUseCase,
    private notifier: INotificationPort,
    private storage: IStoragePort
  ) {}
  
  async execute(request: MonitorRequest): Promise<MonitorResult> {
    // Get current state
    const current = await this.queryDomain.execute({
      domain: request.domain
    });
    
    // Get previous state
    const previous = await this.storage.get(request.domain);
    
    // Detect changes
    const changes = this.detectChanges(previous, current);
    
    // Store current state
    await this.storage.set(request.domain, current);
    
    // Notify if changes detected
    if (changes.length > 0 && request.notifyOnChange) {
      await this.notifier.send({
        domain: request.domain,
        changes,
        timestamp: new Date()
      });
    }
    
    return {
      domain: request.domain,
      hasChanges: changes.length > 0,
      changes,
      current,
      previous
    };
  }
  
  private detectChanges(
    previous: DomainResponse | null,
    current: DomainResponse
  ): Change[] {
    if (!previous) return [];
    
    const changes: Change[] = [];
    
    // Check status changes
    if (JSON.stringify(previous.status) !== JSON.stringify(current.status)) {
      changes.push({
        field: 'status',
        old: previous.status,
        new: current.status
      });
    }
    
    // Check nameserver changes
    if (JSON.stringify(previous.nameservers) !== JSON.stringify(current.nameservers)) {
      changes.push({
        field: 'nameservers',
        old: previous.nameservers,
        new: current.nameservers
      });
    }
    
    return changes;
  }
}
```

## Use Case Pattern

### Structure
```typescript
export class SomeUseCase {
  // 1. Inject dependencies via constructor
  constructor(
    private dependency1: IPort1,
    private dependency2: IPort2
  ) {}
  
  // 2. Single public execute method
  async execute(request: Request): Promise<Response> {
    // 3. Validate input
    this.validate(request);
    
    // 4. Execute business logic
    const result = await this.performOperation(request);
    
    // 5. Return result
    return result;
  }
  
  // 6. Private helper methods
  private validate(request: Request): void {
    // Validation logic
  }
  
  private async performOperation(request: Request): Promise<Response> {
    // Business logic
  }
}
```

### Benefits

✅ **Single Responsibility** - Each use case does one thing
✅ **Testability** - Easy to test in isolation
✅ **Reusability** - Same logic in CLI, API, UI
✅ **Maintainability** - Clear business operations
✅ **Independence** - No framework dependencies

## Current Architecture

Currently, business logic is in:
- `application/services/QueryOrchestrator.ts` - Query coordination
- `shared/utils/validators/` - Input validation
- `infrastructure/` - External operations

This works well for current needs.

## Migration Path

When use cases are needed:

1. **Extract logic** from QueryOrchestrator
2. **Create use case classes** for each operation
3. **Inject dependencies** via ports
4. **Update application layer** to use use cases

Example migration:
```typescript
// Before: Logic in orchestrator
class QueryOrchestrator {
  async queryDomain(domain: string) {
    // All logic here
  }
}

// After: Dedicated use case
class QueryDomainUseCase {
  async execute(request: QueryDomainRequest) {
    // Business logic
  }
}

// Application layer uses use case
class RDAPClient {
  constructor(private queryDomain: QueryDomainUseCase) {}
  
  async domain(domain: string) {
    return this.queryDomain.execute({ domain });
  }
}
```

## Testing Use Cases

```typescript
describe('QueryDomainUseCase', () => {
  let useCase: QueryDomainUseCase;
  let mockCache: ICachePort;
  let mockFetcher: IFetcherPort;
  
  beforeEach(() => {
    mockCache = new MockCache();
    mockFetcher = new MockFetcher();
    useCase = new QueryDomainUseCase(mockCache, mockFetcher);
  });
  
  it('should return cached result when available', async () => {
    mockCache.set('domain:example.com', cachedResponse);
    
    const result = await useCase.execute({ domain: 'example.com' });
    
    expect(result).toEqual(cachedResponse);
    expect(mockFetcher.fetch).not.toHaveBeenCalled();
  });
  
  it('should fetch and cache when not cached', async () => {
    mockFetcher.setResponse(rawResponse);
    
    const result = await useCase.execute({ domain: 'example.com' });
    
    expect(mockFetcher.fetch).toHaveBeenCalled();
    expect(mockCache.get('domain:example.com')).toEqual(result);
  });
});
```

## Related

- **Current Implementation**: `src/application/services/QueryOrchestrator.ts`
- **Ports**: `src/core/ports/README.md`
- **Core Layer**: `src/core/README.md`
- **Clean Architecture**: `docs/architecture/overview.md`

---

**Status**: Placeholder for future use cases  
**Current Approach**: Logic in `application/services/`  
**Migration**: When multiple entry points or complex workflows emerge
