/**
 * Tests for RedisCache key compression and pipeline (getMany/setMany)
 */

import { RedisCache } from '../../src/infrastructure/cache/RedisCache';
import type { RedisClientLike } from '../../src/infrastructure/cache/RedisCache';
import type { DomainResponse } from '../../src/shared/types';

const makeResponse = (domain: string): DomainResponse => ({
  query: domain,
  objectClass: 'domain',
  ldhName: domain,
  status: ['active'],
  nameservers: [],
  entities: [],
  events: [],
  links: [],
  remarks: [],
  metadata: { source: 'https://example.com', timestamp: new Date().toISOString(), cached: false },
});

function createMockClient(): jest.Mocked<RedisClientLike> & { mget: jest.Mock } {
  return {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    mget: jest.fn(),
  };
}

// ── Key compression ───────────────────────────────────────────────────────────

describe('RedisCache — key compression', () => {
  it('uses raw key when key is within keyMaxLength', async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(null);
    const cache = new RedisCache(client, { keyPrefix: 'test:', keyMaxLength: 200 });

    const shortKey = 'example.com';
    await cache.get(shortKey);

    expect(client.get).toHaveBeenCalledWith(`test:${shortKey}`);
  });

  it('compresses key with SHA-256 when key exceeds keyMaxLength', async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(null);
    const cache = new RedisCache(client, { keyPrefix: 'test:', keyMaxLength: 10 });

    const longKey = 'a'.repeat(100);
    await cache.get(longKey);

    const [calledKey] = client.get.mock.calls[0] as [string];
    // Should NOT contain the raw long key
    expect(calledKey).not.toContain(longKey);
    // Should start with the prefix
    expect(calledKey.startsWith('test:')).toBe(true);
    // SHA-256 hex is 64 chars + prefix
    const keyPart = calledKey.slice('test:'.length);
    expect(keyPart).toHaveLength(64);
  });

  it('compresses key deterministically (same key → same hash)', async () => {
    const client1 = createMockClient();
    const client2 = createMockClient();
    client1.get.mockResolvedValue(null);
    client2.get.mockResolvedValue(null);

    const cache1 = new RedisCache(client1, { keyPrefix: 'p:', keyMaxLength: 5 });
    const cache2 = new RedisCache(client2, { keyPrefix: 'p:', keyMaxLength: 5 });

    const longKey = 'long-key-that-exceeds-limit';
    await cache1.get(longKey);
    await cache2.get(longKey);

    expect(client1.get.mock.calls[0]![0]).toEqual(client2.get.mock.calls[0]![0]);
  });

  it('two different long keys produce different compressed keys', async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(null);
    const cache = new RedisCache(client, { keyPrefix: '', keyMaxLength: 5 });

    await cache.get('key-one-that-is-long');
    await cache.get('key-two-that-is-long');

    const key1 = client.get.mock.calls[0]![0] as string;
    const key2 = client.get.mock.calls[1]![0] as string;
    expect(key1).not.toBe(key2);
  });

  it('keyMaxLength: 0 disables compression', async () => {
    const client = createMockClient();
    client.get.mockResolvedValue(null);
    const cache = new RedisCache(client, { keyPrefix: '', keyMaxLength: 0 });

    const longKey = 'x'.repeat(500);
    await cache.get(longKey);
    expect(client.get.mock.calls[0]![0]).toBe(longKey);
  });

  it('getStats includes keyMaxLength', async () => {
    const client = createMockClient();
    client.keys.mockResolvedValue([]);
    const cache = new RedisCache(client, { keyPrefix: 'test:', keyMaxLength: 150 });

    const stats = await cache.getStats();
    expect(stats.keyMaxLength).toBe(150);
  });
});

// ── Pipeline: getMany ──────────────────────────────────────────────────────────

describe('RedisCache — getMany (pipeline)', () => {
  it('returns empty array for empty keys', async () => {
    const client = createMockClient();
    const cache = new RedisCache(client);
    const result = await cache.getMany([]);
    expect(result).toEqual([]);
    expect(client.mget).not.toHaveBeenCalled();
  });

  it('uses mget when available', async () => {
    const client = createMockClient();
    const resp = makeResponse('example.com');
    client.mget.mockResolvedValue([JSON.stringify(resp), null]);
    const cache = new RedisCache(client, { keyPrefix: 'r:' });

    const results = await cache.getMany(['example.com', 'missing.com']);
    expect(client.mget).toHaveBeenCalledWith('r:example.com', 'r:missing.com');
    expect(results[0]).toEqual(resp);
    expect(results[1]).toBeNull();
  });

  it('falls back to individual get() calls when mget unavailable', async () => {
    const { mget: _, ...clientWithoutMget } = createMockClient();
    const client = clientWithoutMget as unknown as jest.Mocked<RedisClientLike>;
    const resp = makeResponse('a.com');
    client.get
      .mockResolvedValueOnce(JSON.stringify(resp))
      .mockResolvedValueOnce(null);

    const cache = new RedisCache(client, { keyPrefix: 'r:' });
    const results = await cache.getMany(['a.com', 'b.com']);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(results[0]).toEqual(resp);
    expect(results[1]).toBeNull();
  });

  it('returns null for corrupted JSON values', async () => {
    const client = createMockClient();
    client.mget.mockResolvedValue(['not-json', null]);
    const cache = new RedisCache(client);

    const results = await cache.getMany(['bad.com', 'missing.com']);
    expect(results[0]).toBeNull();
    expect(results[1]).toBeNull();
  });
});

// ── Pipeline: setMany ──────────────────────────────────────────────────────────

describe('RedisCache — setMany (pipeline)', () => {
  it('stores all entries', async () => {
    const client = createMockClient();
    const cache = new RedisCache(client, { keyPrefix: 'r:' });

    const entries = [
      { key: 'a.com', value: makeResponse('a.com') },
      { key: 'b.com', value: makeResponse('b.com'), ttl: 3600 },
    ];

    await cache.setMany(entries);
    expect(client.set).toHaveBeenCalledTimes(2);
    expect(client.set).toHaveBeenCalledWith('r:a.com', expect.any(String));
    expect(client.set).toHaveBeenCalledWith('r:b.com', expect.any(String), { EX: 3600 });
  });

  it('does nothing for empty entries', async () => {
    const client = createMockClient();
    const cache = new RedisCache(client);
    await cache.setMany([]);
    expect(client.set).not.toHaveBeenCalled();
  });

  it('stored values can be retrieved', async () => {
    const client = createMockClient();
    const resp = makeResponse('example.com');

    // Capture what was stored
    let stored: string | undefined;
    client.set.mockImplementation(async (_key: string, value: string) => {
      stored = value;
      return 'OK';
    });
    client.get.mockImplementation(async () => stored ?? null);

    const cache = new RedisCache(client, { keyPrefix: '' });
    await cache.setMany([{ key: 'example.com', value: resp }]);
    const retrieved = await cache.get('example.com');
    expect(retrieved).toEqual(resp);
  });
});
