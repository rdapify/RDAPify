/**
 * Persistent cache implementation
 * @module infrastructure/cache/PersistentCache
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PersistentCacheOptions {
  storage?: 'file' | 'memory';
  path?: string;
  ttl?: number;
  maxSize?: number;
  autoSave?: boolean;
  saveInterval?: number;
}

interface CacheEntry {
  value: any;
  expires: number;
  created: number;
  accessed: number;
  hits: number;
}

/**
 * Persistent cache that survives application restarts
 */
export class PersistentCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly storage: 'file' | 'memory';
  private readonly filePath?: string;
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly autoSave: boolean;
  private saveTimer?: NodeJS.Timeout;
  private dirty: boolean = false;

  constructor(options: PersistentCacheOptions = {}) {
    this.storage = options.storage || 'memory';
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.maxSize = options.maxSize || 1000;
    this.autoSave = options.autoSave ?? true;

    if (this.storage === 'file') {
      this.filePath = options.path || path.join(process.cwd(), '.cache', 'rdap-cache.json');
      this.ensureCacheDirectory();
      this.load();

      // Auto-save interval
      if (this.autoSave) {
        const interval = options.saveInterval || 60000; // 1 minute default
        this.saveTimer = setInterval(() => {
          if (this.dirty) {
            this.save();
          }
        }, interval);
      }
    }
  }

  /**
   * Gets a value from cache
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.dirty = true;
      return null;
    }

    // Update access stats
    entry.accessed = Date.now();
    entry.hits++;
    this.dirty = true;

    return entry.value;
  }

  /**
   * Sets a value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const effectiveTtl = ttl || this.ttl;
    const now = Date.now();

    const entry: CacheEntry = {
      value,
      expires: now + effectiveTtl,
      created: now,
      accessed: now,
      hits: 0,
    };

    this.cache.set(key, entry);
    this.dirty = true;

    // Enforce max size
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }

    // Auto-save if file storage
    if (this.storage === 'file' && !this.autoSave) {
      await this.save();
    }
  }

  /**
   * Deletes a value from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.dirty = true;
    }
    return deleted;
  }

  /**
   * Checks if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.dirty = true;
      return false;
    }

    return true;
  }

  /**
   * Clears all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.dirty = true;

    if (this.storage === 'file') {
      await this.save();
    }
  }

  /**
   * Gets cache statistics
   */
  async getStats(): Promise<{
    size: number;
    maxSize: number;
    storage: string;
    hits: number;
    oldestEntry?: number;
    newestEntry?: number;
  }> {
    let totalHits = 0;
    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;

      if (!oldestEntry || entry.created < oldestEntry) {
        oldestEntry = entry.created;
      }

      if (!newestEntry || entry.created > newestEntry) {
        newestEntry = entry.created;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      storage: this.storage,
      hits: totalHits,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Evicts least recently used entries
   */
  private evictLRU(): void {
    // Find least recently accessed entry
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < lruTime) {
        lruTime = entry.accessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Ensures cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!this.filePath) return;

    const dir = path.dirname(this.filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Loads cache from file
   */
  private load(): void {
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const entries = JSON.parse(data);

      const now = Date.now();

      // Load non-expired entries
      for (const [key, entry] of Object.entries(entries)) {
        const cacheEntry = entry as CacheEntry;
        
        if (cacheEntry.expires > now) {
          this.cache.set(key, cacheEntry);
        }
      }

      this.dirty = false;
    } catch (error) {
      // Ignore errors, start with empty cache
      console.warn('Failed to load cache:', error);
    }
  }

  /**
   * Saves cache to file
   */
  private async save(): Promise<void> {
    if (!this.filePath) return;

    try {
      const entries: Record<string, CacheEntry> = {};

      for (const [key, entry] of this.cache.entries()) {
        entries[key] = entry;
      }

      const data = JSON.stringify(entries, null, 2);
      fs.writeFileSync(this.filePath, data, 'utf-8');
      this.dirty = false;
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  /**
   * Cleans up expired entries
   */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.dirty = true;
    }

    return removed;
  }

  /**
   * Destroys the cache and cleans up resources
   */
  destroy(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }

    if (this.storage === 'file' && this.dirty) {
      this.save();
    }

    this.cache.clear();
  }
}
