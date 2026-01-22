/**
 * Unit tests for helper functions
 */

import {
  calculateBackoff,
  sleep,
  extractTLD,
  isPlainObject,
  deepMerge,
  generateCacheKey,
  parseRetryAfter,
  sanitizeUrl,
  formatBytes,
  formatDuration,
  truncate,
  isNode,
  isBrowser,
  isDeno,
  isBun,
  getRuntimeName,
} from '../../src/utils/helpers';

describe('calculateBackoff', () => {
  it('should calculate linear backoff', () => {
    expect(calculateBackoff(1, 'linear', 1000, 10000)).toBe(1000);
    expect(calculateBackoff(2, 'linear', 1000, 10000)).toBe(2000);
    expect(calculateBackoff(3, 'linear', 1000, 10000)).toBe(3000);
  });

  it('should calculate exponential backoff', () => {
    expect(calculateBackoff(1, 'exponential', 1000, 10000)).toBe(1000);
    expect(calculateBackoff(2, 'exponential', 1000, 10000)).toBe(2000);
    expect(calculateBackoff(3, 'exponential', 1000, 10000)).toBe(4000);
    expect(calculateBackoff(4, 'exponential', 1000, 10000)).toBe(8000);
  });

  it('should calculate fixed backoff', () => {
    expect(calculateBackoff(1, 'fixed', 1000, 10000)).toBe(1000);
    expect(calculateBackoff(2, 'fixed', 1000, 10000)).toBe(1000);
    expect(calculateBackoff(3, 'fixed', 1000, 10000)).toBe(1000);
  });

  it('should respect max delay', () => {
    expect(calculateBackoff(10, 'exponential', 1000, 5000)).toBe(5000);
    expect(calculateBackoff(10, 'linear', 1000, 5000)).toBe(5000);
  });
});

describe('sleep', () => {
  it('should sleep for specified time', async () => {
    const start = Date.now();
    await sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
    expect(elapsed).toBeLessThan(200);
  });
});

describe('extractTLD', () => {
  it('should extract TLD from domain', () => {
    expect(extractTLD('example.com')).toBe('com');
    expect(extractTLD('sub.example.co.uk')).toBe('uk');
    expect(extractTLD('test.org')).toBe('org');
  });
});

describe('isPlainObject', () => {
  it('should return true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('should return false for non-objects', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject('string')).toBe(false);
    expect(isPlainObject(123)).toBe(false);
  });
});

describe('deepMerge', () => {
  it('should merge simple objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should merge nested objects', () => {
    const target = { a: { x: 1, y: 2 } };
    const source = { a: { y: 3, z: 4 } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  it('should not mutate original objects', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    deepMerge(target, source);
    expect(target).toEqual({ a: 1 });
  });
});

describe('generateCacheKey', () => {
  it('should generate cache key', () => {
    expect(generateCacheKey('domain', 'example.com')).toBe('rdap:domain:example.com');
    expect(generateCacheKey('ip', '8.8.8.8')).toBe('rdap:ip:8.8.8.8');
  });

  it('should lowercase query', () => {
    expect(generateCacheKey('domain', 'EXAMPLE.COM')).toBe('rdap:domain:example.com');
  });
});

describe('parseRetryAfter', () => {
  it('should parse seconds', () => {
    expect(parseRetryAfter('60')).toBe(60000);
    expect(parseRetryAfter('120')).toBe(120000);
  });

  it('should parse HTTP date', () => {
    const future = new Date(Date.now() + 60000);
    const result = parseRetryAfter(future.toUTCString());
    expect(result).toBeGreaterThan(50000);
    expect(result).toBeLessThan(70000);
  });

  it('should return undefined for invalid input', () => {
    expect(parseRetryAfter('invalid')).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
  });
});

describe('sanitizeUrl', () => {
  it('should remove query parameters', () => {
    expect(sanitizeUrl('https://example.com/path?secret=123')).toBe('https://example.com/path');
  });

  it('should handle invalid URLs', () => {
    expect(sanitizeUrl('not-a-url')).toBe('[invalid-url]');
  });
});

describe('formatBytes', () => {
  it('should format bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(65000)).toBe('1.08m');
    expect(formatDuration(3700000)).toBe('1.03h');
  });
});

describe('truncate', () => {
  it('should truncate long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });

  it('should not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
});

describe('runtime detection', () => {
  it('should detect Node.js', () => {
    expect(isNode()).toBe(true);
    expect(isBrowser()).toBe(false);
    expect(isDeno()).toBe(false);
    expect(isBun()).toBe(false);
  });

  it('should return runtime name', () => {
    expect(getRuntimeName()).toBe('Node.js');
  });
});
