/**
 * Unit tests for MiddlewareManager / lifecycle hooks
 */

import {
  MiddlewareManager,
} from '../../src/application/hooks/MiddlewareHooks';
import type {
  QueryContext,
  QueryResultContext,
  MiddlewareOptions,
} from '../../src/application/hooks/MiddlewareHooks';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeQueryCtx(overrides: Partial<QueryContext> = {}): QueryContext {
  return {
    queryType: 'domain',
    query: 'example.com',
    normalized: 'example.com',
    startTime: Date.now(),
    ...overrides,
  };
}

function makeResultCtx(overrides: Partial<QueryResultContext> = {}): QueryResultContext {
  return {
    ...makeQueryCtx(),
    duration: 42,
    fromCache: false,
    ...overrides,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('MiddlewareManager', () => {
  let manager: MiddlewareManager;

  beforeEach(() => {
    manager = new MiddlewareManager();
  });

  // ── No hooks set ────────────────────────────────────────────────────────────

  it('does not throw when no hooks are registered', async () => {
    const ctx = makeQueryCtx();
    await expect(manager.runBeforeQuery(ctx)).resolves.toBeUndefined();
    await expect(manager.runAfterQuery(makeResultCtx())).resolves.toBeUndefined();
    await expect(manager.runOnError(makeResultCtx())).resolves.toBeUndefined();
    await expect(manager.runOnCacheHit(ctx)).resolves.toBeUndefined();
    await expect(manager.runOnCacheMiss(ctx)).resolves.toBeUndefined();
    await expect(
      manager.runOnRetry({ ...ctx, attempt: 1, delay: 100 })
    ).resolves.toBeUndefined();
  });

  // ── beforeQuery → afterQuery order ─────────────────────────────────────────

  it('calls beforeQuery before afterQuery in the expected order', async () => {
    const order: string[] = [];
    const hooks: MiddlewareOptions = {
      beforeQuery: () => { order.push('before'); },
      afterQuery: () => { order.push('after'); },
    };
    manager = new MiddlewareManager(hooks);

    await manager.runBeforeQuery(makeQueryCtx());
    await manager.runAfterQuery(makeResultCtx());

    expect(order).toEqual(['before', 'after']);
  });

  // ── beforeQuery → onError order ─────────────────────────────────────────────

  it('calls onError hook when query fails, not afterQuery', async () => {
    const order: string[] = [];
    const hooks: MiddlewareOptions = {
      beforeQuery: () => { order.push('before'); },
      afterQuery: () => { order.push('after'); },
      onError: () => { order.push('error'); },
    };
    manager = new MiddlewareManager(hooks);

    await manager.runBeforeQuery(makeQueryCtx());
    await manager.runOnError(makeResultCtx({ error: new Error('network failure') }));

    expect(order).toEqual(['before', 'error']);
    expect(order).not.toContain('after');
  });

  // ── cache hit / miss hooks ───────────────────────────────────────────────────

  it('invokes onCacheHit when cache is hit', async () => {
    const spy = jest.fn();
    manager = new MiddlewareManager({ onCacheHit: spy });
    const ctx = makeQueryCtx({ cached: true });

    await manager.runOnCacheHit(ctx);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ cached: true }));
  });

  it('invokes onCacheMiss when cache is missed', async () => {
    const spy = jest.fn();
    manager = new MiddlewareManager({ onCacheMiss: spy });
    const ctx = makeQueryCtx({ cached: false });

    await manager.runOnCacheMiss(ctx);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ cached: false }));
  });

  // ── onRetry hook ─────────────────────────────────────────────────────────────

  it('invokes onRetry with attempt and delay', async () => {
    const spy = jest.fn();
    manager = new MiddlewareManager({ onRetry: spy });

    await manager.runOnRetry({ ...makeQueryCtx(), attempt: 2, delay: 500 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 2, delay: 500 })
    );
  });

  // ── use() for dynamic registration ──────────────────────────────────────────

  it('registers hooks dynamically via use()', async () => {
    const spy = jest.fn();
    manager.use({ beforeQuery: spy });

    await manager.runBeforeQuery(makeQueryCtx());

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('overrides an existing hook when use() is called with the same key', async () => {
    const first = jest.fn();
    const second = jest.fn();

    manager.use({ beforeQuery: first });
    manager.use({ beforeQuery: second });

    await manager.runBeforeQuery(makeQueryCtx());

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('accumulates different hooks via multiple use() calls', async () => {
    const beforeSpy = jest.fn();
    const afterSpy = jest.fn();

    manager.use({ beforeQuery: beforeSpy });
    manager.use({ afterQuery: afterSpy });

    await manager.runBeforeQuery(makeQueryCtx());
    await manager.runAfterQuery(makeResultCtx());

    expect(beforeSpy).toHaveBeenCalledTimes(1);
    expect(afterSpy).toHaveBeenCalledTimes(1);
  });

  // ── getRegisteredHooks ───────────────────────────────────────────────────────

  it('returns correct list of registered hook names', () => {
    manager = new MiddlewareManager({
      beforeQuery: jest.fn(),
      onError: jest.fn(),
    });

    const names = manager.getRegisteredHooks();
    expect(names).toContain('beforeQuery');
    expect(names).toContain('onError');
    expect(names).not.toContain('afterQuery');
  });

  // ── clear() ──────────────────────────────────────────────────────────────────

  it('removes all hooks after clear()', async () => {
    const spy = jest.fn();
    manager.use({ beforeQuery: spy });
    manager.clear();

    await manager.runBeforeQuery(makeQueryCtx());

    expect(spy).not.toHaveBeenCalled();
    expect(manager.getRegisteredHooks()).toHaveLength(0);
  });

  // ── Errors in hooks are silenced ─────────────────────────────────────────────

  it('does not propagate errors thrown inside a hook', async () => {
    manager = new MiddlewareManager({
      beforeQuery: () => { throw new Error('hook exploded'); },
    });

    await expect(manager.runBeforeQuery(makeQueryCtx())).resolves.toBeUndefined();
  });

  it('does not propagate rejections from async hooks', async () => {
    manager = new MiddlewareManager({
      afterQuery: async () => { throw new Error('async hook failed'); },
    });

    await expect(manager.runAfterQuery(makeResultCtx())).resolves.toBeUndefined();
  });

  // ── Context shape ─────────────────────────────────────────────────────────────

  it('passes full QueryContext to beforeQuery hook', async () => {
    const spy = jest.fn();
    manager = new MiddlewareManager({ beforeQuery: spy });

    const ctx = makeQueryCtx({ queryType: 'ip', query: '8.8.8.8', normalized: '8.8.8.8' });
    await manager.runBeforeQuery(ctx);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryType: 'ip',
        query: '8.8.8.8',
        normalized: '8.8.8.8',
      })
    );
  });

  it('passes result and duration to afterQuery hook', async () => {
    const spy = jest.fn();
    manager = new MiddlewareManager({ afterQuery: spy });

    const ctx = makeResultCtx({ duration: 99, fromCache: true });
    await manager.runAfterQuery(ctx);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 99, fromCache: true })
    );
  });

  it('passes error instance to onError hook', async () => {
    const spy = jest.fn();
    manager = new MiddlewareManager({ onError: spy });

    const err = new Error('something broke');
    await manager.runOnError(makeResultCtx({ error: err }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ error: err })
    );
  });
});
