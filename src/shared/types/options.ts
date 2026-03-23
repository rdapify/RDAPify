/**
 * Configuration options for RDAPify client
 * @module types/options
 */

import type { CacheStrategy, LogLevel } from './index';
import type { RedisClientLike } from '../../infrastructure/cache/RedisCache';

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
  customCache?: unknown;
  /**
   * Redis-compatible client instance (ioredis, node-redis, etc.).
   * Required when `strategy` is `'redis'`.
   */
  redisClient?: RedisClientLike;
  /**
   * Key prefix used by the Redis adapter for multi-tenant isolation.
   * @default 'rdapify:'
   */
  keyPrefix?: string;
  /**
   * Callback invoked when stale-while-revalidate triggers a background refresh.
   * Called with the cache key and the newly fetched fresh value.
   * Only used when `strategy` is `'stale-while-revalidate'`.
   */
  revalidateCallback?: (key: string, freshValue: import('./responses').RDAPResponse) => void;
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
  /**
   * Enable DNS rebinding protection.
   * When true, resolves domain names via DNS and validates each returned IP
   * against SSRF rules before allowing the request.
   * @default false
   */
  dnsRebinding?: boolean;
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
  logger?: (level: LogLevel, message: string, meta?: unknown) => void;
}

/**
 * Debug logging configuration
 */
export interface DebugOptions {
  /** Enable debug logging */
  enabled?: boolean;
  /** Custom logger for debug output */
  logger?: {
    debug: (message: string, metadata?: Record<string, unknown>) => void;
    info: (message: string, metadata?: Record<string, unknown>) => void;
    warn: (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, metadata?: Record<string, unknown>) => void;
  };
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
  /**
   * Rate limiter backend adapter.
   * - `'memory'` (default): single-process in-memory token bucket
   * - `'redis'`: distributed via Redis; requires `redisClient`
   */
  adapter?: 'memory' | 'redis';
  /** Redis client instance for distributed rate limiting (required when `adapter: 'redis'`) */
  redisClient?: unknown;
}

/**
 * Middleware lifecycle hooks configuration.
 * The concrete hook function types live in MiddlewareHooks.ts.
 * A loose callable type is used here to avoid a circular dependency between
 * the shared types layer and the application layer.
 */
export type MiddlewareHooksConfig = Record<
  string,
  ((ctx: unknown) => Promise<void> | void) | undefined
>;

/**
 * Query deduplication configuration
 */
export interface DeduplicationConfig {
  /** Deduplication window in milliseconds (default: 100) */
  windowMs?: number;
}

/**
 * Advanced bootstrap configuration
 */
export interface BootstrapOptions {
  /**
   * Custom RDAP servers per TLD.
   * These are consulted before the IANA bootstrap lookup.
   * @example [{ tld: 'com', url: 'https://my-rdap.example.com' }]
   */
  customServers?: { tld: string; url: string }[];
  /**
   * Override the bootstrap cache TTL in seconds.
   * @default 86400 (24 hours)
   */
  ttl?: number;
  /**
   * Fall back to IANA bootstrap when a custom server is not defined for a TLD.
   * Set to `false` to disable IANA lookup entirely (useful for private registries).
   * @default true
   */
  fallback?: boolean;
  /**
   * Preferred bootstrap regions for multi-region deployments.
   * When set, the client tries the nearest regional mirror first and falls back
   * to the primary IANA bootstrap endpoint on failure.
   *
   * @example ['eu', 'us']  // Try EU mirror first, then US
   */
  regions?: Array<'us' | 'eu' | 'ap'>;
}

/**
 * OpenTelemetry / distributed tracing configuration
 */
export interface TelemetryOptions {
  /**
   * OTLP HTTP endpoint for trace export.
   * @example 'http://localhost:4318/v1/traces'
   */
  endpoint?: string;
  /**
   * Logical service name reported in spans.
   * @default 'rdapify'
   */
  serviceName?: string;
  /**
   * Service version reported in spans.
   * @default current rdapify version
   */
  serviceVersion?: string;
  /**
   * Enable telemetry export (default: true when endpoint is set).
   */
  enabled?: boolean;
  /**
   * Additional resource attributes to include in every span.
   */
  resourceAttributes?: Record<string, string>;
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

  /** Debug configuration */
  debug?: boolean | DebugOptions;

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

  /**
   * Lifecycle middleware hooks.
   * Pass a MiddlewareOptions-compatible object — the type is widened here to
   * avoid circular imports between shared/types and the application layer.
   */
  middleware?: MiddlewareHooksConfig;

  /**
   * Enable in-flight query deduplication.
   * true  → enabled with default 100 ms window
   * false → disabled
   * object → enabled with custom window
   */
  deduplication?: boolean | DeduplicationConfig;

  /**
   * Query execution backend.
   *
   * - `'auto'` (default) — uses the Rust native backend if `rdapify-nd`
   *   is installed; falls back to the TypeScript backend silently.
   * - `'native'` — always uses the Rust native backend; throws at
   *   construction time if `rdapify-nd` is not installed.
   * - `'typescript'` — always uses the TypeScript backend, even if
   *   `rdapify-nd` is installed.
   *
   * The native backend processes the five core query methods (domain, ip,
   * asn, nameserver, entity) in compiled Rust, offering lower latency for
   * high-throughput scenarios. Middleware hooks, rate limiting, audit
   * logging, and other TypeScript-layer features are bypassed when the
   * native backend is active.
   *
   * @default 'auto'
   */
  backend?: 'auto' | 'native' | 'typescript';

  /**
   * Advanced bootstrap configuration.
   * Allows overriding the IANA server discovery with custom RDAP endpoints,
   * adjusting the bootstrap cache TTL, and controlling fallback behaviour.
   */
  bootstrap?: BootstrapOptions;

  /**
   * Enable HTTP/2 for RDAP requests (opt-in).
   * When `true` the fetcher sets the `Accept` header and requests multiplexed
   * connections where the underlying runtime supports it.
   * @default false
   */
  http2?: boolean;

  /**
   * OpenTelemetry tracing configuration.
   * When an `endpoint` is provided, the client exports OTLP traces for every
   * RDAP query, enabling distributed tracing in platforms like Jaeger, Tempo,
   * or any OTLP-compatible backend.
   */
  telemetry?: TelemetryOptions;

  /**
   * AbortSignal to cancel in-flight RDAP requests.
   * Pass an AbortController's signal to cancel all requests made by this client.
   * When the signal fires, in-flight requests throw QueryAbortedError.
   */
  signal?: AbortSignal;

  /**
   * Anonymous usage telemetry configuration.
   * Disabled by default. When enabled, sends anonymous usage statistics
   * (install ID, node version, platform, query types used) to rdapify.com.
   */
  usageTelemetry?: {
    enabled?: boolean;
    endpoint?: string;
  };
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
    dnsRebinding: false,
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
  debug: {
    enabled: false,
  },
  userAgent: 'RDAPify/0.1.8 (https://rdapify.com)',
  includeRaw: false,
  followRedirects: true,
  maxRedirects: 5,
  headers: {},
  bootstrapUrl: 'https://data.iana.org/rdap',
  middleware: {},
  deduplication: false,
  backend: 'auto',
  bootstrap: {
    customServers: [],
    ttl: 86400,
    fallback: true,
  },
  http2: false,
  telemetry: {
    enabled: false,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signal: undefined as any,
  usageTelemetry: {
    enabled: false,
  },
};
