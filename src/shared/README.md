# Shared Layer - Cross-Cutting Concerns

The Shared layer contains utilities, types, constants, and errors used across all other layers. It has no dependencies on other layers and provides foundational functionality.

## Architecture Role

```
Shared Layer (Foundation)
    ↑ used by
Core, Infrastructure, Application Layers
```

## Directory Structure

```
shared/
├── types/              # TypeScript type definitions
│   ├── responses.ts           # RDAP response types
│   ├── options.ts             # Configuration options
│   ├── entities.ts            # RDAP entity types
│   ├── enums.ts               # Enumerations
│   ├── errors.ts              # Error types
│   └── index.ts
├── errors/             # Error classes
│   ├── base.error.ts          # Base error classes
│   └── index.ts
├── constants/          # Application constants
│   ├── rdap.constants.ts      # RDAP protocol constants
│   ├── http.constants.ts      # HTTP constants
│   └── index.ts
└── utils/              # Utility functions
    ├── validators/            # Input validation
    │   ├── domain.ts
    │   ├── ip.ts
    │   ├── asn.ts
    │   ├── network.ts
    │   └── index.ts
    ├── helpers/               # Helper functions
    │   ├── async.ts           # Async utilities
    │   ├── cache.ts           # Cache utilities
    │   ├── format.ts          # Formatting
    │   ├── http.ts            # HTTP utilities
    │   ├── object.ts          # Object utilities
    │   ├── runtime.ts         # Runtime detection
    │   ├── string.ts          # String utilities
    │   └── index.ts
    └── formatters/            # Data formatters (future)
```

## Components Overview

### Types (`types/`)

**Purpose:** TypeScript type definitions for the entire application

**Categories:**
- **Responses** - RDAP response structures (Domain, IP, ASN)
- **Options** - Configuration options for client
- **Entities** - RDAP entities (registrar, contacts, etc.)
- **Enums** - Enumeration types (status, events, roles)
- **Errors** - Error type definitions

**Key Types:**
- `RDAPResponse` - Union of all response types
- `DomainResponse` - Domain query response
- `IPResponse` - IP query response
- `ASNResponse` - ASN query response
- `RDAPClientOptions` - Client configuration
- `RDAPEntity` - Entity information
- `RDAPEvent` - Lifecycle events

### Errors (`errors/`)

**Purpose:** Custom error classes with context and error codes

**Error Hierarchy:**
```
RDAPifyError (base)
├── ValidationError (400)
├── NetworkError (500)
├── TimeoutError (408)
├── RDAPServerError (4xx/5xx)
├── NoServerFoundError (404)
├── ParseError (500)
├── CacheError (500)
├── RateLimitError (429)
├── SSRFProtectionError (403)
└── NormalizationError (500)
```

**Features:**
- Error codes for programmatic handling
- HTTP status codes
- Context data for debugging
- Stack trace preservation

### Constants (`constants/`)

**Purpose:** Application-wide constants and configuration defaults

**Categories:**
- **RDAP Constants** - Protocol-specific values
- **HTTP Constants** - HTTP-related constants

**Key Constants:**
- `DEFAULT_BOOTSTRAP_URL` - IANA bootstrap URL
- `DEFAULT_CACHE_TTL` - 1 hour cache TTL
- `DEFAULT_USER_AGENT` - Client identification
- `RDAP_CONTENT_TYPES` - Accepted content types
- `BOOTSTRAP_TYPES` - Bootstrap service types

### Utils (`utils/`)

**Purpose:** Reusable utility functions

**Categories:**
- **Validators** - Input validation and normalization
- **Helpers** - General-purpose utilities
- **Formatters** - Data formatting (future)

## Detailed Documentation

### Types

**Response Types:**
```typescript
// Domain response
interface DomainResponse {
  query: string;
  objectClass: 'domain';
  handle?: string;
  ldhName?: string;
  status?: RDAPStatus[];
  nameservers?: string[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  registrar?: { name?: string; handle?: string; url?: string };
  metadata: { source: string; timestamp: string; cached: boolean };
}

// IP response
interface IPResponse {
  query: string;
  objectClass: 'ip network';
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  ipVersion?: 'v4' | 'v6';
  name?: string;
  country?: string;
  // ... similar structure
}

// ASN response
interface ASNResponse {
  query: string;
  objectClass: 'autnum';
  handle?: string;
  startAutnum?: number;
  endAutnum?: number;
  name?: string;
  // ... similar structure
}
```

