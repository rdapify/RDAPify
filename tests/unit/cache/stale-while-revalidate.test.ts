/**
 * Unit tests for Stale-While-Revalidate cache strategy (Feature 3)
 */

import { StaleWhileRevalidateCache } from '../../../src/infrastructure/cache/StaleWhileRevalidateCache';
import type { DomainResponse } from '../../../src/shared/types';

function makeDomainResponse(query: string): DomainResponse {
  return {
    query,
    objectClass: 'domain',
    metadata: { source: 'https://test.example.com', timestamp: new Date().toISOString(), cached: false },
  };
}

describe('StaleWhileRevalidateCache', () => {
  it('returns cached value when not expired', async () => {
    const cache = new StaleWhileRevalidateCache();
    const value = makeDomainResponse('example.com');
    await cache.set('key1', value, 3600);
    const result = await cache.get('key1');
    expect(result).toEqual(value);
  });

  it('returns stale value when expired and calls revalidateCallback', async () => {
    const revalidateCallback = jest.fn();
    const cache = new StaleWhileRevalidateCache(1000, revalidateCallback);

    const value = makeDomainResponse('stale.com');
    // Set with 0 TTL so it's immediately expired
    await cache.set('stale-key', value, 0);

    // Advance time beyond TTL
    jest.useFakeTimers();
    jest.advanceTimersByTime(100);

    const result = await cache.get('stale-key');
    expect(result).toEqual(value);

    // Allow microtasks to run (Promise.resolve().then())
    await Promise.resolve();

    expect(revalidateCallback).toHaveBeenCalledWith('stale-key', value);

    jest.useRealTimers();
  });

  it('returns null for missing keys', async () => {
    const cache = new StaleWhileRevalidateCache();
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('deletes entries', async () => {
    const cache = new StaleWhileRevalidateCache();
    const value = makeDomainResponse('delete.com');
    await cache.set('del-key', value, 3600);
    await cache.delete('del-key');
    const result = await cache.get('del-key');
    expect(result).toBeNull();
  });

  it('clears all entries', async () => {
    const cache = new StaleWhileRevalidateCache();
    await cache.set('k1', makeDomainResponse('a.com'), 3600);
    await cache.set('k2', makeDomainResponse('b.com'), 3600);
    await cache.clear();
    expect(await cache.size()).toBe(0);
  });

  it('does not call revalidateCallback when not expired', async () => {
    const revalidateCallback = jest.fn();
    const cache = new StaleWhileRevalidateCache(1000, revalidateCallback);
    const value = makeDomainResponse('fresh.com');
    await cache.set('fresh-key', value, 3600);

    await cache.get('fresh-key');
    await Promise.resolve();

    expect(revalidateCallback).not.toHaveBeenCalled();
  });
});
