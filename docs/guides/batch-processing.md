# Batch Processing Guide

Batch processing allows you to efficiently query multiple domains, IPs, or ASNs in parallel with controlled concurrency.

## Overview

The BatchProcessor provides:
- Concurrent processing with configurable limits
- Error handling strategies
- Progress tracking
- Performance statistics

## Basic Usage

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();
const batchProcessor = client.getBatchProcessor();

// Process multiple queries
const results = await batchProcessor.processBatch([
  { type: 'domain', query: 'example.com' },
  { type: 'domain', query: 'google.com' },
  { type: 'ip', query: '8.8.8.8' },
  { type: 'asn', query: 15169 }
]);

// Check results
results.forEach(result => {
  if (result.error) {
    console.error(`Failed: ${result.query}`, result.error.message);
  } else {
    console.log(`Success: ${result.query}`, result.result);
  }
});
```

## Configuration Options

```typescript
interface BatchOptions {
  /** Maximum concurrent requests (default: 5) */
  concurrency?: number;
  
  /** Continue on error or stop (default: true) */
  continueOnError?: boolean;
  
  /** Timeout for entire batch in ms */
  timeout?: number;
}
```

## Advanced Usage

### Control Concurrency

```typescript
// Process 10 queries at a time
const results = await batchProcessor.processBatch(queries, {
  concurrency: 10
});

// Process one at a time (sequential)
const results = await batchProcessor.processBatch(queries, {
  concurrency: 1
});
```

### Error Handling

```typescript
// Stop on first error
const results = await batchProcessor.processBatch(queries, {
  continueOnError: false
});

// Continue processing even if some fail
const results = await batchProcessor.processBatch(queries, {
  continueOnError: true
});
```

### With Timeout

```typescript
// Timeout after 30 seconds
const results = await batchProcessor.processBatchWithTimeout(
  queries,
  30000,  // 30 seconds
  { concurrency: 5 }
);
```

## Analyzing Results

```typescript
const results = await batchProcessor.processBatch(queries);

// Get statistics
const stats = batchProcessor.analyzeBatchResults(results);

console.log('Total queries:', stats.total);
console.log('Successful:', stats.successful);
console.log('Failed:', stats.failed);
console.log('Success rate:', stats.successRate + '%');
console.log('Average duration:', stats.averageDuration + 'ms');
console.log('Total duration:', stats.totalDuration + 'ms');
```

## Real-World Examples

### Domain Portfolio Monitoring

```typescript
async function monitorDomains(domains: string[]) {
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  const queries = domains.map(domain => ({
    type: 'domain' as const,
    query: domain
  }));
  
  const results = await batchProcessor.processBatch(queries, {
    concurrency: 10,
    continueOnError: true
  });
  
  // Find expiring domains
  const expiring = results
    .filter(r => !r.error && r.result)
    .map(r => {
      const expiryEvent = r.result!.events?.find(e => e.type === 'expiration');
      if (expiryEvent) {
        const daysUntilExpiry = Math.floor(
          (new Date(expiryEvent.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return { domain: r.query, daysUntilExpiry };
      }
      return null;
    })
    .filter(d => d && d.daysUntilExpiry < 30);
  
  return expiring;
}
```

### IP Range Analysis

```typescript
async function analyzeIPRange(startIP: string, count: number) {
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  // Generate IP queries
  const queries = [];
  const baseIP = startIP.split('.').map(Number);
  
  for (let i = 0; i < count; i++) {
    const ip = [...baseIP];
    ip[3] = (ip[3] + i) % 256;
    queries.push({
      type: 'ip' as const,
      query: ip.join('.')
    });
  }
  
  const results = await batchProcessor.processBatch(queries, {
    concurrency: 5,
    continueOnError: true
  });
  
  // Group by country
  const byCountry = results
    .filter(r => !r.error && r.result)
    .reduce((acc, r) => {
      const country = r.result!.country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  return byCountry;
}
```

### ASN Discovery

```typescript
async function discoverASNs(startASN: number, count: number) {
  const client = new RDAPClient();
  const batchProcessor = client.getBatchProcessor();
  
  const queries = Array.from({ length: count }, (_, i) => ({
    type: 'asn' as const,
    query: startASN + i
  }));
  
  const results = await batchProcessor.processBatch(queries, {
    concurrency: 10,
    continueOnError: true
  });
  
  // Extract active ASNs
  const active = results
    .filter(r => !r.error && r.result)
    .map(r => ({
      asn: r.query,
      name: r.result!.name,
      country: r.result!.country
    }));
  
  return active;
}
```

## Performance Optimization

### Optimal Concurrency

```typescript
// Too low: slow processing
const results = await batchProcessor.processBatch(queries, {
  concurrency: 1  // Sequential
});

// Optimal: balance between speed and resource usage
const results = await batchProcessor.processBatch(queries, {
  concurrency: 5  // Recommended
});

// Too high: may hit rate limits or overwhelm server
const results = await batchProcessor.processBatch(queries, {
  concurrency: 50  // Risky
});
```

### With Caching

```typescript
const client = new RDAPClient({
  cache: {
    strategy: 'memory',
    ttl: 3600  // 1 hour
  }
});

// First batch: fetches from servers
const results1 = await batchProcessor.processBatch(queries);

// Second batch: uses cache (much faster)
const results2 = await batchProcessor.processBatch(queries);
```

### Progress Tracking

```typescript
async function processBatchWithProgress(queries: any[]) {
  const results: any[] = [];
  let completed = 0;
  
  // Process in chunks
  const chunkSize = 10;
  for (let i = 0; i < queries.length; i += chunkSize) {
    const chunk = queries.slice(i, i + chunkSize);
    const chunkResults = await batchProcessor.processBatch(chunk);
    results.push(...chunkResults);
    
    completed += chunk.length;
    console.log(`Progress: ${completed}/${queries.length} (${Math.round(completed / queries.length * 100)}%)`);
  }
  
  return results;
}
```

## Error Recovery

### Retry Failed Queries

```typescript
async function processBatchWithRetry(queries: any[], maxRetries = 3) {
  let results = await batchProcessor.processBatch(queries, {
    continueOnError: true
  });
  
  // Retry failed queries
  for (let retry = 0; retry < maxRetries; retry++) {
    const failed = results
      .filter(r => r.error)
      .map(r => ({ type: r.type, query: r.query }));
    
    if (failed.length === 0) break;
    
    console.log(`Retrying ${failed.length} failed queries (attempt ${retry + 1})`);
    
    const retryResults = await batchProcessor.processBatch(failed, {
      continueOnError: true
    });
    
    // Update results
    retryResults.forEach(retryResult => {
      const index = results.findIndex(
        r => r.type === retryResult.type && r.query === retryResult.query
      );
      if (index !== -1) {
        results[index] = retryResult;
      }
    });
  }
  
  return results;
}
```

## Best Practices

1. **Choose appropriate concurrency**: Start with 5, adjust based on performance
2. **Enable caching**: Reduces redundant queries
3. **Handle errors gracefully**: Use `continueOnError: true` for large batches
4. **Monitor progress**: For long-running batches
5. **Implement retry logic**: For transient failures
6. **Respect rate limits**: Don't set concurrency too high

## See Also

- [Rate Limiting Guide](./rate_limiting.md)
- [Caching Strategies](./caching_strategies.md)
- [Performance Guide](./performance.md)
