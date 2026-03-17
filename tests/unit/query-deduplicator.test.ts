/**
 * Unit tests for QueryDeduplicator
 */

import { QueryDeduplicator } from '../../src/application/deduplication/QueryDeduplicator';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns a promise that resolves to `value` after `ms` milliseconds */
function delayed<T>(value: T, ms = 10): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('QueryDeduplicator', () => {
  let dedup: QueryDeduplicator;

  beforeEach(() => {
    // Use a large window so we control cleanup timing in tests
    dedup = new QueryDeduplicator({ windowMs: 10_000 });
  });

  afterEach(() => {
    dedup.clear();
  });

  // ── Simultaneous requests share the same Promise ─────────────────────────────

  it('returns the same Promise for concurrent requests with the same key', () => {
    let callCount = 0;
    const fn = () => {
      callCount++;
      return delayed('result', 20);
    };

    const p1 = dedup.deduplicate('key1', fn);
    const p2 = dedup.deduplicate('key1', fn);

    // Must be the exact same Promise reference
    expect(p1).toBe(p2);
    expect(callCount).toBe(1);
  });

  it('both concurrent waiters receive the resolved value', async () => {
    const fn = () => delayed('hello', 10);

    const [r1, r2] = await Promise.all([
      dedup.deduplicate('k', fn),
      dedup.deduplicate('k', fn),
    ]);

    expect(r1).toBe('hello');
    expect(r2).toBe('hello');
  });

  // ── Sequential requests make separate calls ──────────────────────────────────

  it('makes a fresh call for sequential requests after window expires', async () => {
    dedup = new QueryDeduplicator({ windowMs: 0 });

    let callCount = 0;
    const fn = () => {
      callCount++;
      return Promise.resolve('data');
    };

    await dedup.deduplicate('key', fn);
    // Wait long enough for the 0 ms window to expire
    await new Promise((r) => setTimeout(r, 20));
    await dedup.deduplicate('key', fn);

    expect(callCount).toBe(2);
  });

  // ── Error is propagated to all waiters ───────────────────────────────────────

  it('propagates rejection to all concurrent waiters', async () => {
    const boom = new Error('network error');
    const fn = (): Promise<string> =>
      new Promise((_, reject) => setTimeout(() => reject(boom), 10));

    const p1 = dedup.deduplicate('err-key', fn);
    const p2 = dedup.deduplicate('err-key', fn);

    expect(p1).toBe(p2);

    await expect(p1).rejects.toThrow('network error');
    await expect(p2).rejects.toThrow('network error');
  });

  it('makes only one underlying call when two concurrent requests fail', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      throw new Error('oops');
    };

    const p1 = dedup.deduplicate('fail-key', fn);
    const p2 = dedup.deduplicate('fail-key', fn);

    await Promise.allSettled([p1, p2]);
    expect(callCount).toBe(1);
  });

  // ── getInflightCount ─────────────────────────────────────────────────────────

  it('reports in-flight count correctly while request is pending', () => {
    const fn = () => delayed('x', 50);

    expect(dedup.getInflightCount()).toBe(0);

    dedup.deduplicate('a', fn);
    dedup.deduplicate('b', fn);

    expect(dedup.getInflightCount()).toBe(2);
  });

  it('reports 0 in-flight after all requests settle', async () => {
    dedup = new QueryDeduplicator({ windowMs: 0 });
    const fn = () => Promise.resolve('done');

    await dedup.deduplicate('x', fn);
    // Wait for the cleanup timer
    await new Promise((r) => setTimeout(r, 20));

    expect(dedup.getInflightCount()).toBe(0);
  });

  // ── getInflightKeys ──────────────────────────────────────────────────────────

  it('returns all in-flight keys', () => {
    const fn = () => delayed('v', 100);

    dedup.deduplicate('alpha', fn);
    dedup.deduplicate('beta', fn);

    const keys = dedup.getInflightKeys();
    expect(keys).toContain('alpha');
    expect(keys).toContain('beta');
    expect(keys).toHaveLength(2);
  });

  // ── clear() ──────────────────────────────────────────────────────────────────

  it('clears in-flight tracking immediately', () => {
    const fn = () => delayed('z', 200);

    dedup.deduplicate('k1', fn);
    dedup.deduplicate('k2', fn);

    expect(dedup.getInflightCount()).toBe(2);
    dedup.clear();
    expect(dedup.getInflightCount()).toBe(0);
    expect(dedup.getInflightKeys()).toHaveLength(0);
  });

  it('allows new deduplication after clear()', () => {
    let callCount = 0;
    const fn = () => {
      callCount++;
      return delayed('val', 100);
    };

    dedup.deduplicate('key', fn);
    dedup.clear();
    dedup.deduplicate('key', fn);

    // After clear a new entry is created — fn should have been called twice
    expect(callCount).toBe(2);
  });

  // ── Disabled deduplication ───────────────────────────────────────────────────

  it('calls fn independently for each caller when disabled', async () => {
    dedup = new QueryDeduplicator({ enabled: false });

    let callCount = 0;
    const fn = () => {
      callCount++;
      return Promise.resolve('ok');
    };

    const p1 = dedup.deduplicate('k', fn);
    const p2 = dedup.deduplicate('k', fn);

    // Different Promise references when disabled
    expect(p1).not.toBe(p2);

    await Promise.all([p1, p2]);
    expect(callCount).toBe(2);
  });

  it('reports enabled: false in stats when disabled', () => {
    dedup = new QueryDeduplicator({ enabled: false });
    expect(dedup.getStats().enabled).toBe(false);
  });

  // ── getStats ─────────────────────────────────────────────────────────────────

  it('getStats returns correct shape', () => {
    dedup = new QueryDeduplicator({ enabled: true, windowMs: 250 });
    const stats = dedup.getStats();

    expect(stats).toEqual({
      enabled: true,
      inflight: 0,
      windowMs: 250,
    });
  });

  it('getStats reflects current in-flight count', () => {
    const fn = () => delayed('v', 200);
    dedup.deduplicate('x', fn);

    expect(dedup.getStats().inflight).toBe(1);
  });
});
