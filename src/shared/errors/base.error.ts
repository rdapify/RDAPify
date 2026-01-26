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
  public readonly timestamp: number;
  public readonly suggestion?: string;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    context?: Record<string, any>,
    suggestion?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = Date.now();
    this.suggestion = suggestion;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Returns a formatted error message with context
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      timestamp: this.timestamp,
      suggestion: this.suggestion,
    };
  }

  /**
   * Returns a user-friendly error message
   */
  getUserMessage(): string {
    const parts = [this.message];
    if (this.suggestion) {
      parts.push(`Suggestion: ${this.suggestion}`);
    }
    return parts.join('. ');
  }
}

/**
 * Validation error - invalid input
 */
export class ValidationError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>, suggestion?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      context,
      suggestion || 'Please check your input and try again'
    );
  }
}

/**
 * Network error - connection issues
 */
export class NetworkError extends RDAPifyError {
  constructor(message: string, statusCode?: number, context?: Record<string, any>, suggestion?: string) {
    super(
      message,
      'NETWORK_ERROR',
      statusCode || 500,
      context,
      suggestion || 'Check your network connection and try again'
    );
  }
}

/**
 * Timeout error - request timeout
 */
export class TimeoutError extends RDAPifyError {
  constructor(message: string, context?: Record<string, any>, suggestion?: string) {
    super(
      message,
      'TIMEOUT_ERROR',
      408,
      context,
      suggestion || 'The request took too long. Try increasing the timeout or check the server status'
    );
  }
}

/**
 * RDAP server error - server returned error
 */
export class RDAPServerError extends RDAPifyError {
  constructor(message: string, statusCode: number, context?: Record<string, any>, suggestion?: string) {
    const defaultSuggestion = statusCode === 404
      ? 'The requested resource was not found. Verify the domain/IP/ASN exists'
      : statusCode === 429
      ? 'Rate limit exceeded. Wait a moment before retrying'
      : statusCode >= 500
      ? 'The RDAP server is experiencing issues. Try again later'
      : 'Check the RDAP server status and try again';
    
    super(message, 'RDAP_SERVER_ERROR', statusCode, context, suggestion || defaultSuggestion);
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
  public readonly retryAfter?: number;

  constructor(message: string, context?: Record<string, any>, retryAfter?: number) {
    const suggestion = retryAfter
      ? `Rate limit exceeded. Retry after ${retryAfter}ms`
      : 'Rate limit exceeded. Slow down your requests';
    
    super(message, 'RATE_LIMIT_ERROR', 429, context, suggestion);
    this.retryAfter = retryAfter;
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
