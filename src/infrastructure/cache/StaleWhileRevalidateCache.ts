/**
 * Stale-While-Revalidate cache strategy
 * Returns cached value immediately (even if stale) and triggers background refresh.
 * @module cache/StaleWhileRevalidateCache
 */

import type { RDAPResponse } from '../../shared/types';
import type { ICache } from './CacheManager';

interface SWREntry {
  value: RDAPResponse;
  expiresAt: number;
}

/**
 * Cache that serves stale data while revalidating in the background.
 * Eliminates cache-miss latency at the cost of occasionally serving
 * slightly outdated data for one request cycle after TTL expiry.
 */
export class StaleWhileRevalidateCache implements ICache {
  private readonly entries: Map<string, SWREntry>;
  private readonly maxSize: number;
  private readonly revalidateCallback?: (key: string, freshValue: RDAPResponse) => void;

  constructor(
    maxSize: number = 1000,
    revalidateCallback?: (key: string, freshValue: RDAPResponse) => void
  ) {
    this.entries = new Map();
    this.maxSize = maxSize;
    this.revalidateCallback = revalidateCallback;
  }

  /**
   * Returns the cached value immediately — even if expired — then fires
   * background revalidation so the next caller gets a fresh value.
   */
  async get(key: string): Promise<RDAPResponse | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;

    const isExpired = Date.now() > entry.expiresAt;
    if (isExpired && this.revalidateCallback) {
      // Fire-and-forget: never blocks the caller
      Promise.resolve().then(() => {
        this.revalidateCallback!(key, entry.value);
      }).catch(() => { /* ignore errors from revalidation callback */ });
    }

    return entry.value;
  }

  async set(key: string, value: RDAPResponse, ttl: number = 3600): Promise<void> {
    if (this.entries.size >= this.maxSize && !this.entries.has(key)) {
      this.evictOldest();
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async has(key: string): Promise<boolean> {
    return this.entries.has(key);
  }

  async size(): Promise<number> {
    return this.entries.size;
  }

  private evictOldest(): void {
    const firstKey = this.entries.keys().next().value;
    if (firstKey !== undefined) {
      this.entries.delete(firstKey);
    }
  }
}
