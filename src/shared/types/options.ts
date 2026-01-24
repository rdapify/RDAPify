/**
 * Configuration options for RDAPify client
 * @module types/options
 */

import type { CacheStrategy, LogLevel } from './index';

/**
 * Retry backoff strategies
 */
export type BackoffStrategy = 'linear' | 'exponential' | 'fixed';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff strategy */
  backoff?: BackoffStrategy;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes?: number[];
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Cache strategy to use */
  strategy?: CacheStrategy;
  /** Time-to-live in seconds */
  ttl?: number;
  /** Maximum cache size (for memory cache) */
  maxSize?: number;
  /** Redis connection string (for redis cache) */
  redisUrl?: string;
  /** Custom cache implementation */
  customCache?: any;
}

/**
 * SSRF protection configuration
 */
export interface SSRFProtectionOptions {
  /** Enable SSRF protection */
  enabled?: boolean;
  /** Block private IP ranges (RFC 1918) */
  blockPrivateIPs?: boolean;
  /** Block localhost */
  blockLocalhost?: boolean;
  /** Block link-local addresses */
  blockLinkLocal?: boolean;
  /** Custom blocked domains */
  blockedDomains?: string[];
  /** Custom allowed domains (whitelist) */
  allowedDomains?: string[];
}

/**
 * Privacy configuration options
 */
export interface PrivacyOptions {
  /** Enable automatic PII redaction */
  redactPII?: boolean;
  /** Fields to redact */
  redactFields?: string[];
  /** Replacement text for redacted data */
  redactionText?: string;
}

/**
 * Timeout configuration
 */
export interface TimeoutOptions {
  /** Connection timeout in milliseconds */
  connect?: number;
  /** Request timeout in milliseconds */
  request?: number;
  /** DNS lookup timeout in milliseconds */
  dns?: number;
}

/**
 * Logging configuration
 */
export interface LoggingOptions {
  /** Log level */
  level?: LogLevel;
  /** Custom logger function */
  logger?: (level: LogLevel, message: string, meta?: any) => void;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitOptions {
  /** Enable rate limiting */
  enabled?: boolean;
  /** Maximum requests per window */
  maxRequests?: number;
  /** Time window in milliseconds */
  windowMs?: number;
}

/**
 * Main client configuration options
 */
export interface RDAPClientOptions {
  /** Enable caching */
  cache?: boolean | CacheOptions;

  /** Retry configuration */
  retry?: boolean | RetryOptions;

  /** SSRF protection configuration */
  ssrfProtection?: boolean | SSRFProtectionOptions;

  /** Privacy configuration */
  privacy?: boolean | PrivacyOptions;

  /** Timeout configuration */
  timeout?: number | TimeoutOptions;

  /** Logging configuration */
  logging?: LoggingOptions;

  /** Rate limiting configuration */
  rateLimit?: boolean | RateLimitOptions;

  /** User agent string */
  userAgent?: string;

  /** Include raw RDAP response in result */
  includeRaw?: boolean;

  /** Follow redirects */
  followRedirects?: boolean;

  /** Maximum redirects to follow */
  maxRedirects?: number;

  /** Custom HTTP headers */
  headers?: Record<string, string>;

  /** Bootstrap service URL (for testing) */
  bootstrapUrl?: string;
}

/**
 * Default client options
 */
export const DEFAULT_OPTIONS: Required<RDAPClientOptions> = {
  cache: {
    strategy: 'memory',
    ttl: 3600, // 1 hour
    maxSize: 1000,
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoff: 'exponential',
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  ssrfProtection: {
    enabled: true,
    blockPrivateIPs: true,
    blockLocalhost: true,
    blockLinkLocal: true,
    blockedDomains: [],
    allowedDomains: [],
  },
  privacy: {
    redactPII: true,
    redactFields: ['email', 'phone', 'fax'],
    redactionText: '[REDACTED]',
  },
  timeout: {
    connect: 5000,
    request: 10000,
    dns: 3000,
  },
  logging: {
    level: 'warn',
  },
  rateLimit: {
    enabled: false,
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
  userAgent: 'RDAPify/0.1.0 (https://rdapify.com)',
  includeRaw: false,
  followRedirects: true,
  maxRedirects: 5,
  headers: {},
  bootstrapUrl: 'https://data.iana.org/rdap',
};
