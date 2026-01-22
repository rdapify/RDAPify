/**
 * Unit tests for custom error classes
 */

import {
  RDAPifyError,
  SSRFProtectionError,
  NetworkError,
  TimeoutError,
  RDAPServerError,
  NoServerFoundError,
  ValidationError,
  ParseError,
  CacheError,
  RateLimitError,
  isRDAPifyError,
  isSSRFProtectionError,
  isNetworkError,
  isTimeoutError,
  isRateLimitError,
} from '../../src/types/errors';

describe('RDAPifyError', () => {
  it('should create error with message and code', () => {
    const error = new RDAPifyError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('RDAPifyError');
  });

  it('should include status code', () => {
    const error = new RDAPifyError('Test error', 'TEST_CODE', 404);
    expect(error.statusCode).toBe(404);
  });

  it('should include details', () => {
    const details = { foo: 'bar' };
    const error = new RDAPifyError('Test error', 'TEST_CODE', undefined, details);
    expect(error.details).toEqual(details);
  });

  it('should have proper stack trace', () => {
    const error = new RDAPifyError('Test error', 'TEST_CODE');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('RDAPifyError');
  });
});

describe('SSRFProtectionError', () => {
  it('should create SSRF error', () => {
    const error = new SSRFProtectionError('SSRF blocked');
    expect(error.message).toBe('SSRF blocked');
    expect(error.code).toBe('SSRF_PROTECTION');
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe('SSRFProtectionError');
  });
});

describe('NetworkError', () => {
  it('should create network error', () => {
    const error = new NetworkError('Network failed', 500);
    expect(error.message).toBe('Network failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('NetworkError');
  });
});

describe('TimeoutError', () => {
  it('should create timeout error', () => {
    const error = new TimeoutError('Request timeout');
    expect(error.message).toBe('Request timeout');
    expect(error.code).toBe('TIMEOUT');
    expect(error.statusCode).toBe(408);
    expect(error.name).toBe('TimeoutError');
  });
});

describe('RDAPServerError', () => {
  it('should create RDAP server error', () => {
    const error = new RDAPServerError('Server error', 500);
    expect(error.message).toBe('Server error');
    expect(error.code).toBe('RDAP_SERVER_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('RDAPServerError');
  });
});

describe('NoServerFoundError', () => {
  it('should create no server found error', () => {
    const error = new NoServerFoundError('No server found');
    expect(error.message).toBe('No server found');
    expect(error.code).toBe('NO_SERVER_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('NoServerFoundError');
  });
});

describe('ValidationError', () => {
  it('should create validation error', () => {
    const error = new ValidationError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
  });
});

describe('ParseError', () => {
  it('should create parse error', () => {
    const error = new ParseError('Parse failed');
    expect(error.message).toBe('Parse failed');
    expect(error.code).toBe('PARSE_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('ParseError');
  });
});

describe('CacheError', () => {
  it('should create cache error', () => {
    const error = new CacheError('Cache failed');
    expect(error.message).toBe('Cache failed');
    expect(error.code).toBe('CACHE_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('CacheError');
  });
});

describe('RateLimitError', () => {
  it('should create rate limit error', () => {
    const error = new RateLimitError('Rate limit exceeded', 60);
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitError');
  });
});

describe('Type guards', () => {
  it('should identify RDAPifyError', () => {
    const error = new RDAPifyError('Test', 'TEST');
    expect(isRDAPifyError(error)).toBe(true);
    expect(isRDAPifyError(new Error('Test'))).toBe(false);
  });

  it('should identify SSRFProtectionError', () => {
    const error = new SSRFProtectionError('Test');
    expect(isSSRFProtectionError(error)).toBe(true);
    expect(isSSRFProtectionError(new Error('Test'))).toBe(false);
  });

  it('should identify NetworkError', () => {
    const error = new NetworkError('Test');
    expect(isNetworkError(error)).toBe(true);
    expect(isNetworkError(new Error('Test'))).toBe(false);
  });

  it('should identify TimeoutError', () => {
    const error = new TimeoutError('Test');
    expect(isTimeoutError(error)).toBe(true);
    expect(isTimeoutError(new Error('Test'))).toBe(false);
  });

  it('should identify RateLimitError', () => {
    const error = new RateLimitError('Test');
    expect(isRateLimitError(error)).toBe(true);
    expect(isRateLimitError(new Error('Test'))).toBe(false);
  });
});
