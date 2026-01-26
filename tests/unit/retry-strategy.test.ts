/**
 * Tests for RetryStrategy
 */

import { RetryStrategy } from '../../src/infrastructure/http/RetryStrategy';

describe('RetryStrategy', () => {
  describe('shouldRetry', () => {
    it('should retry on retryable errors', () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
      });

      const context = {
        attempt: 1,
        error: new Error('ETIMEDOUT'),
        startTime: Date.now(),
      };

      (context.error as any).code = 'ETIMEDOUT';

      expect(strategy.shouldRetry(context)).toBe(true);
    });

    it('should not retry after max attempts', () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
      });

      const context = {
        attempt: 3,
        error: new Error('ETIMEDOUT'),
        startTime: Date.now(),
      };

      expect(strategy.shouldRetry(context)).toBe(false);
    });

    it('should retry on retryable status codes', () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
      });

      const context = {
        attempt: 1,
        error: new Error('Server Error'),
        statusCode: 503,
        startTime: Date.now(),
      };

      expect(strategy.shouldRetry(context)).toBe(true);
    });

    it('should not retry on non-retryable errors', () => {
      const strategy = new RetryStrategy({
        maxAttempts: 3,
      });

      const context = {
        attempt: 1,
        error: new Error('ValidationError'),
        startTime: Date.now(),
      };

      expect(strategy.shouldRetry(context)).toBe(false);
    });
  });

  describe('getDelay', () => {
    it('should calculate exponential delay', () => {
      const strategy = new RetryStrategy({
        strategy: 'exponential',
        initialDelay: 1000,
        factor: 2,
        jitter: false,
      });

      expect(strategy.getDelay(1)).toBe(1000);
      expect(strategy.getDelay(2)).toBe(2000);
      expect(strategy.getDelay(3)).toBe(4000);
    });

    it('should respect max delay', () => {
      const strategy = new RetryStrategy({
        strategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 5000,
        jitter: false,
      });

      expect(strategy.getDelay(10)).toBeLessThanOrEqual(5000);
    });

    it('should calculate linear delay', () => {
      const strategy = new RetryStrategy({
        strategy: 'linear',
        initialDelay: 1000,
        jitter: false,
      });

      expect(strategy.getDelay(1)).toBe(1000);
      expect(strategy.getDelay(2)).toBe(2000);
      expect(strategy.getDelay(3)).toBe(3000);
    });

    it('should calculate fixed delay', () => {
      const strategy = new RetryStrategy({
        strategy: 'fixed',
        initialDelay: 1000,
        jitter: false,
      });

      expect(strategy.getDelay(1)).toBe(1000);
      expect(strategy.getDelay(2)).toBe(1000);
      expect(strategy.getDelay(3)).toBe(1000);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', () => {
      const strategy = new RetryStrategy({
        circuitBreaker: {
          enabled: true,
          threshold: 3,
          timeout: 5000,
        },
      });

      // Record failures
      strategy.recordFailure();
      strategy.recordFailure();
      strategy.recordFailure();

      expect(strategy.getCircuitState()).toBe('open');
    });

    it('should close circuit after successful request', () => {
      const strategy = new RetryStrategy({
        circuitBreaker: {
          enabled: true,
          threshold: 3,
        },
      });

      strategy.recordFailure();
      strategy.recordSuccess();

      expect(strategy.getCircuitState()).toBe('closed');
    });

    it('should not retry when circuit is open', () => {
      const strategy = new RetryStrategy({
        maxAttempts: 5,
        circuitBreaker: {
          enabled: true,
          threshold: 2,
        },
      });

      // Open the circuit
      strategy.recordFailure();
      strategy.recordFailure();

      const context = {
        attempt: 1,
        error: new Error('ETIMEDOUT'),
        startTime: Date.now(),
      };

      (context.error as any).code = 'ETIMEDOUT';

      expect(strategy.shouldRetry(context)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return circuit breaker stats', () => {
      const strategy = new RetryStrategy({
        circuitBreaker: {
          enabled: true,
          threshold: 3,
        },
      });

      strategy.recordFailure();
      strategy.recordFailure();

      const stats = strategy.getStats();
      expect(stats.enabled).toBe(true);
      expect(stats.failureCount).toBe(2);
      expect(stats.circuitState).toBe('closed');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker state', () => {
      const strategy = new RetryStrategy({
        circuitBreaker: {
          enabled: true,
          threshold: 2,
        },
      });

      strategy.recordFailure();
      strategy.recordFailure();
      expect(strategy.getCircuitState()).toBe('open');

      strategy.reset();
      expect(strategy.getCircuitState()).toBe('closed');
      expect(strategy.getStats().failureCount).toBe(0);
    });
  });
});
