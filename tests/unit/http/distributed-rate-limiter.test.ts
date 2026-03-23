/**
 * Unit tests for DistributedRateLimiter (Feature 6)
 */

import { DistributedRateLimiter } from '../../../src/infrastructure/http/DistributedRateLimiter';
import { RateLimitError } from '../../../src/shared/errors';

function makeRedisClient(counts: Map<string, number> = new Map()) {
  return {
    async incr(key: string): Promise<number> {
      const current = (counts.get(key) ?? 0) + 1;
      counts.set(key, current);
      return current;
    },
    async pexpire(_key: string, _ms: number): Promise<void> {
      // no-op in tests
    },
  };
}

describe('DistributedRateLimiter', () => {
  it('allows requests within limit', async () => {
    const redis = makeRedisClient();
    const limiter = new DistributedRateLimiter(redis, {
      enabled: true,
      maxRequests: 5,
      windowMs: 60000,
    });

    for (let i = 0; i < 5; i++) {
      await expect(limiter.checkLimit('user-1')).resolves.not.toThrow();
    }
  });

  it('throws RateLimitError when limit is exceeded', async () => {
    const redis = makeRedisClient();
    const limiter = new DistributedRateLimiter(redis, {
      enabled: true,
      maxRequests: 3,
      windowMs: 60000,
    });

    for (let i = 0; i < 3; i++) {
      await limiter.checkLimit('user-2');
    }

    await expect(limiter.checkLimit('user-2')).rejects.toThrow(RateLimitError);
  });

  it('does nothing when disabled', async () => {
    const redis = makeRedisClient();
    const limiter = new DistributedRateLimiter(redis, { enabled: false });

    // Should never throw even for very high request counts
    for (let i = 0; i < 1000; i++) {
      await expect(limiter.checkLimit('user-3')).resolves.not.toThrow();
    }
  });

  it('uses separate buckets per key', async () => {
    const redis = makeRedisClient();
    const limiter = new DistributedRateLimiter(redis, {
      enabled: true,
      maxRequests: 2,
      windowMs: 60000,
    });

    await limiter.checkLimit('user-a');
    await limiter.checkLimit('user-a');
    // user-a is exhausted but user-b should still work
    await expect(limiter.checkLimit('user-b')).resolves.not.toThrow();
  });

  it('includes error message with key when rate limited', async () => {
    const redis = makeRedisClient();
    const limiter = new DistributedRateLimiter(redis, {
      enabled: true,
      maxRequests: 1,
      windowMs: 60000,
    });

    await limiter.checkLimit('user-x');
    try {
      await limiter.checkLimit('user-x');
      fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as Error).message).toContain('user-x');
    }
  });
});
