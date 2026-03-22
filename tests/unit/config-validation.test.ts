/**
 * Unit tests for client configuration validation
 */

import { validateClientOptions } from '../../src/shared/utils/validators/config-validation';
import { ValidationError } from '../../src/shared/errors';

describe('validateClientOptions()', () => {
  it('accepts empty options without throwing', () => {
    expect(() => validateClientOptions({})).not.toThrow();
  });

  // ---- timeout as number ----
  it('accepts valid numeric timeout', () => {
    expect(() => validateClientOptions({ timeout: 5000 })).not.toThrow();
  });

  it('rejects numeric timeout below 100ms', () => {
    expect(() => validateClientOptions({ timeout: 50 })).toThrow(ValidationError);
    expect(() => validateClientOptions({ timeout: 50 })).toThrow('Timeout must be between');
  });

  it('rejects numeric timeout above 60s', () => {
    expect(() => validateClientOptions({ timeout: 61000 })).toThrow(ValidationError);
  });

  it('accepts boundary numeric timeout (100ms)', () => {
    expect(() => validateClientOptions({ timeout: 100 })).not.toThrow();
  });

  it('accepts boundary numeric timeout (60000ms)', () => {
    expect(() => validateClientOptions({ timeout: 60000 })).not.toThrow();
  });

  // ---- timeout as object ----
  it('accepts valid timeout object', () => {
    expect(() => validateClientOptions({ timeout: { connect: 3000, request: 10000, dns: 2000 } })).not.toThrow();
  });

  it('rejects timeout.connect below 100', () => {
    expect(() => validateClientOptions({ timeout: { connect: 50 } })).toThrow('Connect timeout');
  });

  it('rejects timeout.connect above 60000', () => {
    expect(() => validateClientOptions({ timeout: { connect: 70000 } })).toThrow('Connect timeout');
  });

  it('rejects timeout.request below 100', () => {
    expect(() => validateClientOptions({ timeout: { request: 99 } })).toThrow('Request timeout');
  });

  it('rejects timeout.request above 60000', () => {
    expect(() => validateClientOptions({ timeout: { request: 60001 } })).toThrow('Request timeout');
  });

  it('rejects timeout.dns below 100', () => {
    expect(() => validateClientOptions({ timeout: { dns: 0 } })).toThrow('DNS timeout');
  });

  it('rejects timeout.dns above 60000', () => {
    expect(() => validateClientOptions({ timeout: { dns: 99999 } })).toThrow('DNS timeout');
  });

  it('timeout object with undefined fields passes', () => {
    expect(() => validateClientOptions({ timeout: {} })).not.toThrow();
  });

  // ---- maxRedirects ----
  it('accepts valid maxRedirects', () => {
    expect(() => validateClientOptions({ maxRedirects: 5 })).not.toThrow();
    expect(() => validateClientOptions({ maxRedirects: 0 })).not.toThrow();
    expect(() => validateClientOptions({ maxRedirects: 100 })).not.toThrow();
  });

  it('rejects maxRedirects below 0', () => {
    expect(() => validateClientOptions({ maxRedirects: -1 })).toThrow('maxRedirects must be between');
  });

  it('rejects maxRedirects above 100', () => {
    expect(() => validateClientOptions({ maxRedirects: 101 })).toThrow('maxRedirects must be between');
  });

  // ---- cache as object ----
  it('accepts valid cache object', () => {
    expect(() => validateClientOptions({ cache: { ttl: 3600, maxSize: 1000 } })).not.toThrow();
  });

  it('rejects cache.ttl below 1', () => {
    expect(() => validateClientOptions({ cache: { ttl: 0 } })).toThrow('Cache TTL must be between');
  });

  it('rejects cache.ttl above 86400', () => {
    expect(() => validateClientOptions({ cache: { ttl: 86401 } })).toThrow('Cache TTL must be between');
  });

  it('rejects cache.maxSize below 1', () => {
    expect(() => validateClientOptions({ cache: { maxSize: 0 } })).toThrow('Cache maxSize must be between');
  });

  it('rejects cache.maxSize above 100000', () => {
    expect(() => validateClientOptions({ cache: { maxSize: 100001 } })).toThrow('Cache maxSize must be between');
  });

  it('accepts cache: true (boolean)', () => {
    expect(() => validateClientOptions({ cache: true })).not.toThrow();
  });

  it('accepts cache: false (boolean)', () => {
    expect(() => validateClientOptions({ cache: false })).not.toThrow();
  });

  // ---- retry as object ----
  it('accepts valid retry object', () => {
    expect(() => validateClientOptions({ retry: { maxAttempts: 3, initialDelay: 1000, maxDelay: 10000 } })).not.toThrow();
  });

  it('rejects retry.maxAttempts below 1', () => {
    expect(() => validateClientOptions({ retry: { maxAttempts: 0 } })).toThrow('maxAttempts must be between');
  });

  it('rejects retry.maxAttempts above 10', () => {
    expect(() => validateClientOptions({ retry: { maxAttempts: 11 } })).toThrow('maxAttempts must be between');
  });

  it('rejects retry.initialDelay below 100', () => {
    expect(() => validateClientOptions({ retry: { initialDelay: 50 } })).toThrow('initialDelay must be between');
  });

  it('rejects retry.initialDelay above 10000', () => {
    expect(() => validateClientOptions({ retry: { initialDelay: 10001 } })).toThrow('initialDelay must be between');
  });

  it('rejects retry.maxDelay below 1000', () => {
    expect(() => validateClientOptions({ retry: { maxDelay: 500 } })).toThrow('maxDelay must be between');
  });

  it('rejects retry.maxDelay above 60000', () => {
    expect(() => validateClientOptions({ retry: { maxDelay: 60001 } })).toThrow('maxDelay must be between');
  });

  it('accepts retry: true (boolean)', () => {
    expect(() => validateClientOptions({ retry: true })).not.toThrow();
  });

  // ---- rateLimit as object ----
  it('accepts valid rateLimit object', () => {
    expect(() => validateClientOptions({ rateLimit: { maxRequests: 100, windowMs: 60000 } })).not.toThrow();
  });

  it('rejects rateLimit.maxRequests below 1', () => {
    expect(() => validateClientOptions({ rateLimit: { maxRequests: 0 } })).toThrow('maxRequests must be between');
  });

  it('rejects rateLimit.maxRequests above 10000', () => {
    expect(() => validateClientOptions({ rateLimit: { maxRequests: 10001 } })).toThrow('maxRequests must be between');
  });

  it('rejects rateLimit.windowMs below 1000', () => {
    expect(() => validateClientOptions({ rateLimit: { windowMs: 500 } })).toThrow('windowMs must be between');
  });

  it('rejects rateLimit.windowMs above 3600000', () => {
    expect(() => validateClientOptions({ rateLimit: { windowMs: 3600001 } })).toThrow('windowMs must be between');
  });

  it('accepts rateLimit: false (boolean)', () => {
    expect(() => validateClientOptions({ rateLimit: false })).not.toThrow();
  });
});
