/**
 * Async utility functions
 * @module utils/helpers/async
 */

import type { BackoffStrategy } from '../../types/options';

/**
 * Calculates delay for retry attempts based on backoff strategy
 */
export function calculateBackoff(
  attempt: number,
  strategy: BackoffStrategy,
  initialDelay: number,
  maxDelay: number
): number {
  let delay: number;

  switch (strategy) {
    case 'linear':
      delay = initialDelay * attempt;
      break;
    case 'exponential':
      delay = initialDelay * Math.pow(2, attempt - 1);
      break;
    case 'fixed':
    default:
      delay = initialDelay;
      break;
  }

  return Math.min(delay, maxDelay);
}

/**
 * Sleeps for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a timeout promise that rejects after specified time
 * Returns both the promise and a cleanup function to cancel the timer
 */
export function createTimeout(
  ms: number,
  message?: string
): { promise: Promise<never>; cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });
  return {
    promise,
    cancel: () => clearTimeout(timeoutId),
  };
}

/**
 * Races a promise against a timeout
 * Properly cleans up the timeout when the promise resolves
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  const timeout = createTimeout(timeoutMs, timeoutMessage);
  try {
    return await Promise.race([promise, timeout.promise]);
  } finally {
    timeout.cancel();
  }
}
