/**
 * RDAPify - Unified, secure, high-performance RDAP client
 * 
 * A modern TypeScript library for querying RDAP (Registration Data Access Protocol)
 * servers with built-in security, caching, and privacy features.
 * 
 * @packageDocumentation
 * @module rdapify
 * @version 0.1.0-alpha.4
 * 
 * @example Basic Usage
 * ```typescript
 * import { RDAPClient } from 'rdapify';
 * 
 * const client = new RDAPClient();
 * const domain = await client.domain('example.com');
 * console.log(domain.registrar?.name);
 * ```
 * 
 * @example Advanced Configuration
 * ```typescript
 * import { RDAPClient } from 'rdapify';
 * 
 * const client = new RDAPClient({
 *   cache: { strategy: 'memory', ttl: 3600 },
 *   privacy: { redactPII: true },
 *   retry: { maxAttempts: 3 }
 * });
 * ```
 */

// ============================================================================
// Main Client Export
// ============================================================================

/**
 * Main RDAP client for querying domain, IP, and ASN information
 * 
 * @example
 * ```typescript
 * const client = new RDAPClient();
 * const domain = await client.domain('example.com');
 * ```
 */
export { RDAPClient } from './application/client';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Response types
  DomainResponse,
  IPResponse,
  ASNResponse,
  RDAPResponse,
  RDAPEvent,
  RDAPEntity,
  RDAPLink,
  RDAPRemark,
  RDAPNameserver,
  RawRDAPResponse,
  
  // Enum types
  QueryType,
  ObjectClass,
  RDAPStatus,
  EventType,
  RoleType,
  CacheStrategy,
  BackoffStrategy,
  LogLevel,
} from './shared/types';

export type {
  // Generic types
  QueryTypeLiteral,
  QueryResult,
  QueryResultMap,
  BatchQueryResult,
  TypedQueryOptions,
} from './shared/types/generics';

export type {
  // Option types
  RDAPClientOptions,
  RetryOptions,
  CacheOptions,
  SSRFProtectionOptions,
  PrivacyOptions,
  TimeoutOptions,
  LoggingOptions,
  RateLimitOptions,
} from './shared/types/options';

// ============================================================================
// Error Exports
// ============================================================================

/**
 * Error classes for handling various failure scenarios
 * 
 * @example
 * ```typescript
 * try {
 *   await client.domain('example.com');
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error('Invalid input:', error.context);
 *   }
 * }
 * ```
 */
export {
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
  
  // Type guards
  isRDAPifyError,
  isSSRFProtectionError,
  isNetworkError,
  isTimeoutError,
  isRateLimitError,
} from './shared/errors';

// ============================================================================
// Utility Exports (Advanced Usage)
// ============================================================================

/**
 * Validation and normalization utilities
 * 
 * @example
 * ```typescript
 * import { validateDomain, normalizeDomain } from 'rdapify';
 * 
 * validateDomain('example.com');  // Throws if invalid
 * const normalized = normalizeDomain('EXAMPLE.COM');  // Returns: 'example.com'
 * ```
 */
export {
  validateDomain,
  validateIP,
  validateIPv4,
  validateIPv6,
  validateASN,
  isPrivateIP,
  isLocalhost,
  isLinkLocal,
  normalizeDomain,
  normalizeIP,
  normalizeASN,
} from './shared/utils/validators';

// ============================================================================
// Interface Exports (Custom Implementations)
// ============================================================================

/**
 * Cache port interface for custom cache implementations
 * 
 * @example
 * ```typescript
 * import type { ICachePort } from 'rdapify';
 * 
 * class MyCustomCache implements ICachePort {
 *   async get(key: string) { ... }
 *   async set(key: string, value: any) { ... }
 *   // ... implement other methods
 * }
 * ```
 */
export type { ICachePort } from './core/ports';

// ============================================================================
// Version Export
// ============================================================================

/**
 * Current library version
 */
export const VERSION = '0.1.0-alpha.4';

// ============================================================================
// Service Exports (Advanced Usage)
// ============================================================================

/**
 * Batch processor for efficient multiple queries
 * 
 * @example
 * ```typescript
 * import { RDAPClient } from 'rdapify';
 * 
 * const client = new RDAPClient();
 * const batchProcessor = client.getBatchProcessor();
 * 
 * const results = await batchProcessor.processBatch([
 *   { type: 'domain', query: 'example.com' },
 *   { type: 'ip', query: '8.8.8.8' }
 * ]);
 * ```
 */
export { BatchProcessor } from './application/services/BatchProcessor';

/**
 * Rate limiter for controlling request rates
 * 
 * @example
 * ```typescript
 * import { RateLimiter } from 'rdapify';
 * 
 * const limiter = new RateLimiter({
 *   enabled: true,
 *   maxRequests: 100,
 *   windowMs: 60000
 * });
 * 
 * await limiter.checkLimit('user-id');
 * ```
 */
export { RateLimiter } from './infrastructure/http/RateLimiter';

/**
 * Connection pool for efficient HTTP connection reuse
 */
export { ConnectionPool } from './infrastructure/http/ConnectionPool';

/**
 * Metrics collector for monitoring queries
 */
export { MetricsCollector } from './infrastructure/monitoring/MetricsCollector';

/**
 * Logger for RDAP operations
 */
export { Logger } from './infrastructure/logging/Logger';

/**
 * Retry strategy with circuit breaker
 */
export { RetryStrategy } from './infrastructure/http/RetryStrategy';

/**
 * Query priority queue for managing execution order
 */
export { QueryPriorityQueue } from './application/services/QueryPriority';

/**
 * Persistent cache for surviving restarts
 */
export { PersistentCache } from './infrastructure/cache/PersistentCache';

/**
 * Enhanced validators with IDN support
 */
export {
  validateIdnDomain,
  validateIpv6WithZone,
  validateAsnRange,
  isIdnDomain,
  isPunycodeDomain,
  idnToAscii,
  asciiToIdn,
} from './shared/utils/enhanced-validators';

/**
 * Authentication manager for RDAP requests
 */
export { AuthenticationManager } from './infrastructure/http/AuthenticationManager';
export type { AuthenticationOptions, AuthType, OAuth2Options } from './infrastructure/http/AuthenticationManager';

/**
 * Proxy manager for RDAP requests
 */
export { ProxyManager } from './infrastructure/http/ProxyManager';
export type { ProxyOptions, ProxyProtocol } from './infrastructure/http/ProxyManager';

/**
 * Compression manager for requests/responses
 */
export { CompressionManager } from './infrastructure/http/CompressionManager';
export type { CompressionOptions, CompressionType } from './infrastructure/http/CompressionManager';

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export - RDAPClient class
 * 
 * @example
 * ```typescript
 * import RDAPClient from 'rdapify';
 * 
 * const client = new RDAPClient();
 * ```
 */
import { RDAPClient as RDAPClientClass } from './application/client';
export default RDAPClientClass;
