/**
 * Helper utility functions
 * @module utils/helpers
 */

import type { BackoffStrategy } from '../types/options';

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
 * Extracts TLD from domain name
 */
export function extractTLD(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1];
}

/**
 * Checks if a value is a plain object
 */
export function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merges two objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Generates a cache key from query parameters
 */
export function generateCacheKey(type: string, query: string): string {
  return `rdap:${type}:${query.toLowerCase()}`;
}

/**
 * Parses Retry-After header value
 */
export function parseRetryAfter(value: string | undefined): number | undefined {
  if (!value) return undefined;

  // Try parsing as number (seconds)
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000; // Convert to milliseconds
  }

  // Try parsing as HTTP date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
}

/**
 * Sanitizes URL for logging (removes sensitive data)
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query parameters that might contain sensitive data
    parsed.search = '';
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Creates a timeout promise that rejects after specified time
 */
export function createTimeout(ms: number, message?: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Races a promise against a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([promise, createTimeout(timeoutMs, timeoutMessage)]);
}

/**
 * Truncates a string to specified length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Checks if code is running in Node.js environment
 */
export function isNode(): boolean {
  return (
    typeof process !== 'undefined' && process.versions != null && process.versions.node != null
  );
}

/**
 * Checks if code is running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Checks if code is running in Deno environment
 */
export function isDeno(): boolean {
  return typeof Deno !== 'undefined';
}

/**
 * Checks if code is running in Bun environment
 */
export function isBun(): boolean {
  return typeof Bun !== 'undefined';
}

/**
 * Gets current runtime environment name
 */
export function getRuntimeName(): string {
  if (isDeno()) return 'Deno';
  if (isBun()) return 'Bun';
  if (isNode()) return 'Node.js';
  if (isBrowser()) return 'Browser';
  return 'Unknown';
}
