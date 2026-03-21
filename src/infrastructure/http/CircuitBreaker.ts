/**
 * Circuit Breaker — protects downstream services from cascading failures.
 *
 * States:
 *   closed    → normal operation; failures counted within a rolling window
 *   open      → all calls rejected immediately; transitions to half-open after `halfOpenTimeout`
 *   half-open → one test request allowed; success → closed, failure → open
 *
 * @module infrastructure/http/CircuitBreaker
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /**
   * Number of consecutive failures that trip the circuit to `open`.
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Number of consecutive successes in `half-open` needed to close the circuit.
   * @default 1
   */
  successThreshold?: number;

  /**
   * Milliseconds to wait in `open` before transitioning to `half-open`.
   * @default 30_000
   */
  halfOpenTimeout?: number;

  /**
   * Rolling window in milliseconds. Failures older than this are forgotten.
   * @default 60_000
   */
  window?: number;
}

export class CircuitOpenError extends Error {
  constructor(public readonly state: CircuitState = 'open') {
    super(`Circuit is ${state} — request rejected`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Thread-safe (single-threaded JS) Circuit Breaker implementation.
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastOpenedAt?: number;
  private failureTimes: number[] = [];

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly halfOpenTimeout: number;
  private readonly window: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 1;
    this.halfOpenTimeout = options.halfOpenTimeout ?? 30_000;
    this.window = options.window ?? 60_000;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getState(): CircuitState {
    this.maybeTransitionToHalfOpen();
    return this.state;
  }

  /**
   * Wraps a function call with circuit breaker logic.
   *
   * - `closed`    → execute normally; on failure count towards trip
   * - `open`      → throw `CircuitOpenError` immediately (unless timeout elapsed)
   * - `half-open` → allow exactly one test call; success → closed, failure → open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === 'open') {
      throw new CircuitOpenError('open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /**
   * Manually record a success (e.g. from an external health-check).
   */
  recordSuccess(): void {
    this.onSuccess();
  }

  /**
   * Manually record a failure.
   */
  recordFailure(): void {
    this.onFailure();
  }

  /**
   * Forcibly close the circuit and reset all counters.
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastOpenedAt = undefined;
    this.failureTimes = [];
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'open' &&
      this.lastOpenedAt !== undefined &&
      Date.now() - this.lastOpenedAt >= this.halfOpenTimeout
    ) {
      this.state = 'half-open';
      this.successCount = 0;
      this.failureCount = 0;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        // Recovered — close the circuit
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        this.failureTimes = [];
        this.lastOpenedAt = undefined;
      }
    } else if (this.state === 'closed') {
      // A success resets the rolling failure window
      this.failureCount = 0;
      this.failureTimes = [];
    }
  }

  private onFailure(): void {
    const now = Date.now();

    if (this.state === 'half-open') {
      // Test request failed — reopen
      this.state = 'open';
      this.lastOpenedAt = now;
      this.successCount = 0;
      return;
    }

    if (this.state === 'closed') {
      this.failureTimes.push(now);
      this.pruneOldFailures();
      this.failureCount = this.failureTimes.length;

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'open';
        this.lastOpenedAt = now;
      }
    }
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.window;
    this.failureTimes = this.failureTimes.filter((t) => t > cutoff);
  }
}
