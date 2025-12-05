# TypeScript Usage Guide

## Overview

RDAPify is built with TypeScript and provides comprehensive type definitions for type-safe RDAP queries.

## Installation

```bash
npm install rdapify
# Types are included - no @types package needed
```

## Basic Usage

```typescript
import { RDAPClient, DomainResponse } from 'rdapify';

const client = new RDAPClient();

// Type inference works automatically
const result = await client.domain('example.com');
// result is typed as DomainResponse

console.log(result.handle);        // ✓ Type-safe
console.log(result.invalidField);  // ✗ TypeScript error
```

## Type Definitions

### Client Configuration

```typescript
import { RDAPClient, ClientOptions } from 'rdapify';

const options: ClientOptions = {
  timeout: 5000,
  cache: {
    enabled: true,
    ttl: 3600
  },
  privacy: {
    redactPII: true
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential'
  }
};

const client = new RDAPClient(options);
```

### Response Types

```typescript
import type {
  DomainResponse,
  IPResponse,
  ASNResponse,
  Entity,
  Event,
  Nameserver
} from 'rdapify';

// Domain lookup
const domain: DomainResponse = await client.domain('example.com');

// IP lookup
const ip: IPResponse = await client.ip('8.8.8.8');

// ASN lookup
const asn: ASNResponse = await client.asn(15169);
```

## Generic Types

### Custom Entity Types

```typescript
interface CustomEntity extends Entity {
  customField: string;
  metadata: {
    source: string;
    verified: boolean;
  };
}

const result = await client.domain<CustomEntity>('example.com');
// result.entities[0].customField is now type-safe
```

### Custom Response Extensions

```typescript
interface ExtendedDomainResponse extends DomainResponse {
  customAnalysis: {
    riskScore: number;
    category: string;
  };
}

async function enrichedLookup(domain: string): Promise<ExtendedDomainResponse> {
  const result = await client.domain(domain);
  
  return {
    ...result,
    customAnalysis: {
      riskScore: calculateRisk(result),
      category: categorize(result)
    }
  };
}
```

## Type Guards

### Runtime Type Checking

```typescript
import { isDomainResponse, isIPResponse, isASNResponse } from 'rdapify';

async function universalLookup(query: string) {
  const result = await client.lookup(query);
  
  if (isDomainResponse(result)) {
    console.log('Nameservers:', result.nameservers);
  } else if (isIPResponse(result)) {
    console.log('Network:', result.network);
  } else if (isASNResponse(result)) {
    console.log('ASN:', result.startAutnum);
  }
}
```

### Custom Type Guards

```typescript
function hasRegistrar(response: DomainResponse): response is DomainResponse & { registrar: Registrar } {
  return response.registrar !== undefined;
}

const result = await client.domain('example.com');

if (hasRegistrar(result)) {
  // TypeScript knows registrar exists
  console.log(result.registrar.name);
}
```

## Utility Types

### Partial Updates

```typescript
import { Partial } from 'utility-types';

type PartialDomain = Partial<DomainResponse>;

function updateCache(domain: string, updates: PartialDomain) {
  // Only update provided fields
}
```

### Required Fields

```typescript
type RequiredDomain = Required<Pick<DomainResponse, 'handle' | 'ldhName' | 'status'>>;

function validateDomain(data: any): data is RequiredDomain {
  return (
    typeof data.handle === 'string' &&
    typeof data.ldhName === 'string' &&
    Array.isArray(data.status)
  );
}
```

### Readonly Types

```typescript
type ReadonlyDomain = Readonly<DomainResponse>;

function displayDomain(domain: ReadonlyDomain) {
  // Cannot modify domain
  // domain.handle = 'new'; // ✗ TypeScript error
}
```

## Advanced Patterns

### Discriminated Unions

```typescript
type QueryResult =
  | { type: 'domain'; data: DomainResponse }
  | { type: 'ip'; data: IPResponse }
  | { type: 'asn'; data: ASNResponse };

function processResult(result: QueryResult) {
  switch (result.type) {
    case 'domain':
      // result.data is DomainResponse
      console.log(result.data.nameservers);
      break;
    case 'ip':
      // result.data is IPResponse
      console.log(result.data.network);
      break;
    case 'asn':
      // result.data is ASNResponse
      console.log(result.data.startAutnum);
      break;
  }
}
```

### Mapped Types

```typescript
type ResponseCache = {
  [K in 'domain' | 'ip' | 'asn']: Map<string, 
    K extends 'domain' ? DomainResponse :
    K extends 'ip' ? IPResponse :
    ASNResponse
  >;
};

const cache: ResponseCache = {
  domain: new Map(),
  ip: new Map(),
  asn: new Map()
};
```

### Conditional Types

```typescript
type ResponseType<T extends string> =
  T extends 'domain' ? DomainResponse :
  T extends 'ip' ? IPResponse :
  T extends 'asn' ? ASNResponse :
  never;

async function typedLookup<T extends 'domain' | 'ip' | 'asn'>(
  type: T,
  query: string
): Promise<ResponseType<T>> {
  switch (type) {
    case 'domain':
      return client.domain(query) as Promise<ResponseType<T>>;
    case 'ip':
      return client.ip(query) as Promise<ResponseType<T>>;
    case 'asn':
      return client.asn(query) as Promise<ResponseType<T>>;
    default:
      throw new Error('Invalid type');
  }
}
```

## Error Handling

### Typed Errors

```typescript
import { RDAPError } from 'rdapify';

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (error instanceof RDAPError) {
    // TypeScript knows error properties
    console.log(error.code);
    console.log(error.statusCode);
    console.log(error.retryable);
  }
}
```

### Error Type Guards

```typescript
function isRDAPError(error: unknown): error is RDAPError {
  return error instanceof Error && 'code' in error;
}

try {
  const result = await client.domain('example.com');
} catch (error) {
  if (isRDAPError(error)) {
    console.log('RDAP Error:', error.code);
  } else {
    console.log('Unknown error:', error);
  }
}
```

## Best Practices

1. **Enable Strict Mode**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

2. **Use Type Inference**
```typescript
// Good - let TypeScript infer
const result = await client.domain('example.com');

// Unnecessary - explicit type
const result: DomainResponse = await client.domain('example.com');
```

3. **Leverage Type Guards**
```typescript
// Good - type-safe
if (isDomainResponse(result)) {
  console.log(result.nameservers);
}

// Bad - type assertion
console.log((result as DomainResponse).nameservers);
```

## See Also

- [Type Definitions Index](../api_reference/types/index.md)
- [API Reference](../api_reference/client.md)
- [Custom Adapters Guide](./custom_adapters.md)
