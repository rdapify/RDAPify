/**
 * Tests for MiddlewareManager — ctx.abort() and priority ordering
 */

import {
  MiddlewareManager,
} from '../../src/application/hooks/MiddlewareHooks';
import type {
  QueryContext,
  QueryResultContext,
} from '../../src/application/hooks/MiddlewareHooks';

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
  return { ...makeQueryCtx(), duration: 10, fromCache: false, ...overrides };
}

// ── ctx.abort() ───────────────────────────────────────────────────────────────

describe('MiddlewareManager — ctx.abort()', () => {
  it('runBeforeQuery returns false when abort is not called', async () => {
    const manager = new MiddlewareManager({ beforeQuery: jest.fn() });
    const aborted = await manager.runBeforeQuery(makeQueryCtx());
    expect(aborted).toBe(false);
  });

  it('runBeforeQuery returns true when ctx.abort() is called', async () => {
    const manager = new MiddlewareManager({
      beforeQuery: (ctx) => {
        ctx.abort?.();
      },
    });
    const aborted = await manager.runBeforeQuery(makeQueryCtx());
    expect(aborted).toBe(true);
  });

  it('returns false when no hooks are registered', async () => {
    const manager = new MiddlewareManager();
    const aborted = await manager.runBeforeQuery(makeQueryCtx());
    expect(aborted).toBe(false);
  });

  it('abort() in priority hook also returns true', async () => {
    const manager = new MiddlewareManager();
    manager.use(
      {
        beforeQuery: (ctx) => {
          ctx.abort?.();
        },
      },
      1,
    );
    const aborted = await manager.runBeforeQuery(makeQueryCtx());
    expect(aborted).toBe(true);
  });

  it('subsequent hooks are skipped after abort()', async () => {
    const order: string[] = [];
    const manager = new MiddlewareManager();

    manager.use(
      {
        beforeQuery: (ctx) => {
          order.push('first');
          ctx.abort?.();
        },
      },
      1,
    );
    manager.use(
      {
        beforeQuery: () => {
          order.push('second');
        },
      },
      2,
    );

    await manager.runBeforeQuery(makeQueryCtx());
    expect(order).toEqual(['first']);
    expect(order).not.toContain('second');
  });

  it('abort() in default hook (no priority) is also detected', async () => {
    const secondSpy = jest.fn();
    const manager = new MiddlewareManager({
      beforeQuery: (ctx) => {
        ctx.abort?.();
      },
    });
    // Priority hook runs before default hook — abort is not set yet at that point
    manager.use({ beforeQuery: secondSpy }, 1);

    // Priority hook runs first (no abort), then default hook aborts
    const aborted = await manager.runBeforeQuery(makeQueryCtx());
    expect(aborted).toBe(true);
    expect(secondSpy).toHaveBeenCalledTimes(1); // priority hook still ran
  });
});

// ── Priority ordering ─────────────────────────────────────────────────────────

describe('MiddlewareManager — priority ordering', () => {
  it('lower priority number runs first', async () => {
    const order: number[] = [];
    const manager = new MiddlewareManager();

    manager.use({ beforeQuery: () => { order.push(3); } }, 3);
    manager.use({ beforeQuery: () => { order.push(1); } }, 1);
    manager.use({ beforeQuery: () => { order.push(2); } }, 2);

    await manager.runBeforeQuery(makeQueryCtx());
    expect(order).toEqual([1, 2, 3]);
  });

  it('priority hooks run before default hook', async () => {
    const order: string[] = [];
    const manager = new MiddlewareManager({
      beforeQuery: () => { order.push('default'); },
    });
    manager.use({ beforeQuery: () => { order.push('priority-10'); } }, 10);

    await manager.runBeforeQuery(makeQueryCtx());
    expect(order).toEqual(['priority-10', 'default']);
  });

  it('use() without priority overrides same-type default hook', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const manager = new MiddlewareManager();

    manager.use({ beforeQuery: first });
    manager.use({ beforeQuery: second }); // overrides first

    await manager.runBeforeQuery(makeQueryCtx());
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('priority hooks are independent from default hooks', async () => {
    const prioritySpy = jest.fn();
    const defaultSpy = jest.fn();
    const manager = new MiddlewareManager({ beforeQuery: defaultSpy });

    manager.use({ beforeQuery: prioritySpy }, 5);
    await manager.runBeforeQuery(makeQueryCtx());

    expect(prioritySpy).toHaveBeenCalledTimes(1);
    expect(defaultSpy).toHaveBeenCalledTimes(1);
  });

  it('priority ordering also applies to afterQuery', async () => {
    const order: number[] = [];
    const manager = new MiddlewareManager();

    manager.use({ afterQuery: () => { order.push(2); } }, 2);
    manager.use({ afterQuery: () => { order.push(1); } }, 1);

    await manager.runAfterQuery(makeResultCtx());
    expect(order).toEqual([1, 2]);
  });

  it('clear() removes both default and priority hooks', async () => {
    const spy = jest.fn();
    const manager = new MiddlewareManager({ beforeQuery: spy });
    manager.use({ beforeQuery: spy }, 1);
    manager.clear();

    await manager.runBeforeQuery(makeQueryCtx());
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple priority entries at the same priority run in registration order', async () => {
    const order: string[] = [];
    const manager = new MiddlewareManager();

    manager.use({ beforeQuery: () => { order.push('a'); } }, 1);
    manager.use({ beforeQuery: () => { order.push('b'); } }, 1);

    await manager.runBeforeQuery(makeQueryCtx());
    expect(order).toEqual(['a', 'b']);
  });
});
