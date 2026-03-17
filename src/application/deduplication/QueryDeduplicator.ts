/**
 * In-flight query deduplication
 * @module application/deduplication/QueryDeduplicator
 */

export interface DeduplicatorOptions {
  /** Window in ms during which identical keys share the same Promise (default: 100) */
  windowMs?: number;
  /** Set to false to disable deduplication entirely (default: true) */
  enabled?: boolean;
}

/**
 * Deduplicates in-flight RDAP queries to prevent redundant network requests.
 *
 * When multiple callers request the same resource simultaneously,
 * only one network request is made and the result is shared with all waiters.
 */
export class QueryDeduplicator {
  private readonly inflight: Map<string, Promise<unknown>>;
  private readonly windowMs: number;
  private readonly enabled: boolean;

  constructor(options?: DeduplicatorOptions) {
    this.inflight = new Map();
    this.windowMs = options?.windowMs ?? 100;
    this.enabled = options?.enabled ?? true;
  }

  /**
   * Executes `fn` with deduplication on `key`.
   *
   * If an identical key is already in-flight, returns the **exact same Promise**
   * so no additional network call is made.  Once the Promise settles (success or
   * error) it is removed from the in-flight map after `windowMs` so that the
   * next caller starts fresh.
   *
   * NOTE: This method is intentionally NOT async so that the raw Promise
   * reference is returned to every caller without wrapping.
   */
  deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const existing = this.inflight.get(key);
    if (existing !== undefined) {
      return existing as Promise<T>;
    }

    const promise: Promise<T> = fn().finally(() => {
      // Remove after the dedup window so sequential requests start fresh
      setTimeout(() => {
        if (this.inflight.get(key) === promise) {
          this.inflight.delete(key);
        }
      }, this.windowMs);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Returns the number of currently in-flight requests */
  getInflightCount(): number {
    return this.inflight.size;
  }

  /** Returns all currently in-flight keys */
  getInflightKeys(): string[] {
    return Array.from(this.inflight.keys());
  }

  /** Clears all in-flight tracking (useful for testing / cleanup) */
  clear(): void {
    this.inflight.clear();
  }

  getStats(): { enabled: boolean; inflight: number; windowMs: number } {
    return {
      enabled: this.enabled,
      inflight: this.inflight.size,
      windowMs: this.windowMs,
    };
  }
}
