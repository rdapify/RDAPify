/**
 * Unit tests for RedisCache
 */

import { RedisCache } from '../../src/infrastructure/cache/RedisCache';
import type { RedisClientLike } from '../../src/infrastructure/cache/RedisCache';
import type { DomainResponse } from '../../src/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Creates a fully-featured mock Redis client */
const createMockRedisClient = (): jest.Mocked<Required<RedisClientLike>> => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
  flushDb: jest.fn(),
  dbSize: jest.fn(),
});

/** Creates a minimal mock Redis client without optional methods */
const createMinimalMockRedisClient = (): jest.Mocked<Omit<RedisClientLike, 'flushDb' | 'dbSize'>> => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  keys: jest.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedisCache', () => {
  let mockClient: jest.Mocked<Required<RedisClientLike>>;
  let cache: RedisCache;

  beforeEach(() => {
    mockClient = createMockRedisClient();
    cache = new RedisCache(mockClient, { keyPrefix: 'test:' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Constructor / key prefixing
  // -------------------------------------------------------------------------

  describe('key prefix', () => {
    it('should use the provided keyPrefix when storing values', async () => {
      const response = createMockResponse('example.com');
      mockClient.set.mockResolvedValue('OK');

      await cache.set('example.com', response, 3600);

      expect(mockClient.set).toHaveBeenCalledWith(
        'test:example.com',
        expect.any(String),
        { EX: 3600 }
      );
    });

    it('should use the default keyPrefix "rdapify:" when none is provided', async () => {
      const defaultCache = new RedisCache(mockClient);
      const response = createMockResponse('example.com');
      mockClient.set.mockResolvedValue('OK');

      await defaultCache.set('example.com', response, 60);

      expect(mockClient.set).toHaveBeenCalledWith(
        'rdapify:example.com',
        expect.any(String),
        { EX: 60 }
      );
    });

    it('should use the prefixed key when getting a value', async () => {
      const response = createMockResponse('example.com');
      mockClient.get.mockResolvedValue(JSON.stringify(response));

      await cache.get('example.com');

      expect(mockClient.get).toHaveBeenCalledWith('test:example.com');
    });

    it('should use the prefixed key when deleting a value', async () => {
      mockClient.del.mockResolvedValue(1);

      await cache.delete('example.com');

      expect(mockClient.del).toHaveBeenCalledWith('test:example.com');
    });

    it('should use the prefixed key when checking existence', async () => {
      mockClient.exists.mockResolvedValue(1);

      await cache.has('example.com');

      expect(mockClient.exists).toHaveBeenCalledWith('test:example.com');
    });
  });

  // -------------------------------------------------------------------------
  // get
  // -------------------------------------------------------------------------

  describe('get', () => {
    it('should return a deserialized RDAPResponse on cache hit', async () => {
      const response = createMockResponse('example.com');
      mockClient.get.mockResolvedValue(JSON.stringify(response));

      const result = await cache.get('example.com');

      expect(result).toEqual(response);
    });

    it('should return null on cache miss (Redis returns null)', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cache.get('missing.com');

      expect(result).toBeNull();
    });

    it('should return null when the stored value is corrupted JSON', async () => {
      mockClient.get.mockResolvedValue('NOT_VALID_JSON{{{');

      const result = await cache.get('corrupt.com');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // set
  // -------------------------------------------------------------------------

  describe('set', () => {
    it('should serialize the value as JSON before storing', async () => {
      const response = createMockResponse('example.com');
      mockClient.set.mockResolvedValue('OK');

      await cache.set('example.com', response, 3600);

      const [, storedValue] = mockClient.set.mock.calls[0]!;
      expect(JSON.parse(storedValue)).toEqual(response);
    });

    it('should pass the TTL as EX option when provided', async () => {
      mockClient.set.mockResolvedValue('OK');

      await cache.set('example.com', createMockResponse('example.com'), 120);

      expect(mockClient.set).toHaveBeenCalledWith(
        'test:example.com',
        expect.any(String),
        { EX: 120 }
      );
    });

    it('should not pass EX when TTL is undefined', async () => {
      mockClient.set.mockResolvedValue('OK');

      await cache.set('example.com', createMockResponse('example.com'));

      expect(mockClient.set).toHaveBeenCalledWith(
        'test:example.com',
        expect.any(String)
      );
      // Ensure the third argument is NOT present
      expect(mockClient.set.mock.calls[0]!.length).toBe(2);
    });

    it('should not pass EX when TTL is 0', async () => {
      mockClient.set.mockResolvedValue('OK');

      await cache.set('example.com', createMockResponse('example.com'), 0);

      expect(mockClient.set.mock.calls[0]!.length).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('should delete the key from Redis', async () => {
      mockClient.del.mockResolvedValue(1);

      await cache.delete('example.com');

      expect(mockClient.del).toHaveBeenCalledWith('test:example.com');
    });

    it('should not throw when deleting a non-existent key', async () => {
      mockClient.del.mockResolvedValue(0);

      await expect(cache.delete('non-existent.com')).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // has
  // -------------------------------------------------------------------------

  describe('has', () => {
    it('should return true when the key exists in Redis', async () => {
      mockClient.exists.mockResolvedValue(1);

      const result = await cache.has('example.com');

      expect(result).toBe(true);
    });

    it('should return false when the key does not exist', async () => {
      mockClient.exists.mockResolvedValue(0);

      const result = await cache.has('missing.com');

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // clear — with flushDb
  // -------------------------------------------------------------------------

  describe('clear (with flushDb available)', () => {
    it('should call flushDb when available', async () => {
      mockClient.flushDb.mockResolvedValue('OK');

      await cache.clear();

      expect(mockClient.flushDb).toHaveBeenCalledTimes(1);
      expect(mockClient.keys).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // clear — without flushDb (minimal client)
  // -------------------------------------------------------------------------

  describe('clear (without flushDb)', () => {
    let minimalClient: jest.Mocked<Omit<RedisClientLike, 'flushDb' | 'dbSize'>>;
    let minimalCache: RedisCache;

    beforeEach(() => {
      minimalClient = createMinimalMockRedisClient();
      minimalCache = new RedisCache(minimalClient as RedisClientLike, { keyPrefix: 'test:' });
    });

    it('should use keys() + del() to clear when flushDb is unavailable', async () => {
      minimalClient.keys.mockResolvedValue(['test:a.com', 'test:b.com']);
      minimalClient.del.mockResolvedValue(2);

      await minimalCache.clear();

      expect(minimalClient.keys).toHaveBeenCalledWith('test:*');
      expect(minimalClient.del).toHaveBeenCalledWith('test:a.com', 'test:b.com');
    });

    it('should not call del when no keys match the pattern', async () => {
      minimalClient.keys.mockResolvedValue([]);

      await minimalCache.clear();

      expect(minimalClient.del).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // size — with dbSize
  // -------------------------------------------------------------------------

  describe('size (with dbSize available)', () => {
    it('should return the value from dbSize when available', async () => {
      mockClient.dbSize.mockResolvedValue(42);

      const result = await cache.size();

      expect(result).toBe(42);
      expect(mockClient.dbSize).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // size — without dbSize (minimal client)
  // -------------------------------------------------------------------------

  describe('size (without dbSize)', () => {
    let minimalClient: jest.Mocked<Omit<RedisClientLike, 'flushDb' | 'dbSize'>>;
    let minimalCache: RedisCache;

    beforeEach(() => {
      minimalClient = createMinimalMockRedisClient();
      minimalCache = new RedisCache(minimalClient as RedisClientLike, { keyPrefix: 'test:' });
    });

    it('should count matching keys via keys() when dbSize is unavailable', async () => {
      minimalClient.keys.mockResolvedValue(['test:a.com', 'test:b.com', 'test:c.com']);

      const result = await minimalCache.size();

      expect(result).toBe(3);
      expect(minimalClient.keys).toHaveBeenCalledWith('test:*');
    });

    it('should return 0 when no matching keys exist', async () => {
      minimalClient.keys.mockResolvedValue([]);

      const result = await minimalCache.size();

      expect(result).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  describe('getStats', () => {
    it('should return keyPrefix and size', async () => {
      mockClient.dbSize.mockResolvedValue(5);

      const stats = await cache.getStats();

      expect(stats.keyPrefix).toBe('test:');
      expect(stats.size).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // JSON serialization round-trip
  // -------------------------------------------------------------------------

  describe('JSON serialization', () => {
    it('should faithfully round-trip nested objects', async () => {
      const response = createMockResponse('complex.com');
      // Simulate set then get
      let stored = '';
      mockClient.set.mockImplementation(async (_key, value) => {
        stored = value;
        return 'OK';
      });
      mockClient.get.mockImplementation(async () => stored);

      await cache.set('complex.com', response, 60);
      const retrieved = await cache.get('complex.com');

      expect(retrieved).toEqual(response);
    });
  });
});
