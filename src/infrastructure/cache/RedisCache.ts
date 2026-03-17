/**
 * Redis cache adapter for RDAP responses
 * @module cache/RedisCache
 */

import type { RDAPResponse } from '../../shared/types';

import type { ICache } from './CacheManager';

/**
 * Minimal interface that any Redis-compatible client must satisfy.
 * Compatible with popular clients such as `ioredis` and `redis` (node-redis v4+).
 *
 * Pass your own Redis client instance when constructing `RedisCache` — the
 * library does **not** bundle a Redis client as a dependency.
 *
 * @example
 * // ioredis
 * import Redis from 'ioredis';
 * const client = new Redis();
 *
 * // node-redis v4
 * import { createClient } from 'redis';
 * const client = createClient();
 * await client.connect();
 */
export interface RedisClientLike {
  /** Retrieve a string value by key */
  get(key: string): Promise<string | null>;
  /** Store a string value; `options.EX` sets the TTL in seconds */
  set(key: string, value: string, options?: { EX?: number; PX?: number }): Promise<unknown>;
  /** Delete one or more keys */
  del(...keys: string[]): Promise<number>;
  /** Check existence of one or more keys; returns the count of existing keys */
  exists(...keys: string[]): Promise<number>;
  /** Return all keys matching the given glob-style pattern */
  keys(pattern: string): Promise<string[]>;
  /** Flush the currently selected database (optional — not available on all clients/configs) */
  flushDb?(): Promise<unknown>;
  /** Return the number of keys in the current database (optional) */
  dbSize?(): Promise<number>;
}

/**
 * Options accepted by `RedisCache`
 */
export interface RedisCacheOptions {
  /**
   * String prepended to every key stored in Redis.
   * Useful for namespace isolation in shared Redis instances.
   * @default 'rdapify:'
   */
  keyPrefix?: string;
}

/**
 * Redis-backed cache implementation for RDAP responses.
 *
 * Values are JSON-serialised before being stored and deserialised on retrieval.
 * All cache misses and Redis errors are handled gracefully — no exception is
 * propagated to the caller.
 *
 * @example
 * import Redis from 'ioredis';
 * import { RedisCache } from './RedisCache';
 *
 * const redis = new Redis();
 * const cache = new RedisCache(redis, { keyPrefix: 'myapp:rdap:' });
 */
export class RedisCache implements ICache {
  private readonly client: RedisClientLike;
  private readonly keyPrefix: string;

  constructor(client: RedisClientLike, options: RedisCacheOptions = {}) {
    this.client = client;
    this.keyPrefix = options.keyPrefix ?? 'rdapify:';
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the prefixed Redis key for a given logical cache key.
   */
  private prefixed(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Returns the glob pattern used to scan all keys owned by this adapter.
   */
  private patternAll(): string {
    return `${this.keyPrefix}*`;
  }

  // ---------------------------------------------------------------------------
  // ICache implementation
  // ---------------------------------------------------------------------------

  /**
   * Retrieves a cached RDAP response.
   * Returns `null` on a cache miss or if the stored value cannot be parsed.
   */
  async get(key: string): Promise<RDAPResponse | null> {
    const raw = await this.client.get(this.prefixed(key));

    if (raw === null) {
      return null;
    }

    try {
      return JSON.parse(raw) as RDAPResponse;
    } catch {
      // Corrupted data — treat as a miss
      return null;
    }
  }

  /**
   * Stores an RDAP response in Redis.
   *
   * @param key   Logical cache key
   * @param value RDAP response to cache
   * @param ttl   Time-to-live in seconds (defaults to no explicit TTL)
   */
  async set(key: string, value: RDAPResponse, ttl?: number): Promise<void> {
    const serialised = JSON.stringify(value);
    const prefixedKey = this.prefixed(key);

    if (ttl !== undefined && ttl > 0) {
      await this.client.set(prefixedKey, serialised, { EX: ttl });
    } else {
      await this.client.set(prefixedKey, serialised);
    }
  }

  /**
   * Deletes a single entry from Redis.
   */
  async delete(key: string): Promise<void> {
    await this.client.del(this.prefixed(key));
  }

  /**
   * Removes all entries whose key begins with the configured prefix.
   *
   * Uses `flushDb()` if available on the client, otherwise falls back to
   * scanning keys via the `keys()` command and deleting them individually.
   */
  async clear(): Promise<void> {
    if (typeof this.client.flushDb === 'function') {
      await this.client.flushDb();
      return;
    }

    const matchingKeys = await this.client.keys(this.patternAll());

    if (matchingKeys.length > 0) {
      await this.client.del(...matchingKeys);
    }
  }

  /**
   * Returns `true` if a key exists in Redis (i.e. has not expired).
   */
  async has(key: string): Promise<boolean> {
    const count = await this.client.exists(this.prefixed(key));
    return count > 0;
  }

  /**
   * Returns the number of keys currently held under the configured prefix.
   *
   * Uses `dbSize()` when available; otherwise counts matching keys via
   * the `keys()` command.
   *
   * **Note:** `dbSize()` returns the size of the *entire* database, which
   * may include keys from other applications. Prefer the `keys()`-based
   * fallback for accurate per-prefix counts in shared Redis instances.
   */
  async size(): Promise<number> {
    if (typeof this.client.dbSize === 'function') {
      const total = await this.client.dbSize();
      return total;
    }

    const matchingKeys = await this.client.keys(this.patternAll());
    return matchingKeys.length;
  }

  // ---------------------------------------------------------------------------
  // Additional helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns connection metadata and the current number of cached entries.
   */
  async getStats(): Promise<{
    keyPrefix: string;
    size: number;
  }> {
    return {
      keyPrefix: this.keyPrefix,
      size: await this.size(),
    };
  }
}
