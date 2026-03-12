/**
 * Client configuration validation
 * @module utils/validators/config-validation
 */

import type { RDAPClientOptions } from '../../types/options';
import { ValidationError } from '../../errors';

/**
 * Validates client configuration options
 */
export function validateClientOptions(options: RDAPClientOptions): void {
  // Validate timeout
  if (options.timeout !== undefined) {
    if (typeof options.timeout === 'number') {
      if (options.timeout < 100 || options.timeout > 60000) {
        throw new ValidationError('Timeout must be between 100ms and 60s', {
          field: 'timeout',
          value: options.timeout,
        });
      }
    } else if (typeof options.timeout === 'object') {
      const { connect, request, dns } = options.timeout;

      if (connect !== undefined && (connect < 100 || connect > 60000)) {
        throw new ValidationError('Connect timeout must be between 100ms and 60s', {
          field: 'timeout.connect',
          value: connect,
        });
      }

      if (request !== undefined && (request < 100 || request > 60000)) {
        throw new ValidationError('Request timeout must be between 100ms and 60s', {
          field: 'timeout.request',
          value: request,
        });
      }

      if (dns !== undefined && (dns < 100 || dns > 60000)) {
        throw new ValidationError('DNS timeout must be between 100ms and 60s', {
          field: 'timeout.dns',
          value: dns,
        });
      }
    }
  }

  // Validate maxRedirects
  if (options.maxRedirects !== undefined) {
    if (options.maxRedirects < 0 || options.maxRedirects > 100) {
      throw new ValidationError('maxRedirects must be between 0 and 100', {
        field: 'maxRedirects',
        value: options.maxRedirects,
      });
    }
  }

  // Validate cache options
  if (options.cache !== undefined && typeof options.cache === 'object') {
    const { ttl, maxSize } = options.cache;

    if (ttl !== undefined && (ttl < 1 || ttl > 86400)) {
      throw new ValidationError('Cache TTL must be between 1 and 86400 seconds', {
        field: 'cache.ttl',
        value: ttl,
      });
    }

    if (maxSize !== undefined && (maxSize < 1 || maxSize > 100000)) {
      throw new ValidationError('Cache maxSize must be between 1 and 100000', {
        field: 'cache.maxSize',
        value: maxSize,
      });
    }
  }

  // Validate retry options
  if (options.retry !== undefined && typeof options.retry === 'object') {
    const { maxAttempts, initialDelay, maxDelay } = options.retry;

    if (maxAttempts !== undefined && (maxAttempts < 1 || maxAttempts > 10)) {
      throw new ValidationError('maxAttempts must be between 1 and 10', {
        field: 'retry.maxAttempts',
        value: maxAttempts,
      });
    }

    if (initialDelay !== undefined && (initialDelay < 100 || initialDelay > 10000)) {
      throw new ValidationError('initialDelay must be between 100ms and 10s', {
        field: 'retry.initialDelay',
        value: initialDelay,
      });
    }

    if (maxDelay !== undefined && (maxDelay < 1000 || maxDelay > 60000)) {
      throw new ValidationError('maxDelay must be between 1s and 60s', {
        field: 'retry.maxDelay',
        value: maxDelay,
      });
    }
  }

  // Validate rate limit options
  if (options.rateLimit !== undefined && typeof options.rateLimit === 'object') {
    const { maxRequests, windowMs } = options.rateLimit;

    if (maxRequests !== undefined && (maxRequests < 1 || maxRequests > 10000)) {
      throw new ValidationError('maxRequests must be between 1 and 10000', {
        field: 'rateLimit.maxRequests',
        value: maxRequests,
      });
    }

    if (windowMs !== undefined && (windowMs < 1000 || windowMs > 3600000)) {
      throw new ValidationError('windowMs must be between 1s and 1 hour', {
        field: 'rateLimit.windowMs',
        value: windowMs,
      });
    }
  }
}
