/**
 * Tests for CacheManager
 */

import { CacheManager } from '../../src/infrastructure/cache/CacheManager';
import { CacheError } from '../../src/shared/errors';
import type { DomainResponse } from '../../src/shared/types';

describe('CacheManager', () => {
  let mockResponse: DomainResponse;

  beforeEach(() => {
    mockResponse = {
      query: 'example.com',
      objectClass: 'domain',
      handle: 'TEST-1',
      metadata: {
        source: 'test',
        timestamp: new Date().toISOString(),
        cached: false,
      },
    };
  });

  describe('constructor', () => {
    it('should create with default memory cache', () => {
      const cache = new CacheManager();
      expect(cache).toBeDefined();
    });

    it('should create with memory strategy', () => {
      const cache = new CacheManager({ strategy: 'memory' });
      expect(cache).toBeDefined();
    });

    it('should create with none strategy', () => {
      const cache = new CacheManager({ strategy: 'none' });
      expect(cache).toBeDefined();
    });

    it('should throw error for redis strategy', () => {
      expect(() => {
        new CacheManager({ strategy: 'redis' });
      }).toThrow(CacheError);
    });

    it('should throw error for custom strategy without implementation', () => {
      expect(() => {
        new CacheManager({ strategy: 'custom' });
      }).toThrow(CacheError);
    });

    it('should accept custom cache implementation', () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        has: jest.fn(),
        size: jest.fn(),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      expect(cache).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const cache = new CacheManager();
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return cached value', async () => {
      const cache = new CacheManager();
      await cache.set('test-key', mockResponse);
      const result = await cache.get('test-key');
      expect(result).toEqual(mockResponse);
    });

    it('should return null when cache is disabled', async () => {
      const cache = new CacheManager({ strategy: 'none' });
      await cache.set('test-key', mockResponse);
      const result = await cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      const customCache = {
        get: jest.fn().mockRejectedValue(new Error('Cache error')),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        has: jest.fn(),
        size: jest.fn(),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await cache.get('test-key');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('set', () => {
    it('should store value in cache', async () => {
      const cache = new CacheManager();
      await cache.set('test-key', mockResponse);
      const result = await cache.get('test-key');
      expect(result).toEqual(mockResponse);
    });

    it('should use custom TTL', async () => {
      const cache = new CacheManager({ ttl: 100 });
      await cache.set('test-key', mockResponse, 200);
      const result = await cache.get('test-key');
      expect(result).toEqual(mockResponse);
    });

    it('should not store when cache is disabled', async () => {
      const cache = new CacheManager({ strategy: 'none' });
      await cache.set('test-key', mockResponse);
      const result = await cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn().mockRejectedValue(new Error('Cache error')),
        delete: jest.fn(),
        clear: jest.fn(),
        has: jest.fn(),
        size: jest.fn(),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await cache.set('test-key', mockResponse);
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('should delete value from cache', async () => {
      const cache = new CacheManager();
      await cache.set('test-key', mockResponse);
      await cache.delete('test-key');
      const result = await cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle non-existent keys', async () => {
      const cache = new CacheManager();
      await cache.delete('non-existent');
      // Should not throw
    });

    it('should handle cache errors gracefully', async () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn().mockRejectedValue(new Error('Cache error')),
        clear: jest.fn(),
        has: jest.fn(),
        size: jest.fn(),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await cache.delete('test-key');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      const cache = new CacheManager();
      await cache.set('key1', mockResponse);
      await cache.set('key2', mockResponse);
      await cache.clear();
      
      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn().mockRejectedValue(new Error('Cache error')),
        has: jest.fn(),
        size: jest.fn(),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await cache.clear();
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      const cache = new CacheManager();
      await cache.set('test-key', mockResponse);
      const result = await cache.has('test-key');
      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const cache = new CacheManager();
      const result = await cache.has('non-existent');
      expect(result).toBe(false);
    });

    it('should return false when cache is disabled', async () => {
      const cache = new CacheManager({ strategy: 'none' });
      const result = await cache.has('test-key');
      expect(result).toBe(false);
    });

    it('should handle cache errors gracefully', async () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        has: jest.fn().mockRejectedValue(new Error('Cache error')),
        size: jest.fn(),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await cache.has('test-key');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('size', () => {
    it('should return cache size', async () => {
      const cache = new CacheManager();
      await cache.set('key1', mockResponse);
      await cache.set('key2', mockResponse);
      const size = await cache.size();
      expect(size).toBe(2);
    });

    it('should return 0 when cache is empty', async () => {
      const cache = new CacheManager();
      const size = await cache.size();
      expect(size).toBe(0);
    });

    it('should return 0 when cache is disabled', async () => {
      const cache = new CacheManager({ strategy: 'none' });
      const size = await cache.size();
      expect(size).toBe(0);
    });

    it('should handle cache errors gracefully', async () => {
      const customCache = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        has: jest.fn(),
        size: jest.fn().mockRejectedValue(new Error('Cache error')),
      };

      const cache = new CacheManager({
        strategy: 'custom',
        customCache,
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const size = await cache.size();
      
      expect(size).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const cache = new CacheManager({ ttl: 3600 });
      await cache.set('key1', mockResponse);
      await cache.set('key2', mockResponse);
      
      const stats = await cache.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.enabled).toBe(true);
      expect(stats.ttl).toBe(3600);
    });

    it('should return stats for disabled cache', async () => {
      const cache = new CacheManager({ strategy: 'none' });
      const stats = await cache.getStats();
      
      expect(stats.size).toBe(0);
      expect(stats.enabled).toBe(false);
    });
  });
});
