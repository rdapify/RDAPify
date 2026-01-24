/**
 * HTTP protocol constants
 * @module shared/constants
 */

/**
 * Default timeout values (in milliseconds)
 */
export const DEFAULT_TIMEOUTS = {
  connect: 5000,
  request: 10000,
  dns: 3000,
} as const;

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoff: 'exponential' as const,
};

/**
 * Default redirect configuration
 */
export const DEFAULT_REDIRECT_CONFIG = {
  followRedirects: true,
  maxRedirects: 5,
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
