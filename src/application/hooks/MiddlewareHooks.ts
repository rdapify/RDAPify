/**
 * Middleware / lifecycle hooks system for RDAP queries
 * @module application/hooks/MiddlewareHooks
 */

import type { RDAPResponse } from '../../shared/types/responses';

/**
 * Context passed to lifecycle hooks before a query executes
 */
export interface QueryContext {
  queryType: 'domain' | 'ip' | 'asn';
  query: string;
  normalized: string;
  startTime: number;
  cached?: boolean;
  serverUrl?: string;
  attempt?: number;
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

/**
 * Manages lifecycle hooks for RDAP queries.
 * Hook errors are caught and silenced so they never break the query pipeline.
 */
export class MiddlewareManager {
  private hooks: MiddlewareOptions;

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

  async runBeforeQuery(ctx: QueryContext): Promise<void> {
    await this.safeRun(this.hooks.beforeQuery, ctx);
  }

  async runAfterQuery(ctx: QueryResultContext): Promise<void> {
    await this.safeRun(this.hooks.afterQuery, ctx);
  }

  async runOnError(ctx: QueryResultContext): Promise<void> {
    await this.safeRun(this.hooks.onError, ctx);
  }

  async runOnCacheHit(ctx: QueryContext): Promise<void> {
    await this.safeRun(this.hooks.onCacheHit, ctx);
  }

  async runOnCacheMiss(ctx: QueryContext): Promise<void> {
    await this.safeRun(this.hooks.onCacheMiss, ctx);
  }

  async runOnRetry(
    ctx: QueryContext & { attempt: number; delay: number }
  ): Promise<void> {
    await this.safeRun(this.hooks.onRetry, ctx);
  }

  // ─── Management ──────────────────────────────────────────────────────────────

  /**
   * Merge additional hooks into the manager.
   * Later registrations override earlier ones for each hook name.
   */
  use(hooks: Partial<MiddlewareOptions>): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /** Remove all registered hooks */
  clear(): void {
    this.hooks = {};
  }

  /** Returns the names of hooks that currently have handlers */
  getRegisteredHooks(): string[] {
    return (Object.keys(this.hooks) as Array<keyof MiddlewareOptions>).filter(
      (k) => this.hooks[k] !== undefined
    );
  }
}
