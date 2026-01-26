/**
 * Retry strategies for failed requests
 * @module infrastructure/http/RetryStrategy
 */

export type RetryStrategyType = 'exponential' | 'exponential-jitter' | 'linear' | 'fixed';

export interface RetryStrategyOptions {
  strategy?: RetryStrategyType;
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
  circuitBreaker?: CircuitBreakerOptions;
}

export interface CircuitBreakerOptions {
  enabled?: boolean;
  threshold?: number;
  timeout?: number;
  halfOpenRequests?: number;
}

export interface RetryContext {
  attempt: number;
  error: Error;
  statusCode?: number;
  startTime: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Advanced retry strategy with circuit breaker pattern
 */
export class RetryStrategy {
  private readonly strategy: RetryStrategyType;
  private readonly maxAttempts: number;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly factor: number;
  private readonly jitter: boolean;
  private readonly retryableErrors: Set<string>;
  private readonly retryableStatusCodes: Set<number>;
  
  // Circuit breaker state
  private readonly circuitBreakerEnabled: boolean;
  private readonly circuitBreakerThreshold: number;
  private readonly circuitBreakerTimeout: number;
  private readonly halfOpenRequests: number;
  private circuitState: CircuitState = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenAttempts: number = 0;

  constructor(options: RetryStrategyOptions = {}) {
    this.strategy = options.strategy || 'exponential-jitter';
    this.maxAttempts = options.maxAttempts || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.factor = options.factor || 2;
    this.jitter = options.jitter ?? true;

    // Default retryable errors
    this.retryableErrors = new Set(
      options.retryableErrors || [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'ENOTFOUND',
        'NetworkError',
        'TimeoutError',
      ]
    );

    // Default retryable status codes (5xx errors)
    this.retryableStatusCodes = new Set(
      options.retryableStatusCodes || [500, 502, 503, 504, 429]
    );

    // Circuit breaker configuration
    const cb = options.circuitBreaker || {};
    this.circuitBreakerEnabled = cb.enabled ?? false;
    this.circuitBreakerThreshold = cb.threshold || 5;
    this.circuitBreakerTimeout = cb.timeout || 60000;
    this.halfOpenRequests = cb.halfOpenRequests || 1;
  }

  /**
   * Determines if an error should be retried
   */
  shouldRetry(context: RetryContext): boolean {
    // Check circuit breaker state
    if (this.circuitBreakerEnabled) {
      this.updateCircuitState();

      if (this.circuitState === 'open') {
        return false;
      }

      if (this.circuitState === 'half-open') {
        if (this.halfOpenAttempts >= this.halfOpenRequests) {
          return false;
        }
        this.halfOpenAttempts++;
      }
    }

    // Check max attempts
    if (context.attempt >= this.maxAttempts) {
      return false;
    }

    // Check if error is retryable
    const errorName = context.error.name;
    const errorCode = (context.error as any).code;

    if (this.retryableErrors.has(errorName) || this.retryableErrors.has(errorCode)) {
      return true;
    }

    // Check if status code is retryable
    if (context.statusCode && this.retryableStatusCodes.has(context.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Calculates delay before next retry
   */
  getDelay(attempt: number): number {
    let delay: number;

    switch (this.strategy) {
      case 'fixed':
        delay = this.initialDelay;
        break;

      case 'linear':
        delay = this.initialDelay * attempt;
        break;

      case 'exponential':
      case 'exponential-jitter':
        delay = Math.min(
          this.initialDelay * Math.pow(this.factor, attempt - 1),
          this.maxDelay
        );
        break;

      default:
        delay = this.initialDelay;
    }

    // Add jitter to prevent thundering herd
    if (this.jitter || this.strategy === 'exponential-jitter') {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay = delay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }

    return Math.min(Math.max(delay, 0), this.maxDelay);
  }

  /**
   * Records a successful request
   */
  recordSuccess(): void {
    if (this.circuitBreakerEnabled) {
      if (this.circuitState === 'half-open') {
        // Successful request in half-open state, close the circuit
        this.circuitState = 'closed';
        this.failureCount = 0;
        this.halfOpenAttempts = 0;
      } else if (this.circuitState === 'closed') {
        // Reset failure count on success
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }
  }

  /**
   * Records a failed request
   */
  recordFailure(): void {
    if (this.circuitBreakerEnabled) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.circuitState === 'half-open') {
        // Failed in half-open state, reopen the circuit
        this.circuitState = 'open';
        this.halfOpenAttempts = 0;
      } else if (
        this.circuitState === 'closed' &&
        this.failureCount >= this.circuitBreakerThreshold
      ) {
        // Too many failures, open the circuit
        this.circuitState = 'open';
      }
    }
  }

  /**
   * Updates circuit breaker state based on time
   */
  private updateCircuitState(): void {
    if (this.circuitState === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure >= this.circuitBreakerTimeout) {
        // Timeout expired, try half-open state
        this.circuitState = 'half-open';
        this.halfOpenAttempts = 0;
      }
    }
  }

  /**
   * Gets current circuit breaker state
   */
  getCircuitState(): CircuitState {
    if (this.circuitBreakerEnabled) {
      this.updateCircuitState();
      return this.circuitState;
    }
    return 'closed';
  }

  /**
   * Gets retry statistics
   */
  getStats(): {
    circuitState: CircuitState;
    failureCount: number;
    enabled: boolean;
  } {
    return {
      circuitState: this.getCircuitState(),
      failureCount: this.failureCount,
      enabled: this.circuitBreakerEnabled,
    };
  }

  /**
   * Resets circuit breaker state
   */
  reset(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }
}
