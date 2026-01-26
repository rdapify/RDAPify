/**
 * Tests for RateLimiter
 */

import { RateLimiter } from '../../src/infrastructure/http/RateLimiter';
import { RateLimitError } from '../../src/shared/errors';

describe('RateLimiter', () => {
  describe('constructor', () => {
    it('should create with default options', () => {
      const limiter = new RateLimiter();
      const stats = limiter.getStats();

      expect(stats.enabled).toBe(false);
      expect(stats.maxRequests).toBe(100);
      expect(stats.windowMs).toBe(60000);
    });

    it('should create with custom options', () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 10,
        windowMs: 5000,
      });
      const stats = limiter.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.maxRequests).toBe(10);
      expect(stats.windowMs).toBe(5000);
    });
  });

  describe('checkLimit', () => {
    it('should allow requests when disabled', async () => {
      const limiter = new RateLimiter({ enabled: false });

      await expect(limiter.checkLimit()).resolves.not.toThrow();
      await expect(limiter.checkLimit()).resolves.not.toThrow();
    });

    it('should allow requests within limit', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 3,
        windowMs: 1000,
      });

      await expect(limiter.checkLimit()).resolves.not.toThrow();
      await expect(limiter.checkLimit()).resolves.not.toThrow();
      await expect(limiter.checkLimit()).resolves.not.toThrow();
    });

    it('should throw error when limit exceeded', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 2,
        windowMs: 1000,
      });

      await limiter.checkLimit();
      await limiter.checkLimit();

      await expect(limiter.checkLimit()).rejects.toThrow(RateLimitError);
    });

    it('should track different keys separately', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 2,
        windowMs: 1000,
      });

      await limiter.checkLimit('user1');
      await limiter.checkLimit('user1');
      await limiter.checkLimit('user2');
      await limiter.checkLimit('user2');

      await expect(limiter.checkLimit('user1')).rejects.toThrow(RateLimitError);
      await expect(limiter.checkLimit('user2')).rejects.toThrow(RateLimitError);
    });

    it('should reset after window expires', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 2,
        windowMs: 100,
      });

      await limiter.checkLimit();
      await limiter.checkLimit();

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      await expect(limiter.checkLimit()).resolves.not.toThrow();
    });

    it('should include retryAfter in error', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 1,
        windowMs: 1000,
      });

      await limiter.checkLimit();

      try {
        await limiter.checkLimit();
        fail('Should have thrown RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).retryAfter).toBeGreaterThan(0);
      }
    });
  });

  describe('getUsage', () => {
    it('should return usage information', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 5,
        windowMs: 1000,
      });

      await limiter.checkLimit();
      await limiter.checkLimit();

      const usage = limiter.getUsage();

      expect(usage.current).toBe(2);
      expect(usage.limit).toBe(5);
      expect(usage.remaining).toBe(3);
      expect(usage.resetAt).toBeGreaterThan(Date.now());
    });

    it('should return default values when disabled', () => {
      const limiter = new RateLimiter({ enabled: false, maxRequests: 10 });
      const usage = limiter.getUsage();

      expect(usage.current).toBe(0);
      expect(usage.limit).toBe(10);
      expect(usage.remaining).toBe(10);
    });

    it('should track usage per key', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 5,
        windowMs: 1000,
      });

      await limiter.checkLimit('user1');
      await limiter.checkLimit('user1');
      await limiter.checkLimit('user2');

      const usage1 = limiter.getUsage('user1');
      const usage2 = limiter.getUsage('user2');

      expect(usage1.current).toBe(2);
      expect(usage2.current).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset limit for specific key', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 2,
        windowMs: 1000,
      });

      await limiter.checkLimit('user1');
      await limiter.checkLimit('user1');

      limiter.reset('user1');

      await expect(limiter.checkLimit('user1')).resolves.not.toThrow();
    });

    it('should not affect other keys', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 2,
        windowMs: 1000,
      });

      await limiter.checkLimit('user1');
      await limiter.checkLimit('user1');
      await limiter.checkLimit('user2');
      await limiter.checkLimit('user2');

      limiter.reset('user1');

      await expect(limiter.checkLimit('user1')).resolves.not.toThrow();
      await expect(limiter.checkLimit('user2')).rejects.toThrow(RateLimitError);
    });
  });

  describe('resetAll', () => {
    it('should reset all limits', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 2,
        windowMs: 1000,
      });

      await limiter.checkLimit('user1');
      await limiter.checkLimit('user1');
      await limiter.checkLimit('user2');
      await limiter.checkLimit('user2');

      limiter.resetAll();

      await expect(limiter.checkLimit('user1')).resolves.not.toThrow();
      await expect(limiter.checkLimit('user2')).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 10,
        windowMs: 5000,
      });

      await limiter.checkLimit('user1');
      await limiter.checkLimit('user1');
      await limiter.checkLimit('user2');

      const stats = limiter.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.maxRequests).toBe(10);
      expect(stats.windowMs).toBe(5000);
      expect(stats.activeKeys).toBe(2);
      expect(stats.totalRequests).toBe(3);
    });

    it('should exclude expired requests from stats', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 10,
        windowMs: 100,
      });

      await limiter.checkLimit();
      await limiter.checkLimit();

      // Wait for requests to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 10,
        windowMs: 1000,
      });

      await limiter.checkLimit();
      limiter.destroy();

      const stats = limiter.getStats();
      expect(stats.activeKeys).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it('should stop cleanup interval', () => {
      const limiter = new RateLimiter({
        enabled: true,
        maxRequests: 10,
        windowMs: 1000,
      });

      limiter.destroy();
      // Should not throw or cause issues
    });
  });
});
