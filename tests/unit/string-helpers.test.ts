/**
 * Unit tests for string helper utilities
 */

import { extractTLD, sanitizeUrl, truncate } from '../../src/shared/utils/helpers/string';

describe('extractTLD()', () => {
  it('extracts TLD from simple domain', () => {
    expect(extractTLD('example.com')).toBe('com');
  });

  it('extracts TLD from subdomain', () => {
    expect(extractTLD('sub.example.co.uk')).toBe('uk');
  });

  it('extracts TLD from two-part domain', () => {
    expect(extractTLD('github.io')).toBe('io');
  });

  it('throws when no TLD found (empty string)', () => {
    expect(() => extractTLD('')).toThrow('Invalid domain');
  });

  it('handles single label (no dot)', () => {
    // 'com' split by '.' gives ['com'] — tld = 'com', valid
    expect(extractTLD('com')).toBe('com');
  });
});

describe('sanitizeUrl()', () => {
  it('strips query parameters', () => {
    const result = sanitizeUrl('https://rdap.example.com/domain/test?token=secret&foo=bar');
    expect(result).not.toContain('token');
    expect(result).not.toContain('secret');
    expect(result).toContain('rdap.example.com');
  });

  it('returns [invalid-url] for non-URL strings', () => {
    expect(sanitizeUrl('not a url')).toBe('[invalid-url]');
  });

  it('returns [invalid-url] for empty string', () => {
    expect(sanitizeUrl('')).toBe('[invalid-url]');
  });

  it('preserves path without query params', () => {
    const result = sanitizeUrl('https://rdap.verisign.com/com/v1/domain/example.com');
    expect(result).toContain('/com/v1/domain/example.com');
    expect(result).not.toContain('?');
  });
});

describe('truncate()', () => {
  it('returns string unchanged when shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns string unchanged when exactly maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis when longer than maxLength', () => {
    const result = truncate('hello world', 8);
    expect(result).toBe('hello...');
    expect(result).toHaveLength(8);
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('maxLength of 3 produces just ellipsis', () => {
    const result = truncate('hello', 3);
    expect(result).toBe('...');
    expect(result).toHaveLength(3);
  });
});
