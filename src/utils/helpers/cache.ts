/**
 * Cache utility functions
 * @module utils/helpers/cache
 */

/**
 * Generates a cache key from query parameters
 */
export function generateCacheKey(type: string, query: string): string {
  return `rdap:${type}:${query.toLowerCase()}`;
}
