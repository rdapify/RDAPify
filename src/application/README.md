# Application Layer

The Application layer orchestrates business logic and coordinates between Core and Infrastructure layers. It provides the main entry point for external consumers.

## Architecture Role

```
External Consumer
       ↓
Application Layer (RDAPClient)
       ↓
Core Layer (Use Cases & Domain)
       ↓
Infrastructure Layer (HTTP, Cache, Security)
```

## Directory Structure

```
application/
├── client/              # Main client interface
│   ├── RDAPClient.ts   # Primary API entry point
│   └── index.ts        # Client exports
├── services/            # Application services
│   ├── QueryOrchestrator.ts  # Query coordination logic
│   └── index.ts        # Service exports
└── dto/                 # Data Transfer Objects (future)
    └── README.md       # DTO documentation
```

## Components

### Client (`client/`)

**RDAPClient** - Main entry point for all RDAP queries

**Responsibilities:**
- Initialize and configure all dependencies
- Provide simple public API (domain, ip, asn methods)
- Handle retry logic with exponential backoff
- Manage client lifecycle (cache clearing, stats)
- Merge user options with defaults

**Key Features:**
- Dependency injection for all infrastructure components
- Configuration normalization and validation
- Retry mechanism with configurable backoff strategies
- Cache and statistics management
- Thread-safe initialization

**Example Usage:**
```typescript
const client = new RDAPClient({
  cache: true,
  redactPII: true,
  retry: { maxAttempts: 3 }
});

const domain = await client.domain('example.com');
const ip = await client.ip('8.8.8.8');
const asn = await client.asn(15169);
```

### Services (`services/`)

**QueryOrchestrator** - Coordinates query execution flow

**Responsibilities:**
- Execute common query pattern across all query types
- Coordinate between cache, bootstrap, fetcher, normalizer, and PII redactor
- Implement query flow: validate → cache → discover → fetch → normalize → cache → redact
- Handle domain, IP, and ASN queries with consistent logic

**Query Flow:**
1. **Validate** - Validate and normalize input
2. **Cache Check** - Check if response is cached
3. **Discover** - Find appropriate RDAP server via bootstrap
4. **Fetch** - Retrieve data from RDAP server (with retry)
5. **Normalize** - Transform raw response to standard format
6. **Cache** - Store normalized response
7. **Redact** - Remove PII if enabled

**Design Pattern:**
- Strategy pattern for different query types
- Template method for common query flow
- Dependency injection for all infrastructure components

### DTOs (`dto/`)

**Status:** Not currently used (placeholder for future)

DTOs will be added when needed for:
- API versioning (v1, v2 with different contracts)
- Complex input transformations
- External system integrations
- GraphQL or REST API layers

See `dto/README.md` for details.

## Dependencies

### Infrastructure Layer
- `CacheManager` - Response caching
- `BootstrapDiscovery` - RDAP server discovery
- `Fetcher` - HTTP client
- `Normalizer` - Response normalization
- `SSRFProtection` - Security validation
- `PIIRedactor` - Privacy protection

### Shared Layer
- Types: `DomainResponse`, `IPResponse`, `ASNResponse`, `RDAPClientOptions`
- Validators: `validateDomain`, `validateIP`, `validateASN`
- Utilities: `generateCacheKey`, `calculateBackoff`, `deepMerge`
- Errors: `ValidationError`

## Design Principles

### 1. Single Responsibility
- **RDAPClient**: Configuration and lifecycle management
- **QueryOrchestrator**: Query execution coordination

### 2. Dependency Inversion
- Depends on interfaces from Core layer
- Infrastructure implementations injected at runtime

### 3. Open/Closed Principle
- Easy to extend with new query types
- Closed for modification of existing flow

### 4. DRY (Don't Repeat Yourself)
- Common query logic centralized in QueryOrchestrator
- Retry logic reusable across all queries

## Configuration

### Client Options

```typescript
interface RDAPClientOptions {
  // Caching
  cache?: boolean | CacheOptions;
  
  // Privacy
  privacy?: boolean | PrivacyOptions;
  redactPII?: boolean;  // Deprecated, use privacy
  
  // Network
  timeout?: number | TimeoutOptions;
  userAgent?: string;
  headers?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
  
  // Security
  ssrfProtection?: boolean | SSRFOptions;
  
  // Retry
  retry?: boolean | RetryOptions;
  
  // Bootstrap
  bootstrapUrl?: string;
  
  // Response
  includeRaw?: boolean;
}
```

