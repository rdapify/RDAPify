/**
 * Unit tests for InMemoryCache
 */

import { InMemoryCache } from '../../src/cache/InMemoryCache';
import type { DomainResponse } from '../../src/types';

// Mock domain response
const createMockResponse = (domain: string): DomainResponse => ({
  query: domain,
  objectClass: 'domain',
  ldhName: domain,
  status: ['active'],
  nameservers: ['ns1.example.com', 'ns2.example.com'],
  entities: [],
  events: [],
  links: [],
  remarks: [],
  metadata: {
    source: 'https://rdap.example.com',
    timestamp: new Date().toISOString(),
    cached: false,
  },
});

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache(3); // Small size for testing
  });

  afterEach(() => {
    // Clean up any pending timers
    jest.clearAllTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve values', async () => {
      const response = createMockResponse('example.com');
      await cache.set('test-key', response, 3600);

      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(response);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should return null for expired entries', async () => {
      jest.useFakeTimers();
      const response = createMockResponse('example.com');
      await cache.set('test-key', response, 0.1); // 0.1 seconds

      // Advance time past expiration
      jest.advanceTimersByTime(150);

      const result = await cache.get('test-key');
      expect(result).toBeNull();
      jest.useRealTimers();
    });
  });

  describe('has', () => {
    it('should return true for existing keys', async () => {
      const response = createMockResponse('example.com');
      await cache.set('test-key', response);

      expect(await cache.has('test-key')).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      expect(await cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired keys', async () => {
      jest.useFakeTimers();
      const response = createMockResponse('example.com');
      await cache.set('test-key', response, 0.1);

      jest.advanceTimersByTime(150);

      expect(await cache.has('test-key')).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('delete', () => {
    it('should delete existing keys', async () => {
      const response = createMockResponse('example.com');
      await cache.set('test-key', response);

      await cache.delete('test-key');

      expect(await cache.has('test-key')).toBe(false);
    });

    it('should not throw for non-existent keys', async () => {
      await expect(cache.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', createMockResponse('example1.com'));
      await cache.set('key2', createMockResponse('example2.com'));

      await cache.clear();

      expect(await cache.size()).toBe(0);
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct size', async () => {
      expect(await cache.size()).toBe(0);

      await cache.set('key1', createMockResponse('example1.com'));
      expect(await cache.size()).toBe(1);

      await cache.set('key2', createMockResponse('example2.com'));
      expect(await cache.size()).toBe(2);

      await cache.delete('key1');
      expect(await cache.size()).toBe(1);
    });

    it('should not count expired entries', async () => {
      jest.useFakeTimers();
      await cache.set('key1', createMockResponse('example1.com'), 0.1);
      await cache.set('key2', createMockResponse('example2.com'), 3600);

      jest.advanceTimersByTime(150);

      expect(await cache.size()).toBe(1);
      jest.useRealTimers();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when full', async () => {
      // Fill cache to capacity (3 entries)
      await cache.set('key1', createMockResponse('example1.com'));
      await cache.set('key2', createMockResponse('example2.com'));
      await cache.set('key3', createMockResponse('example3.com'));

      // Add 4th entry, should evict key1 (least recently used)
      await cache.set('key4', createMockResponse('example4.com'));

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
    });

    it('should update access order on get', async () => {
      await cache.set('key1', createMockResponse('example1.com'));
      await cache.set('key2', createMockResponse('example2.com'));
      await cache.set('key3', createMockResponse('example3.com'));

      // Access key1 to make it most recently used
      await cache.get('key1');

      // Add 4th entry, should evict key2 (now least recently used)
      await cache.set('key4', createMockResponse('example4.com'));

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
    });

    it('should not evict when updating existing key', async () => {
      await cache.set('key1', createMockResponse('example1.com'));
      await cache.set('key2', createMockResponse('example2.com'));
      await cache.set('key3', createMockResponse('example3.com'));

      // Update key1 (should not trigger eviction)
      await cache.set('key1', createMockResponse('updated.com'));

      expect(await cache.size()).toBe(3);
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cache.set('key1', createMockResponse('example1.com'));
      await cache.set('key2', createMockResponse('example2.com'));

      const stats = await cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });
  });
});
