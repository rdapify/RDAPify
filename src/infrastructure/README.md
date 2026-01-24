# Infrastructure Layer - External Implementations

The Infrastructure layer contains concrete implementations of interfaces (ports) defined in the Core layer. It handles all external concerns like HTTP, caching, and security.

## Architecture Role

```
Core Layer (defines interfaces/ports)
    ↓ implements
Infrastructure Layer (concrete implementations)
    ↓ used by
Application Layer (orchestration)
```

## Directory Structure

```
infrastructure/
├── cache/              # Caching implementations
│   ├── InMemoryCache.ts       # LRU cache with TTL
│   ├── CacheManager.ts        # Cache strategy manager
│   └── index.ts
├── http/               # HTTP and data fetching
│   ├── Fetcher.ts             # HTTP client with SSRF protection
│   ├── BootstrapDiscovery.ts  # IANA bootstrap service
│   ├── Normalizer.ts          # Response normalization
│   └── index.ts
└── security/           # Security implementations
    ├── SSRFProtection.ts      # SSRF attack prevention
    ├── PIIRedactor.ts         # PII redaction for privacy
    └── index.ts
```

## Components Overview

### Cache (`cache/`)

**Purpose:** Store and retrieve RDAP responses to reduce network calls

**Components:**
- **InMemoryCache** - LRU cache with TTL expiration
- **CacheManager** - Strategy pattern wrapper for different cache types

**Features:**
- LRU (Least Recently Used) eviction policy
- TTL (Time To Live) expiration
- Configurable max size
- Thread-safe operations
- Graceful error handling

**Implements:** `ICachePort` from Core layer

### HTTP (`http/`)

**Purpose:** Fetch data from RDAP servers and discover appropriate servers

**Components:**
- **Fetcher** - HTTP client with timeout and SSRF protection
- **BootstrapDiscovery** - IANA bootstrap service for server discovery
- **Normalizer** - Transform raw RDAP responses to standard format

**Features:**
- HTTPS-only requests
- Configurable timeouts (connect, request, DNS)
- Redirect handling with SSRF checks
- Bootstrap caching (24-hour TTL)
- JSONPath-based normalization

**Implements:** `IFetcherPort`, `IBootstrapPort`, `INormalizerPort` from Core layer

### Security (`security/`)

**Purpose:** Protect against security threats and ensure privacy compliance

**Components:**
- **SSRFProtection** - Prevent Server-Side Request Forgery attacks
- **PIIRedactor** - Remove Personally Identifiable Information

**Features:**
- RFC 1918 private IP blocking
- Localhost and link-local blocking
- Domain whitelist/blacklist
- Email, phone, address redaction
- GDPR/CCPA compliance

**Implements:** `IPIIRedactorPort` from Core layer

## Detailed Component Documentation

### InMemoryCache

**File:** `cache/InMemoryCache.ts`

**Purpose:** In-memory LRU cache with TTL support

**Key Features:**
```typescript
class InMemoryCache implements ICache {
  // LRU eviction when cache is full
  // TTL-based expiration
  // O(1) get/set operations
  // Automatic cleanup of expired entries
}
```

**Configuration:**
```typescript
const cache = new InMemoryCache(1000); // Max 1000 entries
await cache.set('key', value, 3600); // TTL: 1 hour
```

**LRU Algorithm:**
1. Track access order in array
2. Most recently used items at end
3. Evict least recently used (first item) when full
4. Update order on every access

**Memory Management:**
- Automatic eviction when maxSize reached
- Expired entries removed on access
- Manual clear() for full cleanup

### CacheManager

**File:** `cache/CacheManager.ts`

**Purpose:** Manage different cache strategies with unified interface

**Strategies:**
- `memory` - In-memory LRU cache (default)
- `redis` - Redis cache (planned for v0.2.0)
- `custom` - User-provided implementation
- `none` - No caching (pass-through)

**Configuration:**
```typescript
const manager = new CacheManager({
  strategy: 'memory',
  ttl: 3600,
  maxSize: 1000
});
```

**Error Handling:**
- Cache failures don't break application
- Errors logged but not thrown
- Graceful degradation to no-cache

### Fetcher

**File:** `http/Fetcher.ts`

**Purpose:** HTTP client for RDAP queries with security features

