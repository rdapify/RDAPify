/**
 * String utility functions
 * @module utils/helpers/string
 */

/**
 * Extracts TLD from domain name
 */
export function extractTLD(domain: string): string {
  const parts = domain.split('.');
  const tld = parts[parts.length - 1];
  if (!tld) {
    throw new Error('Invalid domain: no TLD found');
  }
  return tld;
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
 * Truncates a string to specified length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
