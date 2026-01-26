/**
 * Tests for PersistentCache
 */

import { PersistentCache } from '../../src/infrastructure/cache/PersistentCache';
import * as fs from 'fs';
import * as path from 'path';

describe('PersistentCache', () => {
  const testCachePath = path.join(__dirname, '..', '..', '.test-cache', 'test-cache.json');
  
  afterEach(() => {
    // Clean up test cache file
    try {
      if (fs.existsSync(testCachePath)) {
        fs.unlinkSync(testCachePath);
      }
      const dir = path.dirname(testCachePath);
      if (fs.existsSync(dir)) {
        fs.rmdirSync(dir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('memory storage', () => {
    let cache: PersistentCache;

    beforeEach(() => {
      cache = new PersistentCache({
        storage: 'memory',
        ttl: 1000,
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should set and get values', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      
      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should clear all values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should expire values after TTL', async () => {
      await cache.set('key1', 'value1', 100);
      
      // Should exist immediately
      expect(await cache.get('key1')).toBe('value1');
      
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Should be expired
      expect(await cache.get('key1')).toBeNull();
    });

    it('should return cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      const stats = await cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.storage).toBe('memory');
    });

    it('should cleanup expired entries', async () => {
      await cache.set('key1', 'value1', 100);
      await cache.set('key2', 'value2', 10000);
      
      // Wait for first key to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      const removed = await cache.cleanup();
      expect(removed).toBe(1);
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBe('value2');
    });

    it('should enforce max size', async () => {
      const smallCache = new PersistentCache({
        storage: 'memory',
        maxSize: 3,
      });

      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');
      await smallCache.set('key4', 'value4');

      const stats = await smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(3);

      smallCache.destroy();
    });
  });

  describe('file storage', () => {
    let cache: PersistentCache;

    beforeEach(() => {
      cache = new PersistentCache({
        storage: 'file',
        path: testCachePath,
        ttl: 10000,
        autoSave: false,
      });
    });

    afterEach(() => {
      cache.destroy();
    });

    it('should persist values to file', async () => {
      await cache.set('key1', 'value1');
      
      // Create new cache instance
      cache.destroy();
      const newCache = new PersistentCache({
        storage: 'file',
        path: testCachePath,
        autoSave: false,
      });

      const value = await newCache.get('key1');
      expect(value).toBe('value1');

      newCache.destroy();
    });

    it('should not load expired entries', async () => {
      await cache.set('key1', 'value1', 100);
      
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Create new cache instance
      cache.destroy();
      const newCache = new PersistentCache({
        storage: 'file',
        path: testCachePath,
        autoSave: false,
      });

      const value = await newCache.get('key1');
      expect(value).toBeNull();

      newCache.destroy();
    });
  });
});
