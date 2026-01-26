# Rate Limiting Guide

Rate limiting helps you control the number of requests made to RDAP servers, preventing your application from being blocked due to excessive requests.

## Overview

RDAPify includes a built-in token bucket rate limiter that:
- Tracks requests per time window
- Supports multiple keys (users, IPs, etc.)
- Automatically cleans up old records
- Provides detailed usage statistics

## Basic Usage

### Enable Rate Limiting in Client

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  rateLimit: {
    enabled: true,
    maxRequests: 100,    // Maximum requests
    windowMs: 60000      // Per 1 minute
  }
});

// Rate limiting is automatically applied to all queries
const domain = await client.domain('example.com');
```

### Standalone Rate Limiter

```typescript
import { RateLimiter } from 'rdapify';

const limiter = new RateLimiter({
  enabled: true,
  maxRequests: 50,
  windowMs: 30000  // 30 seconds
});

// Check limit before operation
await limiter.checkLimit('user-123');

// Get usage information
const usage = limiter.getUsage('user-123');
console.log(`${usage.current}/${usage.limit} requests used`);
console.log(`${usage.remaining} requests remaining`);
console.log(`Resets at: ${new Date(usage.resetAt)}`);
```

## Advanced Usage

### Per-User Rate Limiting

```typescript
const limiter = new RateLimiter({
  enabled: true,
  maxRequests: 100,
  windowMs: 60000
});

// Different limits for different users
await limiter.checkLimit('user-1');
await limiter.checkLimit('user-2');
await limiter.checkLimit('user-3');

// Each user has their own limit
```

### Handling Rate Limit Errors

```typescript
import { RateLimitError } from 'rdapify';

try {
  await client.domain('example.com');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limit exceeded!');
    console.log(`Retry after: ${error.retryAfter}ms`);
    console.log(`Suggestion: ${error.suggestion}`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, error.retryAfter));
    await client.domain('example.com');
  }
}
```

### Reset Limits

```typescript
// Reset limit for specific key
limiter.reset('user-123');

// Reset all limits
limiter.resetAll();
```

### Get Statistics

```typescript
const stats = limiter.getStats();

console.log('Enabled:', stats.enabled);
console.log('Max Requests:', stats.maxRequests);
console.log('Window (ms):', stats.windowMs);
console.log('Active Keys:', stats.activeKeys);
console.log('Total Requests:', stats.totalRequests);
```

## Configuration Options

```typescript
interface RateLimitOptions {
  /** Enable rate limiting */
  enabled?: boolean;
  
  /** Maximum requests per window */
  maxRequests?: number;
  
  /** Time window in milliseconds */
  windowMs?: number;
}
```

### Default Values

```typescript
{
  enabled: false,
  maxRequests: 100,
  windowMs: 60000  // 1 minute
}
```

## Best Practices

### 1. Choose Appropriate Limits

```typescript
// For public API
const publicLimiter = new RateLimiter({
  enabled: true,
  maxRequests: 10,
  windowMs: 60000  // 10 requests per minute
});

// For authenticated users
const userLimiter = new RateLimiter({
  enabled: true,
  maxRequests: 100,
  windowMs: 60000  // 100 requests per minute
});

// For internal services
const internalLimiter = new RateLimiter({
  enabled: true,
  maxRequests: 1000,
  windowMs: 60000  // 1000 requests per minute
});
```

### 2. Use Meaningful Keys

```typescript
// By user ID
await limiter.checkLimit(`user:${userId}`);

// By IP address
await limiter.checkLimit(`ip:${ipAddress}`);

// By API key
await limiter.checkLimit(`api:${apiKey}`);

// By tenant
await limiter.checkLimit(`tenant:${tenantId}`);
```

### 3. Monitor Usage

```typescript
// Check usage before making request
const usage = limiter.getUsage('user-123');

if (usage.remaining < 10) {
  console.warn('Approaching rate limit!');
}

if (usage.remaining === 0) {
  const waitTime = usage.resetAt - Date.now();
  console.log(`Rate limit reached. Wait ${waitTime}ms`);
}
```

### 4. Graceful Degradation

```typescript
async function queryWithFallback(domain: string) {
  try {
    return await client.domain(domain);
  } catch (error) {
    if (error instanceof RateLimitError) {
      // Fall back to cached data
      const cached = await cache.get(`domain:${domain}`);
      if (cached) {
        return cached;
      }
      
      // Or queue for later
      await queue.add({ type: 'domain', query: domain });
      throw error;
    }
    throw error;
  }
}
```

## Integration Examples

### Express Middleware

```typescript
import express from 'express';
import { RateLimiter, RateLimitError } from 'rdapify';

const app = express();
const limiter = new RateLimiter({
  enabled: true,
  maxRequests: 100,
  windowMs: 60000
});

app.use(async (req, res, next) => {
  try {
    await limiter.checkLimit(req.ip);
    next();
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: error.retryAfter
      });
    } else {
      next(error);
    }
  }
});
```

### With Redis (Custom Implementation)

```typescript
import { RateLimiter } from 'rdapify';
import Redis from 'ioredis';

class RedisRateLimiter extends RateLimiter {
  private redis: Redis;
  
  constructor(options, redisClient) {
    super(options);
    this.redis = redisClient;
  }
  
  async checkLimit(key: string): Promise<void> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    
    if (count === 1) {
      await this.redis.expire(redisKey, this.windowMs / 1000);
    }
    
    if (count > this.maxRequests) {
      const ttl = await this.redis.ttl(redisKey);
      throw new RateLimitError(
        'Rate limit exceeded',
        { key, limit: this.maxRequests },
        ttl * 1000
      );
    }
  }
}
```

## Cleanup

```typescript
// Clean up resources when done
limiter.destroy();
```

## See Also

- [Error Handling Guide](./error_handling.md)
- [Performance Guide](./performance.md)
- [Batch Processing Guide](./batch_processing.md)
