/**
 * HTTP utility functions
 * @module utils/helpers/http
 */

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
