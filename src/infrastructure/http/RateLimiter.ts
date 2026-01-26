/**
 * Rate limiter for RDAP queries
 * @module infrastructure/http/RateLimiter
 */

import { RateLimitError } from '../../shared/errors';
import type { RateLimitOptions } from '../../shared/types/options';

interface RequestRecord {
  timestamp: number;
  count: number;
}

/**
 * Token bucket rate limiter implementation
 */
export class RateLimiter {
  private readonly enabled: boolean;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly requests: Map<string, RequestRecord[]>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: RateLimitOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.requests = new Map();

    // Cleanup old records every minute
    if (this.enabled) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  /**
   * Checks if a request is allowed
   * @param key - Identifier for the rate limit (e.g., IP, user ID, or 'global')
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async checkLimit(key: string = 'global'): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    const records = this.requests.get(key) || [];

    // Remove expired records
    const validRecords = records.filter((r) => now - r.timestamp < this.windowMs);

    // Count total requests in window
    const totalRequests = validRecords.reduce((sum, r) => sum + r.count, 0);

    if (totalRequests >= this.maxRequests) {
      const oldestRecord = validRecords[0];
      const retryAfter = oldestRecord
        ? this.windowMs - (now - oldestRecord.timestamp)
        : this.windowMs;

      throw new RateLimitError(
        `Rate limit exceeded: ${totalRequests}/${this.maxRequests} requests in ${this.windowMs}ms`,
        {
          key,
          limit: this.maxRequests,
          window: this.windowMs,
          current: totalRequests,
        },
        retryAfter
      );
    }

    // Add new record
    validRecords.push({ timestamp: now, count: 1 });
    this.requests.set(key, validRecords);
  }

  /**
   * Gets current usage for a key
   */
  getUsage(key: string = 'global'): {
    current: number;
    limit: number;
    remaining: number;
    resetAt: number;
  } {
    if (!this.enabled) {
      return {
        current: 0,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        resetAt: Date.now() + this.windowMs,
      };
    }

    const now = Date.now();
    const records = this.requests.get(key) || [];
    const validRecords = records.filter((r) => now - r.timestamp < this.windowMs);
    const current = validRecords.reduce((sum, r) => sum + r.count, 0);
    const oldestRecord = validRecords[0];

    return {
      current,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - current),
      resetAt: oldestRecord ? oldestRecord.timestamp + this.windowMs : now + this.windowMs,
    };
  }

  /**
   * Resets rate limit for a key
   */
  reset(key: string = 'global'): void {
    this.requests.delete(key);
  }

  /**
   * Resets all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Cleans up expired records
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, records] of this.requests.entries()) {
      const validRecords = records.filter((r) => now - r.timestamp < this.windowMs);
      if (validRecords.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRecords);
      }
    }
  }

  /**
   * Destroys the rate limiter and cleans up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.requests.clear();
  }

  /**
   * Gets rate limiter statistics
   */
  getStats(): {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
    activeKeys: number;
    totalRequests: number;
  } {
    const now = Date.now();
    let totalRequests = 0;

    for (const records of this.requests.values()) {
      const validRecords = records.filter((r) => now - r.timestamp < this.windowMs);
      totalRequests += validRecords.reduce((sum, r) => sum + r.count, 0);
    }

    return {
      enabled: this.enabled,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      activeKeys: this.requests.size,
      totalRequests,
    };
  }
}
