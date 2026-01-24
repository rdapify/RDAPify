/**
 * Base error classes for RDAPify
 * @module shared/errors
 */

/**
 * Base error class for all RDAPify errors
 */
export class RDAPifyError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, statusCode?: number, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error - invalid input
 */
export class ValidationError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context);
  }
}

/**
 * Network error - connection issues
 */
export class NetworkError extends RDAPifyError {
  constructor(message: string, statusCode?: number, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', statusCode || 500, context);
  }
}

/**
 * Timeout error - request timeout
 */
export class TimeoutError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', 408, context);
  }
}

/**
 * RDAP server error - server returned error
 */
export class RDAPServerError extends RDAPifyError {
  constructor(message: string, statusCode: number, context?: Record<string, any>) {
    super(message, 'RDAP_SERVER_ERROR', statusCode, context);
  }
}

/**
 * No server found error - no RDAP server for query
 */
export class NoServerFoundError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NO_SERVER_FOUND', 404, context);
  }
}

/**
 * Parse error - failed to parse response
 */
export class ParseError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PARSE_ERROR', 500, context);
  }
}

/**
 * Cache error - cache operation failed
 */
export class CacheError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CACHE_ERROR', 500, context);
  }
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 429, context);
  }
}

/**
 * SSRF protection error - blocked by SSRF protection
 */
export class SSRFProtectionError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'SSRF_PROTECTION_ERROR', 403, context);
  }
}

/**
 * Type guard to check if error is RDAPifyError
 */
export function isRDAPifyError(error: unknown): error is RDAPifyError {
  return error instanceof RDAPifyError;
}

/**
 * Type guard to check if error is SSRFProtectionError
 */
export function isSSRFProtectionError(error: unknown): error is SSRFProtectionError {
  return error instanceof SSRFProtectionError;
}

/**
 * Type guard to check if error is NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard to check if error is TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard to check if error is RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
