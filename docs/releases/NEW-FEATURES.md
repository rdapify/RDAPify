# 🎉 New Features in RDAPify

## Quick Overview

RDAPify now includes powerful new features to enhance your RDAP queries:

### 🚦 Rate Limiting
Control request rates to prevent being blocked by RDAP servers.

```typescript
const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000  // 100 requests per minute
  }
});
```

### 📦 Batch Processing
Process multiple queries efficiently in parallel.

```typescript
const batchProcessor = client.getBatchProcessor();
const results = await batchProcessor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'ip', query: '8.8.8.8' }
]);
```

### 💡 Enhanced Error Handling
Get helpful suggestions when errors occur.

```typescript
try {
  await client.domain('example.com');
} catch (error) {
  console.log(error.getUserMessage());  // User-friendly message
  console.log(error.suggestion);         // How to fix it
}
```

### 🎯 Generic Types
Type-safe queries with automatic result type inference.

```typescript
import type { QueryResult } from 'rdapify';

async function query<T extends 'domain' | 'ip'>(
  type: T,
  value: string
): Promise<QueryResult<T>> {
  // TypeScript knows the exact return type!
}
```

### 📉 Smaller Bundle Size
Tree shaking support for smaller production bundles.

```typescript
// Import only what you need
import { RDAPClient } from 'rdapify';
import { ValidationError } from 'rdapify/errors';
import { validateDomain } from 'rdapify/validators';
```

---

## Quick Start

### Installation

```bash
npm install rdapify
```

### Basic Usage with New Features

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  // Enable rate limiting
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000
  },
  
  // Other options
  cache: true,
  privacy: { redactPII: true }
});

// Single query
const domain = await client.domain('example.com');

// Batch processing
const batchProcessor = client.getBatchProcessor();
const results = await batchProcessor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'domain', query: 'google.com' }
]);

// Enhanced error handling
try {
  await client.domain('invalid');
} catch (error) {
  console.log(error.getUserMessage());
  console.log(error.suggestion);
}
```

---

## Testing the New Features

Run the test script to see all features in action:

```bash
node test-improvements.js
```

---

## Documentation

### Guides
- [Rate Limiting Guide](docs/guides/rate_limiting.md)
- [Batch Processing Guide](docs/guides/batch_processing.md)
- [Error Handling Guide](docs/guides/error_handling.md)

### Examples
- [Rate Limiting Examples](examples/advanced/rate_limiting_example.js)
- [Batch Processing Examples](examples/advanced/batch_processing_example.js)

### API Reference
- [RateLimiter API](docs/api_reference/rate_limiter.md)
- [BatchProcessor API](docs/api_reference/batch_processor.md)
- [Error Classes](docs/api_reference/errors.md)

---

## Migration Guide

### From v0.1.x to v0.2.0

All new features are **optional** and **backward compatible**. Your existing code will continue to work without any changes.

#### To Enable Rate Limiting:

```typescript
// Before (still works)
const client = new RDAPClient();

// After (with rate limiting)
const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000
  }
});
```

#### To Use Batch Processing:

```typescript
// Before (still works)
const result1 = await client.domain('example.com');
const result2 = await client.domain('google.com');

// After (more efficient)
const batchProcessor = client.getBatchProcessor();
const results = await batchProcessor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'domain', query: 'google.com' }
]);
```

#### Enhanced Error Handling:

```typescript
// Before (still works)
try {
  await client.domain('example.com');
} catch (error) {
  console.log(error.message);
}

// After (more helpful)
try {
  await client.domain('example.com');
} catch (error) {
  console.log(error.getUserMessage());  // User-friendly
  console.log(error.suggestion);         // How to fix
  console.log(error.timestamp);          // When it happened
}
```

---

## Performance Improvements

### Batch Processing Performance

Processing 100 domains:

- **Sequential**: ~50 seconds
- **Batch (concurrency: 5)**: ~10 seconds
- **Batch (concurrency: 10)**: ~5 seconds

### Bundle Size Reduction

With tree shaking:

- **Before**: ~150KB
- **After**: ~120KB (20% reduction)

---

## What's Next?

### Planned for v0.3.0:
- Redis Cache Adapter
- CLI Tool
- Connection Pooling
- Advanced Analytics

### Planned for v0.4.0:
- Multi-tenant Support
- Audit Logging
- Custom Middleware
- GraphQL API

---

## Feedback

We'd love to hear your feedback on these new features!

- **GitHub Issues**: Report bugs or request features
- **GitHub Discussions**: Ask questions or share ideas
- **Email**: feedback@rdapify.com

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Happy querying! 🚀**