**Configuration Types:**
```typescript
interface RDAPClientOptions {
  cache?: boolean | CacheOptions;
  privacy?: boolean | PrivacyOptions;
  timeout?: number | TimeoutOptions;
  retry?: boolean | RetryOptions;
  ssrfProtection?: boolean | SSRFProtectionOptions;
  userAgent?: string;
  headers?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
  bootstrapUrl?: string;
  includeRaw?: boolean;
}
```

### Errors

**Base Error:**
```typescript
class RDAPifyError extends Error {
  code: string;              // Error code (e.g., 'VALIDATION_ERROR')
  statusCode?: number;       // HTTP status code
  context?: Record<string, any>;  // Additional context
}
```

**Usage:**
```typescript
// Throw with context
throw new ValidationError('Invalid domain', { domain: 'invalid..com' });

// Catch and handle
try {
  await client.domain('example.com');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid input:', error.context);
  } else if (error instanceof NetworkError) {
    console.error('Network issue:', error.statusCode);
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` - Invalid input
- `NETWORK_ERROR` - Network issues
- `TIMEOUT_ERROR` - Request timeout
- `RDAP_SERVER_ERROR` - Server error
- `NO_SERVER_FOUND` - No RDAP server
- `PARSE_ERROR` - Parse failure
- `CACHE_ERROR` - Cache operation failed
- `RATE_LIMIT_ERROR` - Too many requests
- `SSRF_PROTECTION_ERROR` - Security violation
- `NORMALIZATION_ERROR` - Normalization failed

### Validators

**Domain Validation:**
```typescript
// Validate domain format
validateDomain('example.com');  // OK
validateDomain('invalid..com'); // Throws ValidationError

// Normalize domain
normalizeDomain('EXAMPLE.COM');  // Returns: 'example.com'
normalizeDomain('example.com.'); // Returns: 'example.com'
```

**IP Validation:**
```typescript
// Validate IP (returns version)
validateIP('8.8.8.8');                    // Returns: 'v4'
validateIP('2001:4860:4860::8888');       // Returns: 'v6'
validateIP('invalid');                    // Throws ValidationError

// Validate specific version
validateIPv4('8.8.8.8');                  // OK
validateIPv6('2001:4860:4860::8888');     // OK

// Normalize IP
normalizeIP('8.8.8.8');                   // Returns: '8.8.8.8'
normalizeIP('2001:4860:4860::8888');      // Returns normalized IPv6
```

**ASN Validation:**
```typescript
// Validate ASN
validateASN(15169);        // Returns: 15169
validateASN('AS15169');    // Returns: 15169
validateASN('15169');      // Returns: 15169
validateASN(-1);           // Throws ValidationError

// Normalize ASN
normalizeASN(15169);       // Returns: 'AS15169'
normalizeASN('AS15169');   // Returns: 'AS15169'
```

**Network Validation:**
```typescript
// Check IP types
isPrivateIP('192.168.1.1');     // Returns: true (RFC 1918)
isPrivateIP('8.8.8.8');         // Returns: false

isLocalhost('127.0.0.1');       // Returns: true
isLocalhost('::1');             // Returns: true

isLinkLocal('169.254.1.1');     // Returns: true (APIPA)
isLinkLocal('fe80::1');         // Returns: true (IPv6 link-local)
```

### Helpers

**Async Utilities:**
```typescript
// Calculate backoff delay
calculateBackoff(1, 'exponential', 1000, 10000);  // Returns: 2000
calculateBackoff(2, 'exponential', 1000, 10000);  // Returns: 4000
calculateBackoff(3, 'linear', 1000, 10000);       // Returns: 3000

// Sleep
await sleep(1000);  // Wait 1 second

// Timeout wrapper
const result = await withTimeout(
  fetch(url),
  5000,
  'Request timeout'
);
```

**String Utilities:**
```typescript
// Extract TLD
extractTLD('example.com');           // Returns: 'com'
extractTLD('subdomain.example.co.uk'); // Returns: 'co.uk'

// Sanitize URL
sanitizeUrl('https://example.com/path?query=1');  // Clean URL

// Truncate
truncate('Long text here', 10);      // Returns: 'Long te...'
```

