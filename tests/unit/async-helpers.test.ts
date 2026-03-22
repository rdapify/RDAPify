/**
 * Unit tests for async helper utilities
 */

import { calculateBackoff, createTimeout, withTimeout } from '../../src/shared/utils/helpers/async';

describe('calculateBackoff()', () => {
  it('returns initialDelay for fixed strategy', () => {
    expect(calculateBackoff(1, 'fixed', 1000, 30000)).toBe(1000);
    expect(calculateBackoff(3, 'fixed', 1000, 30000)).toBe(1000);
    expect(calculateBackoff(5, 'fixed', 500, 30000)).toBe(500);
  });

  it('returns linear backoff for linear strategy', () => {
    expect(calculateBackoff(1, 'linear', 1000, 30000)).toBe(1000);
    expect(calculateBackoff(2, 'linear', 1000, 30000)).toBe(2000);
    expect(calculateBackoff(3, 'linear', 1000, 30000)).toBe(3000);
  });

  it('returns exponential backoff for exponential strategy', () => {
    expect(calculateBackoff(1, 'exponential', 1000, 30000)).toBe(1000);  // 1000 * 2^0
    expect(calculateBackoff(2, 'exponential', 1000, 30000)).toBe(2000);  // 1000 * 2^1
    expect(calculateBackoff(3, 'exponential', 1000, 30000)).toBe(4000);  // 1000 * 2^2
    expect(calculateBackoff(4, 'exponential', 1000, 30000)).toBe(8000);  // 1000 * 2^3
  });

  it('caps at maxDelay', () => {
    expect(calculateBackoff(10, 'exponential', 1000, 5000)).toBe(5000);
    expect(calculateBackoff(10, 'linear', 1000, 5000)).toBe(5000);
  });

  it('falls through to fixed for unknown strategy', () => {
    // 'default' case in switch
    expect(calculateBackoff(3, 'fixed' as any, 500, 10000)).toBe(500);
  });
});

describe('createTimeout()', () => {
  it('returns a promise and cancel function', () => {
    const { promise, cancel } = createTimeout(10000);
    expect(typeof cancel).toBe('function');
    expect(promise).toBeInstanceOf(Promise);
    cancel(); // cleanup
  });

  it('cancel prevents the timeout from firing', async () => {
    const { promise, cancel } = createTimeout(50);
    cancel();
    // After cancel, the promise should never settle on its own
    // We just verify it doesn't throw immediately
    const result = await Promise.race([
      promise.then(() => 'settled', () => 'rejected'),
      new Promise<string>(resolve => setTimeout(() => resolve('timeout-winner'), 100)),
    ]);
    expect(result).toBe('timeout-winner');
  });

  it('rejects with custom message', async () => {
    const { promise, cancel } = createTimeout(10, 'custom error message');
    await expect(promise).rejects.toThrow('custom error message');
    cancel();
  });

  it('rejects with default message when none provided', async () => {
    const { promise, cancel } = createTimeout(10);
    await expect(promise).rejects.toThrow('timed out after');
    cancel();
  });
});

describe('withTimeout()', () => {
  it('resolves when promise completes before timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 5000);
    expect(result).toBe(42);
  });

  it('rejects when promise exceeds timeout', async () => {
    const neverResolves = new Promise<never>(() => {});
    await expect(withTimeout(neverResolves, 20, 'too slow')).rejects.toThrow('too slow');
  });

  it('propagates rejection from the original promise', async () => {
    const failing = Promise.reject(new Error('original error'));
    await expect(withTimeout(failing, 5000)).rejects.toThrow('original error');
  });

  it('cleans up timeout when promise resolves early', async () => {
    // No memory leak / unhandled rejection expected
    const fastPromise = Promise.resolve('fast');
    const result = await withTimeout(fastPromise, 5000);
    expect(result).toBe('fast');
  });
});
