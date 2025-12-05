# Batch Processing Guide

## Overview

Efficiently process multiple RDAP queries with rate limiting, parallelization, and error handling.

## Basic Batch Processing

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient();

async function batchLookup(domains: string[]) {
  const results = await Promise.allSettled(
    domains.map(domain => client.domain(domain))
  );

  return results.map((result, index) => ({
    domain: domains[index],
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }));
}

// Usage
const domains = ['example.com', 'google.com', 'github.com'];
const results = await batchLookup(domains);
```

## Controlled Concurrency

```typescript
class BatchProcessor {
  constructor(
    private client: RDAPClient,
    private concurrency: number = 5
  ) {}

  async processBatch<T>(
    items: string[],
    processor: (item: string) => Promise<T>
  ): Promise<Array<{ item: string; result?: T; error?: Error }>> {
    const results: Array<{ item: string; result?: T; error?: Error }> = [];
    const queue = [...items];

    const workers = Array(this.concurrency).fill(null).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        try {
          const result = await processor(item);
          results.push({ item, result });
        } catch (error) {
          results.push({ item, error: error as Error });
        }
      }
    });

    await Promise.all(workers);
    return results;
  }
}

// Usage
const processor = new BatchProcessor(client, 10);

const results = await processor.processBatch(
  domains,
  domain => client.domain(domain)
);
```

## Progress Tracking

```typescript
class ProgressTracker {
  private completed = 0;
  private failed = 0;
  private total: number;

  constructor(total: number) {
    this.total = total;
  }

  onSuccess() {
    this.completed++;
    this.logProgress();
  }

  onError() {
    this.failed++;
    this.logProgress();
  }

  private logProgress() {
    const processed = this.completed + this.failed;
    const percentage = ((processed / this.total) * 100).toFixed(1);
    console.log(
      `Progress: ${processed}/${this.total} (${percentage}%) - ` +
      `Success: ${this.completed}, Failed: ${this.failed}`
    );
  }
}

async function batchWithProgress(domains: string[]) {
  const tracker = new ProgressTracker(domains.length);
  const processor = new BatchProcessor(client, 10);

  return processor.processBatch(domains, async domain => {
    try {
      const result = await client.domain(domain);
      tracker.onSuccess();
      return result;
    } catch (error) {
      tracker.onError();
      throw error;
    }
  });
}
```

## Retry Logic

```typescript
async function batchWithRetry(
  domains: string[],
  maxRetries: number = 3
) {
  const processor = new BatchProcessor(client, 10);

  return processor.processBatch(domains, async domain => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await client.domain(domain);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }
    throw new Error('Max retries exceeded');
  });
}
```

## Chunked Processing

```typescript
function* chunk<T>(array: T[], size: number): Generator<T[]> {
  for (let i = 0; i < array.length; i += size) {
    yield array.slice(i, i + size);
  }
}

async function processInChunks(
  domains: string[],
  chunkSize: number = 100
) {
  const allResults = [];

  for (const chunk of chunk(domains, chunkSize)) {
    console.log(`Processing chunk of ${chunk.length} domains`);
    
    const results = await batchLookup(chunk);
    allResults.push(...results);
    
    // Delay between chunks
    await sleep(1000);
  }

  return allResults;
}
```

## Stream Processing

```typescript
import { Readable, Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';

class DomainReader extends Readable {
  constructor(private domains: string[]) {
    super({ objectMode: true });
  }

  _read() {
    const domain = this.domains.shift();
    this.push(domain || null);
  }
}

class RDAPTransform extends Transform {
  constructor(private client: RDAPClient) {
    super({ objectMode: true });
  }

  async _transform(domain: string, encoding: string, callback: Function) {
    try {
      const result = await this.client.domain(domain);
      this.push({ domain, success: true, data: result });
    } catch (error) {
      this.push({ domain, success: false, error });
    }
    callback();
  }
}

class ResultWriter extends Writable {
  private results: any[] = [];

  constructor() {
    super({ objectMode: true });
  }

  _write(chunk: any, encoding: string, callback: Function) {
    this.results.push(chunk);
    callback();
  }

  getResults() {
    return this.results;
  }
}

// Usage
async function streamProcess(domains: string[]) {
  const reader = new DomainReader(domains);
  const transformer = new RDAPTransform(client);
  const writer = new ResultWriter();

  await pipeline(reader, transformer, writer);
  
  return writer.getResults();
}
```

## Result Aggregation

```typescript
interface BatchResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    domain: string;
    status: 'success' | 'error';
    data?: any;
    error?: string;
  }>;
  duration: number;
}

async function batchWithStats(domains: string[]): Promise<BatchResult> {
  const startTime = Date.now();
  const results = await batchLookup(domains);

  return {
    total: domains.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results.map(r => ({
      domain: r.domain,
      status: r.success ? 'success' : 'error',
      data: r.data,
      error: r.error?.message
    })),
    duration: Date.now() - startTime
  };
}
```

## Best Practices

1. **Control Concurrency**: Don't overwhelm servers
2. **Implement Retries**: Handle transient failures
3. **Track Progress**: Monitor long-running operations
4. **Handle Errors**: Don't let one failure stop the batch
5. **Use Caching**: Avoid duplicate queries
6. **Respect Rate Limits**: Implement delays between batches

## See Also

- [Rate Limiting Guide](./rate_limiting.md)
- [Caching Strategies](./caching_strategies.md)
- [Performance Guide](./performance.md)