### Default Configuration

```typescript
const DEFAULT_OPTIONS = {
  cache: { strategy: 'memory', ttl: 3600, maxSize: 1000 },
  privacy: { redactPII: true },
  timeout: 5000,
  followRedirects: true,
  maxRedirects: 5,
  ssrfProtection: { enabled: true },
  retry: { maxAttempts: 3, backoff: 'exponential' },
  includeRaw: false
};
```

## Error Handling

### Error Flow
```
User Input
    ↓
Validation (throws ValidationError)
    ↓
Cache Check
    ↓
Bootstrap Discovery (throws BootstrapError)
    ↓
Fetch with Retry (throws NetworkError, TimeoutError)
    ↓
Normalize (throws NormalizationError)
    ↓
Return Response
```

### Error Types
- `ValidationError` - Invalid input (no retry)
- `BootstrapError` - Server discovery failed
- `NetworkError` - Network issues (retryable)
- `TimeoutError` - Request timeout (retryable)
- `NormalizationError` - Invalid response format

## Performance Considerations

### Caching Strategy
- Default: In-memory LRU cache with 1-hour TTL
- Cache key: `{type}:{normalized_value}`
- Bootstrap cache: Separate cache for server URLs

### Retry Strategy
- Default: 3 attempts with exponential backoff
- Initial delay: 1 second
- Max delay: 10 seconds
- Backoff formula: `delay * (2 ^ attempt)`

### Optimization Tips
1. Enable caching for repeated queries
2. Adjust retry settings based on network reliability
3. Use batch operations for multiple queries (future feature)
4. Configure appropriate timeouts for your use case

## Testing

### Unit Tests
- Test client initialization with various options
- Test option normalization and merging
- Test retry logic with different backoff strategies
- Test cache clearing and statistics

### Integration Tests
- Test complete query flow (domain, IP, ASN)
- Test with real RDAP servers
- Test error handling and recovery
- Test cache behavior

### Test Location
- Unit tests: `tests/unit/application/`
- Integration tests: `tests/integration/rdap-client.test.ts`

## Future Enhancements

### Planned Features
1. **Batch Queries** - Query multiple resources in parallel
2. **Streaming API** - Stream large result sets
3. **GraphQL Support** - GraphQL query interface
4. **Webhooks** - Event notifications for changes
5. **Rate Limiting** - Built-in rate limit handling
6. **Circuit Breaker** - Automatic failure detection

### API Evolution
- DTOs will be added for API versioning
- Backward compatibility maintained via adapters
- Deprecation warnings for old APIs

## Related Documentation

- **Core Layer**: `src/core/README.md`
- **Infrastructure Layer**: `src/infrastructure/README.md`
- **Shared Layer**: `src/shared/README.md`
- **API Reference**: `docs/api_reference/client.md`
- **Architecture**: `ARCHITECTURE.md`

## Examples

### Basic Usage
```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const result = await client.domain('example.com');
```

### Advanced Configuration
```typescript
const client = new RDAPClient({
  cache: {
    strategy: 'memory',
    ttl: 7200,
    maxSize: 5000
  },
  retry: {
    maxAttempts: 5,
    backoff: 'exponential',
    initialDelay: 500,
    maxDelay: 30000
  },
  timeout: {
    request: 10000,
    connect: 5000,
    dns: 3000
  },
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone']
  }
});
```

### Error Handling
```typescript
try {
  const result = await client.domain('example.com');
  console.log(result.registrar?.name);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid domain:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network issue:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Statistics and Monitoring
```typescript
// Get cache statistics
const stats = await client.getStats();
console.log('Cache size:', stats.cache.size);
console.log('Bootstrap servers:', stats.bootstrap.types);

// Clear cache
await client.clearCache();

// Get configuration
const config = client.getConfig();
console.log('Current timeout:', config.timeout);
```

---

**Layer**: Application (Orchestration)  
**Dependencies**: Core (interfaces), Infrastructure (implementations), Shared (utilities)  
**Consumers**: External applications, CLI tools, API servers
