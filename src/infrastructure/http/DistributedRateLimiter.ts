/**
 * Distributed rate limiter backed by Redis
 * @module infrastructure/http/DistributedRateLimiter
 */

import { RateLimiter } from './RateLimiter';
import { RateLimitError } from '../../shared/errors';
import type { RateLimitOptions } from '../../shared/types/options';

/**
 * Minimal Redis interface required for distributed rate limiting.
 * Compatible with ioredis, node-redis v4+, and any Redis-like client.
 */
export interface RedisRateLimitClient {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<void>;
}

/**
 * Distributed rate limiter that uses Redis as a shared counter store.
 * Multiple processes/instances share the same rate limit window,
 * preventing a single client from bypassing limits via multiple nodes.
 *
 * Uses a fixed-window algorithm: each time window gets its own Redis key
 * with an automatic TTL set via PEXPIRE.
 */
export class DistributedRateLimiter extends RateLimiter {
  private readonly redis: RedisRateLimitClient;

  constructor(redis: RedisRateLimitClient, options: RateLimitOptions = {}) {
    super(options);
    this.redis = redis;
  }

  /**
   * Checks the distributed rate limit for the given key.
   * Uses Redis INCR + PEXPIRE to implement a fixed-window counter.
   *
   * @param key - Identifier for the rate limit bucket (default: 'default')
   * @throws {RateLimitError} when the limit is exceeded
   */
  override async checkLimit(key: string = 'default'): Promise<void> {
    if (!this.isEnabled()) return;

    const config = this.getConfig();
    const windowId = Math.floor(Date.now() / config.windowMs);
    const windowKey = `rdapify:rl:${key}:${windowId}`;

    const current = await this.redis.incr(windowKey);

    // Set TTL on first increment so Redis cleans up stale keys automatically
    if (current === 1) {
      await this.redis.pexpire(windowKey, config.windowMs);
    }

    if (current > config.maxRequests) {
      throw new RateLimitError(
        `Rate limit exceeded (${current}/${config.maxRequests}) for key: ${key}`,
        { key, limit: config.maxRequests, current }
      );
    }
  }
}