**Key Features:**
```typescript
class Fetcher implements IFetcherPort {
  // HTTPS-only requests
  // Configurable timeouts
  // SSRF protection integration
  // Manual redirect handling
  // Proper error types
}
```

**Configuration:**
```typescript
const fetcher = new Fetcher({
  timeout: {
    connect: 5000,
    request: 10000,
    dns: 3000
  },
  userAgent: 'RDAPify/0.1.0',
  followRedirects: true,
  maxRedirects: 5,
  ssrfProtection: new SSRFProtection()
});
```

**Request Flow:**
1. SSRF validation of URL
2. Prepare headers (User-Agent, Accept)
3. Make request with timeout
4. Handle redirects (with SSRF checks)
5. Parse JSON response
6. Return normalized data

**Error Types:**
- `TimeoutError` - Request timeout
- `NetworkError` - Network issues
- `RDAPServerError` - Server errors (4xx, 5xx)
- `SSRFProtectionError` - Security violation

### BootstrapDiscovery

**File:** `http/BootstrapDiscovery.ts`

**Purpose:** Discover appropriate RDAP server using IANA bootstrap

**Key Features:**
```typescript
class BootstrapDiscovery implements IBootstrapPort {
  // Query IANA bootstrap registries
  // Cache bootstrap data (24 hours)
  // Support domain, IPv4, IPv6, ASN
  // CIDR range matching for IPs
}
```

**Bootstrap Sources:**
- DNS: `https://data.iana.org/rdap/dns.json`
- IPv4: `https://data.iana.org/rdap/ipv4.json`
- IPv6: `https://data.iana.org/rdap/ipv6.json`
- ASN: `https://data.iana.org/rdap/asn.json`

**Discovery Process:**
1. Extract TLD/IP range/ASN from query
2. Check cache for bootstrap data
3. Fetch from IANA if not cached
4. Match query against patterns
5. Return first matching server URL

**Caching:**
- Bootstrap data cached for 24 hours
- Reduces load on IANA servers
- Improves performance
- Manual cache clearing available

### Normalizer

**File:** `http/Normalizer.ts`

**Purpose:** Transform raw RDAP responses to standardized format

**Key Features:**
```typescript
class Normalizer implements INormalizerPort {
  // JSONPath-based extraction
  // Consistent field naming
  // Handle missing data gracefully
  // Add metadata (query, source, cached)
  // Optional raw response inclusion
}
```

**Normalization Process:**
1. Detect object type (domain, IP, ASN)
2. Extract fields using JSONPath
3. Transform to standard format
4. Add metadata
5. Handle arrays and nested objects

**Field Mappings:**
- `handle` - Object identifier
- `status` - Status codes array
- `entities` - Related entities (registrar, contacts)
- `events` - Lifecycle events
- `nameservers` - DNS servers (domains only)
- `network` - IP range info (IPs only)

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

### SSRFProtection

**File:** `security/SSRFProtection.ts`

**Purpose:** Prevent Server-Side Request Forgery attacks

**Key Features:**
```typescript
class SSRFProtection {
  // HTTPS-only enforcement
  // Private IP blocking (RFC 1918)
  // Localhost blocking
  // Link-local blocking
  // Domain whitelist/blacklist
  // DNS resolution validation
}
```

**Configuration:**
```typescript
const protection = new SSRFProtection({
  enabled: true,
  blockPrivateIPs: true,
  blockLocalhost: true,
  blockLinkLocal: true,
  allowedDomains: ['rdap.verisign.com'],
  blockedDomains: ['internal.company.com']
});
```

**Validation Checks:**
1. URL format validation
2. HTTPS protocol enforcement
3. Domain whitelist check (if configured)
4. Domain blacklist check
5. IP address validation
6. Private IP range check
7. Localhost check
8. Link-local check

**Blocked Ranges:**
- `10.0.0.0/8` - Private network
- `172.16.0.0/12` - Private network
- `192.168.0.0/16` - Private network
- `127.0.0.0/8` - Localhost
- `169.254.0.0/16` - Link-local
- `::1` - IPv6 localhost
- `fe80::/10` - IPv6 link-local

### PIIRedactor

**File:** `security/PIIRedactor.ts`

**Purpose:** Remove Personally Identifiable Information for privacy compliance