**Object Utilities:**
```typescript
// Check plain object
isPlainObject({});                   // Returns: true
isPlainObject([]);                   // Returns: false
isPlainObject(null);                 // Returns: false

// Deep merge
const merged = deepMerge(
  { a: 1, b: { c: 2 } },
  { b: { d: 3 }, e: 4 }
);
// Returns: { a: 1, b: { c: 2, d: 3 }, e: 4 }
```

**Cache Utilities:**
```typescript
// Generate cache key
generateCacheKey('domain', 'example.com');  // Returns: 'domain:example.com'
generateCacheKey('ip', '8.8.8.8');          // Returns: 'ip:8.8.8.8'
generateCacheKey('asn', 'AS15169');         // Returns: 'asn:AS15169'
```

**HTTP Utilities:**
```typescript
// Parse Retry-After header
parseRetryAfter('120');              // Returns: 120 (seconds)
parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT');  // Returns: seconds until date
```

**Format Utilities:**
```typescript
// Format bytes
formatBytes(1024);                   // Returns: '1.00 KB'
formatBytes(1048576);                // Returns: '1.00 MB'

// Format duration
formatDuration(1000);                // Returns: '1s'
formatDuration(65000);               // Returns: '1m 5s'
```

**Runtime Detection:**
```typescript
// Detect runtime environment
isNode();                            // Returns: true (in Node.js)
isBrowser();                         // Returns: true (in browser)
isDeno();                            // Returns: true (in Deno)
isBun();                             // Returns: true (in Bun)

getRuntimeName();                    // Returns: 'node' | 'browser' | 'deno' | 'bun'
```

## Design Principles

### 1. No Dependencies
- Shared layer has no dependencies on other layers
- Pure utility functions
- Framework-agnostic

### 2. Reusability
- Functions used across all layers
- Generic and composable
- Well-tested

### 3. Type Safety
- Strong TypeScript types
- No `any` types
- Explicit return types

### 4. Immutability
- No side effects
- Pure functions where possible
- Predictable behavior

## Usage Patterns

### Type Imports
```typescript
// Always use type imports for types
import type { RDAPResponse, DomainResponse } from './shared/types';

// Regular imports for values
import { DEFAULT_CACHE_TTL } from './shared/constants';
```

### Error Handling
```typescript
import { ValidationError, NetworkError } from './shared/errors';

function validateInput(input: string): void {
  if (!input) {
    throw new ValidationError('Input is required', { input });
  }
}

try {
  validateInput('');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.context);
  }
}
```

### Validation
```typescript
import { validateDomain, validateIP } from './shared/utils/validators';

// Validate before processing
validateDomain(domain);  // Throws if invalid
const version = validateIP(ip);  // Returns version or throws
```

## Testing

### Unit Tests
All shared utilities should have comprehensive unit tests:

```typescript
describe('validators', () => {
  describe('validateDomain', () => {
    it('should accept valid domains', () => {
      expect(() => validateDomain('example.com')).not.toThrow();
    });
    
    it('should reject invalid domains', () => {
      expect(() => validateDomain('invalid..com')).toThrow(ValidationError);
    });
  });
});

describe('helpers', () => {
  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoff(1, 'exponential', 1000, 10000)).toBe(2000);
      expect(calculateBackoff(2, 'exponential', 1000, 10000)).toBe(4000);
    });
  });
});
```

### Test Location
- Unit tests: `tests/unit/shared/`
- Test coverage: >95% for shared utilities

## Performance

### Validators
- Domain validation: ~0.01ms
- IP validation: ~0.01ms
- ASN validation: ~0.01ms

### Helpers
- Deep merge: ~0.1ms (small objects)
- Cache key generation: ~0.01ms
- String operations: ~0.01ms

### Optimization
- No unnecessary allocations
- Efficient algorithms
- Minimal dependencies

## Future Enhancements

### Planned Features
1. **Formatters** - Data formatting utilities
2. **Serializers** - Custom serialization
3. **Parsers** - Additional parsing utilities
4. **Crypto** - Cryptographic utilities
5. **Compression** - Data compression

## Related Documentation

- **Core Layer**: `src/core/README.md`
- **Infrastructure Layer**: `src/infrastructure/README.md`
- **Application Layer**: `src/application/README.md`
- **Type Reference**: `docs/api_reference/types/`

---

**Layer**: Shared (Foundation)  
**Dependencies**: None  
**Dependents**: All other layers  
**Status**: Fully implemented and tested
