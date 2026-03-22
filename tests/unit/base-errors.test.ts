/**
 * Unit tests for base error classes and type guards
 */

import {
  RDAPifyError, ValidationError, NetworkError, TimeoutError,
  RDAPServerError, NoServerFoundError, ParseError, CacheError,
  RateLimitError, SSRFProtectionError, QueryAbortedError,
  ConfigurationError,
  isRDAPifyError, isSSRFProtectionError, isNetworkError,
  isTimeoutError, isRateLimitError, isConfigurationError,
} from '../../src/shared/errors/base.error';

describe('RDAPifyError', () => {
  it('sets name, code, message, timestamp', () => {
    const err = new ValidationError('bad input', { field: 'domain' });
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('bad input');
    expect(typeof err.timestamp).toBe('number');
  });

  it('extracts queryType, queryValue, serverUrl from context', () => {
    const err = new NetworkError('fail', 500, { queryType: 'domain', queryValue: 'x.com', serverUrl: 'https://rdap.example.com' });
    expect(err.queryType).toBe('domain');
    expect(err.queryValue).toBe('x.com');
    expect(err.serverUrl).toBe('https://rdap.example.com');
  });

  it('toJSON() includes all fields', () => {
    const err = new ValidationError('msg', { field: 'x' }, 'fix it');
    const json = err.toJSON();
    expect(json.name).toBe('ValidationError');
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.message).toBe('msg');
    expect(json.statusCode).toBe(400);
    expect(json.suggestion).toBe('fix it');
  });

  it('getUserMessage() includes suggestion when present', () => {
    const err = new ValidationError('bad domain', undefined, 'check the format');
    expect(err.getUserMessage()).toContain('bad domain');
    expect(err.getUserMessage()).toContain('check the format');
  });

  it('getUserMessage() returns just message when no suggestion', () => {
    const err = new NoServerFoundError('not found');
    expect(err.getUserMessage()).toBe('not found');
  });

  it('getDetailedMessage() includes query info when present', () => {
    const err = new NetworkError('fail', 500, { queryType: 'domain', queryValue: 'x.com' });
    const msg = err.getDetailedMessage();
    expect(msg).toContain('domain x.com');
  });

  it('getDetailedMessage() includes serverUrl when present', () => {
    const err = new NetworkError('fail', 500, { serverUrl: 'https://rdap.example.com' });
    const msg = err.getDetailedMessage();
    expect(msg).toContain('https://rdap.example.com');
  });

  it('getDetailedMessage() includes suggestion when present', () => {
    const err = new ValidationError('bad', undefined, 'hint');
    expect(err.getDetailedMessage()).toContain('hint');
  });

  it('getDetailedMessage() without context just returns message', () => {
    const err = new ParseError('parse failed');
    expect(err.getDetailedMessage()).toBe('parse failed');
  });

  it('instanceof check works for subclasses', () => {
    const err = new ValidationError('x');
    expect(err instanceof Error).toBe(true);
    expect(err instanceof RDAPifyError).toBe(true);
    expect(err instanceof ValidationError).toBe(true);
  });
});

describe('RDAPServerError', () => {
  it('sets default suggestion for 404', () => {
    const err = new RDAPServerError('not found', 404);
    expect(err.suggestion).toContain('not found');
  });

  it('sets default suggestion for 429', () => {
    const err = new RDAPServerError('rate limited', 429);
    expect(err.suggestion).toContain('Rate limit');
  });

  it('sets default suggestion for 5xx', () => {
    const err = new RDAPServerError('server error', 503);
    expect(err.suggestion).toContain('RDAP server is experiencing');
  });

  it('sets default suggestion for other status codes', () => {
    const err = new RDAPServerError('bad request', 400);
    expect(err.suggestion).toContain('Check the RDAP server');
  });

  it('uses custom suggestion when provided', () => {
    const err = new RDAPServerError('fail', 500, {}, 'custom hint');
    expect(err.suggestion).toBe('custom hint');
  });
});

describe('RateLimitError', () => {
  it('sets retryAfter when provided', () => {
    const err = new RateLimitError('too fast', {}, 5000);
    expect(err.retryAfter).toBe(5000);
    expect(err.suggestion).toContain('5000ms');
  });

  it('uses fallback suggestion when no retryAfter', () => {
    const err = new RateLimitError('too fast');
    expect(err.retryAfter).toBeUndefined();
    expect(err.suggestion).toContain('Slow down');
  });
});

describe('QueryAbortedError', () => {
  it('includes query in message when provided', () => {
    const err = new QueryAbortedError('example.com');
    expect(err.message).toContain('example.com');
  });

  it('uses generic message when query not provided', () => {
    const err = new QueryAbortedError();
    expect(err.message).toBe('Query aborted by middleware');
  });
});

describe('Type guards', () => {
  it('isRDAPifyError() returns true for RDAPifyError instances', () => {
    expect(isRDAPifyError(new ValidationError('x'))).toBe(true);
    expect(isRDAPifyError(new NetworkError('x'))).toBe(true);
  });

  it('isRDAPifyError() returns false for plain errors', () => {
    expect(isRDAPifyError(new Error('x'))).toBe(false);
    expect(isRDAPifyError(null)).toBe(false);
    expect(isRDAPifyError('string')).toBe(false);
  });

  it('isSSRFProtectionError() returns true only for SSRFProtectionError', () => {
    expect(isSSRFProtectionError(new SSRFProtectionError('blocked'))).toBe(true);
    expect(isSSRFProtectionError(new NetworkError('x'))).toBe(false);
  });

  it('isNetworkError() returns true only for NetworkError', () => {
    expect(isNetworkError(new NetworkError('x'))).toBe(true);
    expect(isNetworkError(new ValidationError('x'))).toBe(false);
  });

  it('isTimeoutError() returns true only for TimeoutError', () => {
    expect(isTimeoutError(new TimeoutError('x'))).toBe(true);
    expect(isTimeoutError(new NetworkError('x'))).toBe(false);
  });

  it('isRateLimitError() returns true only for RateLimitError', () => {
    expect(isRateLimitError(new RateLimitError('x'))).toBe(true);
    expect(isRateLimitError(new ValidationError('x'))).toBe(false);
  });

  it('ConfigurationError constructs correctly', () => {
    const err = new ConfigurationError('bad config', { field: 'timeout' }, 'use a positive number');
    expect(err).toBeInstanceOf(ConfigurationError);
    expect(err.name).toBe('ConfigurationError');
    expect(err.message).toBe('bad config');
  });

  it('isConfigurationError() returns true only for ConfigurationError', () => {
    expect(isConfigurationError(new ConfigurationError('x'))).toBe(true);
    expect(isConfigurationError(new ValidationError('x'))).toBe(false);
    expect(isConfigurationError('not an error')).toBe(false);
  });
});
