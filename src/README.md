# RDAPify Source Code

This directory contains the core implementation of RDAPify.

## Directory Structure

```
src/
├── index.ts                    # Main entry point and exports
├── client/
│   └── RDAPClient.ts          # Main RDAP client class
├── fetcher/
│   ├── Fetcher.ts             # HTTP fetcher with timeout handling
│   ├── SSRFProtection.ts      # SSRF protection layer
│   └── BootstrapDiscovery.ts  # IANA Bootstrap service discovery
├── normalizer/
│   ├── Normalizer.ts          # Response normalizer
│   └── PIIRedactor.ts         # PII redaction for GDPR/CCPA
├── cache/
│   ├── CacheManager.ts        # Cache manager with multiple strategies
│   └── InMemoryCache.ts       # In-memory cache with LRU eviction
├── types/
│   ├── index.ts               # Core type definitions
│   ├── options.ts             # Configuration options
│   └── errors.ts              # Custom error classes
└── utils/
    ├── validators.ts          # Input validation utilities
    └── helpers.ts             # Helper functions
```

## Core Components

### RDAPClient

The main client class that provides the public API:

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: true,
  privacy: { redactPII: true },
});

const result = await client.domain('example.com');
```

### Fetcher

HTTP client with SSRF protection and timeout handling:

- HTTPS-only enforcement
- Redirect handling with SSRF checks
- Configurable timeouts
- Error handling and retries

### SSRFProtection

Security layer that prevents Server-Side Request Forgery attacks:

- Private IP blocking (RFC 1918)
- Localhost filtering
- Link-local address blocking
- Domain whitelist/blacklist support

### BootstrapDiscovery

IANA Bootstrap service for discovering RDAP servers:

- Automatic server discovery for domains, IPs, and ASNs
- Bootstrap data caching (24 hours)
- Support for all TLDs and RIRs

### Normalizer

Converts raw RDAP responses to a consistent format:

- Handles different registry response formats
- Extracts common fields (nameservers, registrar, events)
- Provides unified interface regardless of source

### PIIRedactor

Redacts personally identifiable information for GDPR/CCPA compliance:

- vCard data sanitization
- Configurable field redaction
- Recursive entity processing

### CacheManager

Manages caching with multiple strategies:

- In-memory cache with LRU eviction
- Redis support (planned)
- Custom cache adapter interface
- Configurable TTL

## Type System

All types are fully documented with TypeScript:

- `DomainResponse` - Domain query results
- `IPResponse` - IP query results
- `ASNResponse` - ASN query results
- `RDAPClientOptions` - Client configuration
- Custom error classes with detailed context

## Error Handling

Custom error classes for different scenarios:

- `ValidationError` - Invalid input
- `SSRFProtectionError` - SSRF attempt blocked
- `NetworkError` - Network failure
- `TimeoutError` - Request timeout
- `RDAPServerError` - Server error response
- `NoServerFoundError` - No RDAP server found
- `ParseError` - Response parsing failure
- `CacheError` - Cache operation failure
- `RateLimitError` - Rate limit exceeded

## Development

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Testing

```bash
npm test
npm run test:unit
npm run test:integration
```

## Architecture Principles

1. **Security First**: SSRF protection and input validation at every layer
2. **Privacy by Default**: PII redaction enabled by default
3. **Fail Safe**: Graceful degradation when cache or optional features fail
4. **Type Safety**: Strict TypeScript with comprehensive type definitions
5. **Testability**: Dependency injection and interface-based design
6. **Performance**: Efficient caching and minimal memory footprint

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to the codebase.

## License

MIT License - see [LICENSE](../LICENSE) for details.