**Key Features:**
```typescript
class PIIRedactor implements IPIIRedactorPort {
  // Email redaction
  // Phone number redaction
  // Address redaction
  // Configurable fields
  // vCard data handling
  // GDPR/CCPA compliance
}
```

**Configuration:**
```typescript
const redactor = new PIIRedactor({
  redactPII: true,
  redactFields: ['email', 'phone', 'fax', 'adr'],
  redactionText: '[REDACTED]'
});
```

**Redaction Process:**
1. Deep copy response (avoid mutation)
2. Find all entities in response
3. Process vCard data in each entity
4. Redact configured fields
5. Recursively handle nested entities

**Default Redacted Fields:**
- `email` - Email addresses
- `phone` - Phone numbers
- `fax` - Fax numbers

**Example:**
```typescript
// Before redaction
{
  "email": "john@example.com",
  "phone": "+1-555-1234"
}

// After redaction
{
  "email": "[REDACTED]",
  "phone": "[REDACTED]"
}
```

## Design Patterns

### Strategy Pattern
**Used in:** CacheManager
- Different cache strategies (memory, redis, custom, none)
- Easy to add new strategies
- Runtime strategy selection

### Dependency Injection
**Used in:** All components
- Dependencies injected via constructor
- Easy to mock for testing
- Loose coupling between components

### Factory Pattern
**Used in:** CacheManager
- Creates appropriate cache implementation
- Based on configuration
- Hides implementation details

## Error Handling

### Error Types

**Network Errors:**
- `NetworkError` - General network issues
- `TimeoutError` - Request timeout
- `RDAPServerError` - Server errors (4xx, 5xx)

**Security Errors:**
- `SSRFProtectionError` - SSRF validation failed

**Cache Errors:**
- `CacheError` - Cache operation failed

**Discovery Errors:**
- `NoServerFoundError` - No RDAP server found

### Error Handling Strategy

1. **Throw specific errors** - Use appropriate error types
2. **Include context** - Add relevant data to errors
3. **Graceful degradation** - Cache failures don't break app
4. **Logging** - Log errors for debugging
5. **User-friendly messages** - Clear error descriptions

## Performance Considerations

### Caching
- Bootstrap data cached for 24 hours
- RDAP responses cached for 1 hour (configurable)
- LRU eviction prevents memory bloat
- O(1) cache operations

### HTTP
- Connection pooling (via fetch API)
- Configurable timeouts prevent hanging
- Parallel requests supported
- Redirect limit prevents loops

### Memory
- LRU cache limits memory usage
- Expired entries automatically removed
- Deep copy only when needed (PII redaction)
- No memory leaks in event listeners

## Security Best Practices

### SSRF Protection
✅ HTTPS-only requests
✅ Private IP blocking
✅ Localhost blocking
✅ Domain validation
✅ Redirect validation

### Privacy
✅ PII redaction by default
✅ Configurable redaction fields
✅ GDPR/CCPA compliance
✅ No data persistence (unless cached)

### Input Validation
✅ URL validation
✅ IP address validation
✅ Domain validation
✅ Type checking

## Testing

### Unit Tests
- Test each component in isolation
- Mock dependencies via ports
- Test error conditions
- Test edge cases

### Integration Tests
- Test component interactions
- Test with real RDAP servers
- Test cache behavior
- Test security features

### Test Location
- Unit tests: `tests/unit/infrastructure/`
- Integration tests: `tests/integration/`

## Future Enhancements

### Planned Features
1. **Redis Cache** - Production-ready distributed cache
2. **Memcached Support** - Alternative cache backend
3. **HTTP/2 Support** - Improved performance
4. **Circuit Breaker** - Automatic failure detection
5. **Rate Limiting** - Built-in rate limit handling
6. **Metrics** - Performance monitoring

## Related Documentation

- **Core Layer**: `src/core/README.md`
- **Application Layer**: `src/application/README.md`
- **Shared Layer**: `src/shared/README.md`
- **Security Whitepaper**: `security/whitepaper.md`
- **Architecture**: `ARCHITECTURE.md`

---

**Layer**: Infrastructure (External Implementations)  
**Dependencies**: Core (interfaces), Shared (utilities)  
**Dependents**: Application  
**Status**: Fully implemented and tested
