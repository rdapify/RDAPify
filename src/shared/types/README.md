# Type Definitions

TypeScript type definitions for the entire RDAPify application.

## Files

### responses.ts
**Purpose:** RDAP response type definitions

**Types:**
- `DomainResponse` - Domain query response
- `IPResponse` - IP address query response
- `ASNResponse` - ASN query response
- `RDAPResponse` - Union of all response types
- `RawRDAPResponse` - Raw server response before normalization

**Usage:**
```typescript
import type { DomainResponse, RDAPResponse } from './responses';

function processDomain(response: DomainResponse): void {
  console.log(response.ldhName);
  console.log(response.status);
}

function processAny(response: RDAPResponse): void {
  switch (response.objectClass) {
    case 'domain':
      // TypeScript knows this is DomainResponse
      console.log(response.ldhName);
      break;
    case 'ip network':
      // TypeScript knows this is IPResponse
      console.log(response.startAddress);
      break;
    case 'autnum':
      // TypeScript knows this is ASNResponse
      console.log(response.startAutnum);
      break;
  }
}
```

### options.ts
**Purpose:** Configuration option types

**Types:**
- `RDAPClientOptions` - Main client configuration
- `CacheOptions` - Cache configuration
- `RetryOptions` - Retry configuration
- `TimeoutOptions` - Timeout configuration
- `SSRFProtectionOptions` - SSRF protection configuration
- `PrivacyOptions` - Privacy/PII redaction configuration
- `LoggingOptions` - Logging configuration
- `RateLimitOptions` - Rate limiting configuration

**Usage:**
```typescript
import type { RDAPClientOptions, CacheOptions } from './options';

const cacheConfig: CacheOptions = {
  strategy: 'memory',
  ttl: 3600,
  maxSize: 1000
};

const clientConfig: RDAPClientOptions = {
  cache: cacheConfig,
  timeout: 5000,
  retry: { maxAttempts: 3 }
};
```

### entities.ts
**Purpose:** RDAP entity type definitions

**Types:**
- `RDAPEntity` - Entity information (registrar, contacts)
- `RDAPEvent` - Lifecycle events
- `RDAPLink` - Related links
- `RDAPRemark` - Remarks and notices
- `RDAPNameserver` - Nameserver information

**Usage:**
```typescript
import type { RDAPEntity, RDAPEvent } from './entities';

function processEntity(entity: RDAPEntity): void {
  console.log(entity.handle);
  console.log(entity.roles);
  if (entity.vcardArray) {
    // Process vCard data
  }
}

function processEvents(events: RDAPEvent[]): void {
  events.forEach(event => {
    console.log(event.eventAction);
    console.log(event.eventDate);
  });
}
```

### enums.ts
**Purpose:** Enumeration types

**Types:**
- `QueryType` - Query types ('domain' | 'ip' | 'asn')
- `ObjectClass` - RDAP object classes
- `RDAPStatus` - Status codes
- `EventType` - Event types
- `RoleType` - Entity roles
- `CacheStrategy` - Cache strategies
- `BackoffStrategy` - Retry backoff strategies
- `LogLevel` - Logging levels

**Usage:**
```typescript
import type { QueryType, RDAPStatus } from './enums';

function query(type: QueryType, value: string): void {
  // type is 'domain' | 'ip' | 'asn'
}

function checkStatus(status: RDAPStatus[]): boolean {
  return status.includes('active');
}
```

### errors.ts
**Purpose:** Error type definitions

**Types:**
- Error context types
- Error code types
- Error metadata types

## Type Safety Best Practices

### Use Type Imports
```typescript
// ✅ GOOD - Type-only import
import type { RDAPResponse } from './types';

// ❌ BAD - Regular import for types
import { RDAPResponse } from './types';
```

### Discriminated Unions
```typescript
// RDAPResponse is a discriminated union
function process(response: RDAPResponse): void {
  // TypeScript uses objectClass to narrow the type
  if (response.objectClass === 'domain') {
    // response is DomainResponse here
    console.log(response.ldhName);
  }
}
```

### Optional vs Required
```typescript
// Use optional (?) for fields that may not exist
interface DomainResponse {
  query: string;           // Required
  handle?: string;         // Optional
  ldhName?: string;        // Optional
  status?: RDAPStatus[];   // Optional
}
```

### Readonly Properties
```typescript
// Use readonly for immutable data
interface Metadata {
  readonly source: string;
  readonly timestamp: string;
  readonly cached: boolean;
}
```

## Type Hierarchy

```
RDAPResponse (union)
├── DomainResponse
│   ├── objectClass: 'domain'
│   ├── ldhName
│   ├── nameservers
│   └── ...
├── IPResponse
│   ├── objectClass: 'ip network'
│   ├── startAddress
│   ├── endAddress
│   └── ...
└── ASNResponse
    ├── objectClass: 'autnum'
    ├── startAutnum
    ├── endAutnum
    └── ...
```

## Common Patterns

### Type Guards
```typescript
function isDomainResponse(response: RDAPResponse): response is DomainResponse {
  return response.objectClass === 'domain';
}

function isIPResponse(response: RDAPResponse): response is IPResponse {
  return response.objectClass === 'ip network';
}

// Usage
if (isDomainResponse(response)) {
  console.log(response.ldhName);  // TypeScript knows this exists
}
```

### Generic Functions
```typescript
function processResponse<T extends RDAPResponse>(response: T): T {
  // Process and return same type
  return response;
}
```

### Partial Types
```typescript
// For updates or patches
type PartialDomainResponse = Partial<DomainResponse>;

// For required fields only
type RequiredFields = Required<Pick<DomainResponse, 'query' | 'objectClass'>>;
```

## Related

- **Shared Layer**: `src/shared/README.md`
- **API Reference**: `docs/api_reference/types/`
- **Response Format**: `docs/specifications/response_format.md`

---

**Purpose**: Type definitions for entire application  
**Dependencies**: None  
**Status**: Fully defined and documented
