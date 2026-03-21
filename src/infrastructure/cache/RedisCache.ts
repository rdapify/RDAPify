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
  /**
   * Incrementally iterate over keys (preferred over `keys()` in production).
   * Compatible with ioredis scan: `(cursor, 'MATCH', pattern, 'COUNT', count) => [nextCursor, keys]`
   */
  scan?(cursor: string, matchOption: 'MATCH', pattern: string, countOption: 'COUNT', count: number): Promise<[string, string[]]>;
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

  /**
   * Keys longer than this threshold are compressed to a fixed-length SHA-256 hex digest.
   * Set to `0` to disable compression.
   * @default 200
   */
  keyMaxLength?: number;
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
  private readonly keyMaxLength: number;

  constructor(client: RedisClientLike, options: RedisCacheOptions = {}) {
    this.client = client;
    this.keyPrefix = options.keyPrefix ?? 'rdapify:';
    this.keyMaxLength = options.keyMaxLength ?? 200;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the prefixed Redis key for a given logical cache key.
   * Long keys (> keyMaxLength) are compressed to a SHA-256 hex digest so they
   * never exceed Redis key size limits.
   */
  private prefixed(key: string): string {
    const compressed =
      this.keyMaxLength > 0 && key.length > this.keyMaxLength
        ? RedisCache.sha256Hex(key)
        : key;
    return `${this.keyPrefix}${compressed}`;
  }

  /**
   * Returns a deterministic SHA-256 hex digest of the input string.
   * Used for key compression when keys exceed `keyMaxLength`.
   */
  private static sha256Hex(input: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto');
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }

  /**
   * Returns the glob pattern used to scan all keys owned by this adapter.
   */
  private patternAll(): string {
    return `${this.keyPrefix}*`;
  }

  /**
   * Collects all keys matching `pattern` by iterating via SCAN when available,
   * falling back to the blocking `keys()` command otherwise.
   *
   * Using SCAN is preferred in production because it is non-blocking and O(1)
   * per call, whereas `keys()` is O(N) and blocks the Redis event loop for the
   * full duration of the scan.
   */
  private async scanAll(pattern: string): Promise<string[]> {
    if (typeof this.client.scan === 'function') {
      const collected: string[] = [];
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        collected.push(...keys);
      } while (cursor !== '0');

      return collected;
    }

    return this.client.keys(pattern);
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
   * Uses SCAN to incrementally find matching keys when supported by the client,
   * otherwise falls back to the `keys()` command. Only keys that match the
   * configured prefix pattern are deleted — the rest of the database is
   * left untouched.
   */
  async clear(): Promise<void> {
    const matchingKeys = await this.scanAll(this.patternAll());

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
   * Uses SCAN to incrementally count matching keys when supported by the
   * client, otherwise falls back to the `keys()` command. Only keys that
   * match the configured prefix are counted, giving an accurate per-prefix
   * result even in shared Redis instances.
   */
  async size(): Promise<number> {
    const matchingKeys = await this.scanAll(this.patternAll());
    return matchingKeys.length;
  }

  // ---------------------------------------------------------------------------
  // Pipeline helpers
  // ---------------------------------------------------------------------------

  /**
   * Batch-retrieve multiple RDAP responses in a single round-trip.
   *
   * Uses `mget` when available on the client (ioredis / node-redis v4+),
   * otherwise falls back to individual `get` calls.
   *
   * @returns Array of `RDAPResponse | null` in the same order as `keys`.
   */
  async getMany(keys: string[]): Promise<(RDAPResponse | null)[]> {
    if (keys.length === 0) return [];

    const prefixedKeys = keys.map((k) => this.prefixed(k));

    let raws: (string | null)[];

    const clientAsAny = this.client as unknown as Record<string, unknown>;
    if (typeof clientAsAny['mget'] === 'function') {
      const mget = clientAsAny['mget'] as (
        ...keys: string[]
      ) => Promise<(string | null)[]>;
      raws = await mget(...prefixedKeys);
    } else {
      raws = await Promise.all(prefixedKeys.map((k) => this.client.get(k)));
    }

    return raws.map((raw) => {
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as RDAPResponse;
      } catch {
        return null;
      }
    });
  }

  /**
   * Batch-store multiple RDAP responses.
   *
   * Each entry is stored with its own optional TTL.  Operations are executed
   * as individual `set` calls (no pipeline abstraction needed for correctness).
   */
  async setMany(
    entries: Array<{ key: string; value: RDAPResponse; ttl?: number }>
  ): Promise<void> {
    await Promise.all(entries.map((e) => this.set(e.key, e.value, e.ttl)));
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
    keyMaxLength: number;
  }> {
    return {
      keyPrefix: this.keyPrefix,
      size: await this.size(),
      keyMaxLength: this.keyMaxLength,
    };
  }
}
