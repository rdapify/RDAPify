/**
 * Custom error classes for RDAPify
 * @module types/errors
 */

/**
 * Base error class for all RDAPify errors
 */
export class RDAPifyError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: any;

  constructor(message: string, code: string, statusCode?: number, details?: any) {
    super(message);
    this.name = 'RDAPifyError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when SSRF protection blocks a request
 */
export class SSRFProtectionError extends RDAPifyError {
  constructor(message: string, details?: any) {
    super(message, 'SSRF_PROTECTION', 403, details);
    this.name = 'SSRFProtectionError';
  }
}

/**
 * Error thrown when a network request fails
 */
export class NetworkError extends RDAPifyError {
  constructor(message: string, statusCode?: number, details?: any) {
    super(message, 'NETWORK_ERROR', statusCode, details);
    this.name = 'NetworkError';
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends RDAPifyError {
  constructor(message: string, details?: any) {
    super(message, 'TIMEOUT', 408, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when RDAP server returns an error
 */
export class RDAPServerError extends RDAPifyError {
  constructor(message: string, statusCode: number, details?: any) {
    super(message, 'RDAP_SERVER_ERROR', statusCode, details);
    this.name = 'RDAPServerError';
  }
}

/**
 * Error thrown when no RDAP server is found for a query
 */
export class NoServerFoundError extends RDAPifyError {
  constructor(message: string, details?: any) {
    super(message, 'NO_SERVER_FOUND', 404, details);
    this.name = 'NoServerFoundError';
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends RDAPifyError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when response parsing fails
 */
export class ParseError extends RDAPifyError {
  constructor(message: string, details?: any) {
    super(message, 'PARSE_ERROR', 500, details);
    this.name = 'ParseError';
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends RDAPifyError {
  constructor(message: string, details?: any) {
    super(message, 'CACHE_ERROR', 500, details);
    this.name = 'CacheError';
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends RDAPifyError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, details?: any) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Type guard to check if an error is a RDAPifyError
 */
export function isRDAPifyError(error: any): error is RDAPifyError {
  return error instanceof RDAPifyError;
}

/**
 * Type guard to check if an error is an SSRFProtectionError
 */
export function isSSRFProtectionError(error: any): error is SSRFProtectionError {
  return error instanceof SSRFProtectionError;
}

/**
 * Type guard to check if an error is a NetworkError
 */
export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Type guard to check if an error is a TimeoutError
 */
export function isTimeoutError(error: any): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard to check if an error is a RateLimitError
 */
export function isRateLimitError(error: any): error is RateLimitError {
  return error instanceof RateLimitError;
}
