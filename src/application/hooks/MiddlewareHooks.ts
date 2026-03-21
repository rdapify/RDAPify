/**
 * Middleware / lifecycle hooks system for RDAP queries
 * @module application/hooks/MiddlewareHooks
 */

import type { RDAPResponse } from '../../shared/types/responses';

/**
 * Context passed to lifecycle hooks before a query executes
 */
export interface QueryContext {
  queryType: 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';
  query: string;
  normalized: string;
  startTime: number;
  cached?: boolean;
  serverUrl?: string;
  attempt?: number;
  /**
   * Call inside a `beforeQuery` hook to abort the query.
   * The query pipeline will stop and the caller receives `undefined`.
   */
  abort?: () => void;
}

/**
 * Context passed to lifecycle hooks after a query completes (success or failure)
 */
export interface QueryResultContext extends QueryContext {
  duration: number;
  result?: RDAPResponse;
  error?: Error;
  fromCache: boolean;
}

/**
 * Generic hook function type
 */
export interface HookFn<T = void> {
  (context: T): Promise<void> | void;
}

/**
 * Available lifecycle hooks
 */
export interface MiddlewareOptions {
  /** Called before each query, before cache lookup */
  beforeQuery?: HookFn<QueryContext>;
  /** Called after a successful query (network or cache) */
  afterQuery?: HookFn<QueryResultContext>;
  /** Called when a query throws an error */
  onError?: HookFn<QueryResultContext>;
  /** Called when the result is served from cache */
  onCacheHit?: HookFn<QueryContext>;
  /** Called when there is no cache entry for the query */
  onCacheMiss?: HookFn<QueryContext>;
  /** Called each time a retry is about to be attempted */
  onRetry?: HookFn<QueryContext & { attempt: number; delay: number }>;
}

/** Internal entry for priority-ordered hooks. */
interface PriorityEntry {
  priority: number;
  hooks: Partial<MiddlewareOptions>;
}

/**
 * Manages lifecycle hooks for RDAP queries.
 * Hook errors are caught and silenced so they never break the query pipeline.
 *
 * Priority ordering:
 *   Pass a numeric `priority` to `use()` to register an additional handler
 *   at a specific priority level (lower number = higher priority = runs first).
 *   Handlers registered without a priority share a single default slot and
 *   follow the existing merge-and-override behaviour.
 */
export class MiddlewareManager {
  private hooks: MiddlewareOptions;
  private priorityEntries: PriorityEntry[] = [];

  constructor(hooks?: MiddlewareOptions) {
    this.hooks = hooks ?? {};
  }

  // ─── Internal helper ────────────────────────────────────────────────────────

  private async safeRun<T>(
    fn: HookFn<T> | undefined,
    ctx: T
  ): Promise<void> {
    if (!fn) return;
    try {
      await fn(ctx);
    } catch {
      // Hooks must never break the query pipeline
    }
  }

  // ─── Public hook runners ─────────────────────────────────────────────────────

  /**
   * Runs all registered `beforeQuery` handlers, in priority order first, then
   * the default hook.  If any handler calls `ctx.abort()` this method returns
   * `true` immediately (remaining handlers are skipped).
   *
   * @returns `true` when a hook has requested abort, `false` otherwise.
   */
  async runBeforeQuery(ctx: QueryContext): Promise<boolean> {
    let aborted = false;
    const enrichedCtx: QueryContext = {
      ...ctx,
      abort: () => {
        aborted = true;
      },
    };

    // Priority hooks — lower priority number runs first
    for (const entry of this.priorityEntries) {
      if (entry.hooks.beforeQuery) {
        await this.safeRun(entry.hooks.beforeQuery, enrichedCtx);
        if (aborted) return true;
      }
    }

    // Default hook
    await this.safeRun(this.hooks.beforeQuery, enrichedCtx);
    return aborted;
  }

  async runAfterQuery(ctx: QueryResultContext): Promise<void> {
    for (const entry of this.priorityEntries) {
      await this.safeRun(entry.hooks.afterQuery, ctx);
    }
    await this.safeRun(this.hooks.afterQuery, ctx);
  }

  async runOnError(ctx: QueryResultContext): Promise<void> {
    for (const entry of this.priorityEntries) {
      await this.safeRun(entry.hooks.onError, ctx);
    }
    await this.safeRun(this.hooks.onError, ctx);
  }

  async runOnCacheHit(ctx: QueryContext): Promise<void> {
    for (const entry of this.priorityEntries) {
      await this.safeRun(entry.hooks.onCacheHit, ctx);
    }
    await this.safeRun(this.hooks.onCacheHit, ctx);
  }

  async runOnCacheMiss(ctx: QueryContext): Promise<void> {
    for (const entry of this.priorityEntries) {
      await this.safeRun(entry.hooks.onCacheMiss, ctx);
    }
    await this.safeRun(this.hooks.onCacheMiss, ctx);
  }

  async runOnRetry(
    ctx: QueryContext & { attempt: number; delay: number }
  ): Promise<void> {
    for (const entry of this.priorityEntries) {
      await this.safeRun(entry.hooks.onRetry, ctx);
    }
    await this.safeRun(this.hooks.onRetry, ctx);
  }

  // ─── Management ──────────────────────────────────────────────────────────────

  /**
   * Register hooks.
   *
   * - Without `priority`: merges into the default slot; later calls with the
   *   same hook name override earlier ones (existing behaviour).
   * - With `priority`: adds a separate handler at the given priority level.
   *   Lower numbers run first.  Multiple handlers at the same priority level
   *   run in registration order.
   */
  use(hooks: Partial<MiddlewareOptions>, priority?: number): void {
    if (priority !== undefined) {
      this.priorityEntries.push({ priority, hooks });
      this.priorityEntries.sort((a, b) => a.priority - b.priority);
    } else {
      this.hooks = { ...this.hooks, ...hooks };
    }
  }

  /** Remove all registered hooks (default and priority) */
  clear(): void {
    this.hooks = {};
    this.priorityEntries = [];
  }

  /** Returns the names of hooks that currently have handlers (default slot only) */
  getRegisteredHooks(): string[] {
    return (Object.keys(this.hooks) as Array<keyof MiddlewareOptions>).filter(
      (k) => this.hooks[k] !== undefined
    );
  }
}
