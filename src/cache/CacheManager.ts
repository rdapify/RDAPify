/**
 * Cache manager for RDAP responses
 * @module cache/CacheManager
 */

import type { RDAPResponse } from '../types';
import { CacheError } from '../types/errors';
import type { CacheOptions } from '../types/options';

import { InMemoryCache } from './InMemoryCache';

/**
 * Cache interface that all cache implementations must follow
 */
export interface ICache {
  get(key: string): Promise<RDAPResponse | null>;
  set(key: string, value: RDAPResponse, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  size(): Promise<number>;
}

/**
 * Cache manager that handles different cache strategies
 */
export class CacheManager implements ICache {
  private cache: ICache;
  private readonly ttl: number;
  private readonly enabled: boolean;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 3600; // Default 1 hour
    this.enabled = options.strategy !== 'none';

    // Initialize cache based on strategy
    switch (options.strategy) {
      case 'memory':
      default:
        this.cache = new InMemoryCache(options.maxSize || 1000);
        break;

      case 'redis':
        throw new CacheError(
          'Redis cache not yet implemented in v0.1.0-alpha.1. Use "memory" cache type or provide a custom cache implementation. Redis support is planned for v0.2.0.'
        );

      case 'custom':
        if (!options.customCache) {
          throw new CacheError('Custom cache implementation required');
        }
        this.cache = options.customCache;
        break;

      case 'none':
        // No-op cache
        this.cache = new NoOpCache();
        break;
    }
  }

  /**
   * Gets a value from cache
   */
  async get(key: string): Promise<RDAPResponse | null> {
    if (!this.enabled) return null;

    try {
      return await this.cache.get(key);
    } catch (error) {
      // Log error but don't throw - cache failures shouldn't break the app
      console.warn('Cache get error:', error);
      return null;
    }
  }

  /**
   * Sets a value in cache
   */
  async set(key: string, value: RDAPResponse, ttl?: number): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.cache.set(key, value, ttl || this.ttl);
    } catch (error) {
      // Log error but don't throw - cache failures shouldn't break the app
      console.warn('Cache set error:', error);
    }
  }

  /**
   * Deletes a value from cache
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.cache.delete(key);
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  }

  /**
   * Clears all cache entries
   */
  async clear(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.cache.clear();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  /**
   * Checks if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      return await this.cache.has(key);
    } catch (error) {
      console.warn('Cache has error:', error);
      return false;
    }
  }

  /**
   * Gets the number of entries in cache
   */
  async size(): Promise<number> {
    if (!this.enabled) return 0;

    try {
      return await this.cache.size();
    } catch (error) {
      console.warn('Cache size error:', error);
      return 0;
    }
  }

  /**
   * Gets cache statistics
   */
  async getStats(): Promise<{
    size: number;
    enabled: boolean;
    ttl: number;
  }> {
    return {
      size: await this.size(),
      enabled: this.enabled,
      ttl: this.ttl,
    };
  }
}

/**
 * No-op cache implementation (does nothing)
 */
class NoOpCache implements ICache {
  async get(): Promise<null> {
    return null;
  }

  async set(): Promise<void> {
    // No-op
  }

  async delete(): Promise<void> {
    // No-op
  }

  async clear(): Promise<void> {
    // No-op
  }

  async has(): Promise<boolean> {
    return false;
  }

  async size(): Promise<number> {
    return 0;
  }
}
