# Caching Strategies Guide

## Overview

Effective caching reduces latency, minimizes registry load, and improves application performance.

## Built-in Memory Cache

```typescript
import { RDAPClient } from 'rdapify';

const client = new RDAPClient({
  cache: {
    enabled: true,
    ttl: 3600,        // 1 hour in seconds
    maxSize: 1000     // Maximum cached entries
  }
});
```

## Cache Strategies

### Time-based Expiration (TTL)

```typescript
class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();

  constructor(private ttl: number) {}

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) return undefined;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### LRU (Least Recently Used)

```typescript
class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    this.cache.delete(key);
    
    // Add to end
    this.cache.set(key, value);
    
    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}
```

### Adaptive TTL

```typescript
class AdaptiveTTLCache {
  private cache = new Map<string, CacheEntry>();

  set(key: string, value: any, metadata: { changeFrequency: number }): void {
    // Adjust TTL based on how often data changes
    const baseTTL = 3600000; // 1 hour
    const ttl = baseTTL / Math.max(1, metadata.changeFrequency);
    
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl,
      hits: 0
    });
  }

  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    
    entry.hits++;
    
    // Extend TTL for popular entries
    if (entry.hits > 10) {
      entry.expires += 600000; // Add 10 minutes
    }
    
    return entry.value;
  }
}
```

## Redis Cache Integration

```typescript
import Redis from 'ioredis';

class RedisCache {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async get(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await this.redis.setex(
      key,
      ttl,
      JSON.stringify(value)
    );
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async clear(): Promise<void> {
    await this.redis.flushdb();
  }
}

// Usage with RDAPify
const cache = new RedisCache('redis://localhost:6379');

const client = new RDAPClient({
  cache: {
    get: (key) => cache.get(key),
    set: (key, value, ttl) => cache.set(key, value, ttl),
    delete: (key) => cache.delete(key)
  }
});
```

## Multi-tier Caching

```typescript
class MultiTierCache {
  constructor(
    private l1: TTLCache<string, any>,  // Memory cache
    private l2: RedisCache               // Redis cache
  ) {}

  async get(key: string): Promise<any | null> {
    // Try L1 (memory) first
    let value = this.l1.get(key);
    if (value) return value;

    // Try L2 (Redis)
    value = await this.l2.get(key);
    if (value) {
      // Populate L1
      this.l1.set(key, value);
      return value;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    // Set in both tiers
    this.l1.set(key, value);
    await this.l2.set(key, value, ttl);
  }
}
```

## Cache Warming

```typescript
async function warmCache(domains: string[]) {
  console.log(`Warming cache with ${domains.length} domains`);
  
  const results = await Promise.allSettled(
    domains.map(domain => client.domain(domain))
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Cache warmed: ${successful}/${domains.length} successful`);
}

// Warm cache on startup
const popularDomains = ['google.com', 'facebook.com', 'amazon.com'];
await warmCache(popularDomains);
```

## Cache Invalidation

```typescript
class CacheInvalidator {
  constructor(private cache: Cache) {}

  // Invalidate by pattern
  async invalidatePattern(pattern: RegExp): Promise<void> {
    const keys = await this.cache.keys();
    const toDelete = keys.filter(key => pattern.test(key));
    
    await Promise.all(
      toDelete.map(key => this.cache.delete(key))
    );
  }

  // Invalidate by TTL
  async invalidateExpired(): Promise<void> {
    const keys = await this.cache.keys();
    
    for (const key of keys) {
      const entry = await this.cache.get(key);
      if (!entry) continue; // Already expired
    }
  }

  // Invalidate by domain
  async invalidateDomain(domain: string): Promise<void> {
    await this.cache.delete(`domain:${domain}`);
  }
}
```

## Cache Metrics

```typescript
class CacheMetrics {
  private hits = 0;
  private misses = 0;
  private sets = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  recordSet(): void {
    this.sets++;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      hitRate: hitRate.toFixed(2) + '%'
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
  }
}
```

## Best Practices

1. **Choose Appropriate TTL**: Balance freshness vs. performance
2. **Monitor Hit Rates**: Track cache effectiveness
3. **Implement Eviction**: Prevent memory exhaustion
4. **Use Compression**: Reduce memory usage for large responses
5. **Cache Negative Results**: Avoid repeated failed queries
6. **Implement Warming**: Pre-populate frequently accessed data

## See Also

- [Performance Guide](./performance.md)
- [Redis Integration](../integrations/redis.md)
- [Geo-distributed Caching](./geo_caching.md)
