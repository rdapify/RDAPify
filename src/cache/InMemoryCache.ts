/**
 * In-memory cache implementation with LRU eviction
 * @module cache/InMemoryCache
 */

import type { RDAPResponse } from '../types';
import type { ICache } from './CacheManager';

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  value: RDAPResponse;
  expiresAt: number;
}

/**
 * In-memory cache with LRU (Least Recently Used) eviction policy
 */
export class InMemoryCache implements ICache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private accessOrder: string[]; // Track access order for LRU

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * Gets a value from cache
   */
  async get(key: string): Promise<RDAPResponse | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return null;
    }

    // Update access order (move to end = most recently used)
    this.updateAccessOrder(key);

    return entry.value;
  }

  /**
   * Sets a value in cache
   */
  async set(key: string, value: RDAPResponse, ttl: number = 3600): Promise<void> {
    // Evict if at capacity and key doesn't exist
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      await this.evictLRU();
    }

    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
    });

    this.updateAccessOrder(key);
  }

  /**
   * Deletes a value from cache
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
  }

  /**
   * Clears all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Checks if a key exists in cache (and is not expired)
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Gets the number of entries in cache
   */
  async size(): Promise<number> {
    // Clean up expired entries first
    await this.cleanupExpired();
    return this.cache.size;
  }

  /**
   * Updates access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Removes key from access order tracking
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evicts the least recently used entry
   */
  private async evictLRU(): Promise<void> {
    if (this.accessOrder.length === 0) {
      return;
    }

    // First entry is least recently used
    const lruKey = this.accessOrder[0];
    await this.delete(lruKey);
  }

  /**
   * Cleans up expired entries
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }
  }

  /**
   * Gets cache statistics
   */
  async getStats(): Promise<{
    size: number;
    maxSize: number;
    hitRate?: number;
  }> {
    await this.cleanupExpired();

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}
