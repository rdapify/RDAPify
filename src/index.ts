/**
 * RDAPify - Unified, secure, high-performance RDAP client
 * @packageDocumentation
 */

// Main client
export { RDAPClient } from './client/RDAPClient';

// Types
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
} from './types';

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
} from './types/options';

// Errors
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
} from './types/errors';

// Utilities (for advanced usage)
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
} from './utils/validators';

// Cache interface (for custom implementations)
export type { ICache } from './cache/CacheManager';

// Version
export const VERSION = '0.1.0-alpha.1';

/**
 * Creates a new RDAP client with default options
 *
 * @example
 * ```typescript
 * import RDAPClient from 'rdapify';
 *
 * const client = new RDAPClient({
 *   cache: true,
 *   redactPII: true,
 * });
 *
 * const result = await client.domain('example.com');
 * ```
 */
import { RDAPClient as RDAPClientClass } from './client/RDAPClient';
export default RDAPClientClass;
