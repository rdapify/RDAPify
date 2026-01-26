# 🚀 Quick Start - New Features

## Installation

```bash
npm install rdapify
```

## 1. Rate Limiting (5 seconds)

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000
  }
});

await client.domain('example.com');
```

## 2. Batch Processing (10 seconds)

```typescript
const batchProcessor = client.getBatchProcessor();

const results = await batchProcessor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'domain', query: 'google.com' },
  { type: 'ip', query: '8.8.8.8' }
]);

console.log(`Success: ${results.filter(r => !r.error).length}`);
```

## 3. Enhanced Errors (5 seconds)

```typescript
try {
  await client.domain('invalid');
} catch (error) {
  console.log(error.getUserMessage());
  console.log(error.suggestion);
}
```

## 4. Test Everything (30 seconds)

```bash
node test-improvements.js
```

## More Info

- [Full Documentation](IMPROVEMENTS_SUMMARY.md)
- [Arabic Guide](التحسينات_المنفذة.md)
- [Examples](examples/advanced/)

---

**That's it! You're ready to use all new features.** 🎉
