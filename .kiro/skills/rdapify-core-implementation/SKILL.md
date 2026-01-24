---
name: RDAPify Core Implementation
description: Implements core RDAP client functionality following RFC 7480 standards with TypeScript strict mode
---

# RDAPify Core Implementation Skill

## Purpose
This skill guides the implementation of RDAPify's core RDAP client components following strict architectural patterns and security requirements.

## Architecture Layers

### 1. Client Layer (src/client/)
- Entry point for all RDAP queries
- Coordinates between Fetcher, Normalizer, and Cache
- Handles high-level error management

### 2. Fetcher Layer (src/fetcher/)
- Bootstrap discovery via IANA
- HTTP requests with SSRF protection
- Retry logic and timeout handling

### 3. Normalizer Layer (src/normalizer/)
- JSONPath-based data transformation
- PII redaction for GDPR compliance
- Consistent response format

### 4. Cache Layer (src/cache/)
- In-memory caching with TTL
- Cache invalidation strategies
- Optional Redis support

## Implementation Rules

### Type Safety
```typescript
// All functions must have explicit return types
export async function queryDomain(domain: string): Promise<RDAPResponse> {
  // implementation
}

// Use discriminated unions for errors
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: RDAPError };
```

### Security Requirements
1. **SSRF Protection**: All URLs must pass through `SSRFProtection.validate()`
2. **Input Validation**: Use validators from `src/utils/validators.ts`
3. **Certificate Validation**: Enable strict TLS verification
4. **PII Redaction**: Apply `PIIRedactor` to all responses when privacy mode enabled

### Error Handling Pattern
```typescript
import { RDAPError, ValidationError, NetworkError } from './types/errors';

try {
  const validated = validateDomain(domain);
  const response = await fetch(url);
  return normalizeResponse(response);
} catch (error) {
  if (error instanceof ValidationError) {
    throw error; // Re-throw validation errors
  }
  throw new NetworkError('Failed to fetch RDAP data', { cause: error });
}
```

## File Structure

```
src/
├── client/
│   └── RDAPClient.ts          # Main client class
├── fetcher/
│   ├── Fetcher.ts             # HTTP fetching logic
│   ├── BootstrapDiscovery.ts  # IANA bootstrap
│   └── SSRFProtection.ts      # Security validation
├── normalizer/
│   ├── Normalizer.ts          # Data transformation
│   └── PIIRedactor.ts         # Privacy protection
├── cache/
│   ├── CacheManager.ts        # Cache coordination
│   └── InMemoryCache.ts       # Default cache impl
├── types/
│   ├── index.ts               # Response types
│   ├── errors.ts              # Error classes
│   └── options.ts             # Configuration types
└── utils/
    ├── validators.ts          # Input validation
    └── helpers.ts             # Utility functions
```

## Testing Requirements

When implementing core functionality:
1. Check if tests are requested before creating test files
2. Use test vectors from `test_vectors/` directory
3. Test error cases, not just happy paths
4. Verify SSRF protection with malicious URLs

## Dependencies

Check `package.json` before using any external library. Approved dependencies:
- Standard Node.js APIs (https, dns, url)
- No external HTTP clients (use native fetch/https)
- TypeScript strict mode enabled

## Progressive Implementation

Implement in this order:
1. Type definitions (`src/types/`)
2. Validators and helpers (`src/utils/`)
3. SSRF protection (`src/fetcher/SSRFProtection.ts`)
4. Cache layer (`src/cache/`)
5. Fetcher layer (`src/fetcher/`)
6. Normalizer layer (`src/normalizer/`)
7. Client layer (`src/client/`)

## Reference Files

- [[file:architecture-patterns.md]] - Detailed architecture patterns
- [[file:security-checklist.md]] - Security validation checklist
- [[file:test-vectors-guide.md]] - How to use test vectors
