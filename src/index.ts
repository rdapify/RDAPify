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
