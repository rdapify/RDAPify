# Rate Limiting Guide

## Overview

Implement rate limiting to prevent overwhelming RDAP servers and comply with registry policies.

## Built-in Rate Limiting

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  rateLimit: {
    maxRequests: 100,
    perMilliseconds: 60000, // 100 requests per minute
    strategy: 'sliding-window'
  }
});
```

## Rate Limit Strategies

### Token Bucket

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(tokens: number = 1): Promise<boolean> {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

### Sliding Window

```typescript
class SlidingWindow {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  async tryAcquire(): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old requests
    this.requests = this.requests.filter(time => time > windowStart);
    
    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }
    
    return false;
  }

  getWaitTime(): number {
    if (this.requests.length < this.maxRequests) return 0;
    
    const oldestRequest = this.requests[0];
    const windowStart = Date.now() - this.windowMs;
    
    return Math.max(0, oldestRequest - windowStart);
  }
}
```

## Per-Registry Rate Limiting

```typescript
class RegistryRateLimiter {
  private limiters = new Map<string, SlidingWindow>();

  constructor(private config: Record<string, RateLimitConfig>) {}

  async acquire(registry: string): Promise<void> {
    if (!this.limiters.has(registry)) {
      const config = this.config[registry] || this.config.default;
      this.limiters.set(
        registry,
        new SlidingWindow(config.maxRequests, config.windowMs)
      );
    }

    const limiter = this.limiters.get(registry)!;
    
    while (!(await limiter.tryAcquire())) {
      const waitTime = limiter.getWaitTime();
      await sleep(waitTime);
    }
  }
}

// Usage
const limiter = new RegistryRateLimiter({
  'verisign': { maxRequests: 100, windowMs: 60000 },
  'arin': { maxRequests: 50, windowMs: 60000 },
  'default': { maxRequests: 30, windowMs: 60000 }
});

await limiter.acquire('verisign');
const result = await client.domain('example.com');
```

## Handling 429 Responses

```typescript
async function queryWithRetry(domain: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.domain(domain);
    } catch (error) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        const retryAfter = error.retryAfter || 60000;
        console.log(`Rate limited, waiting ${retryAfter}ms`);
        await sleep(retryAfter);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Distributed Rate Limiting

### Redis-based Rate Limiting

```typescript
import Redis from 'ioredis';

class RedisRateLimiter {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async tryAcquire(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - windowMs;

    const pipeline = this.redis.pipeline();
    
    // Remove old entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry
    pipeline.pexpire(key, windowMs);

    const results = await pipeline.exec();
    const count = results[1][1] as number;

    return count < limit;
  }
}
```

## Best Practices

1. **Respect Registry Limits**: Each registry has different rate limits
2. **Implement Backoff**: Use exponential backoff for retries
3. **Monitor Usage**: Track rate limit consumption
4. **Use Caching**: Reduce unnecessary queries
5. **Batch Operations**: Group queries when possible

## See Also

- [Batch Processing Guide](./batch_processing.md)
- [Caching Strategies](./caching_strategies.md)
- [Error Handling](./error_handling.md)
