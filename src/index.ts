/**
 * RDAPify - Unified, secure, high-performance RDAP client
 * @packageDocumentation
 */

// Main client
export { RDAPClient } from './application/client';

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
} from './shared/errors';

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
} from './shared/utils/validators';

// Cache interface (for custom implementations)
export type { ICachePort } from './core/ports';

// Version
export const VERSION = '0.1.0-alpha.4';

/**
 * Default export - RDAPClient class
 */
import { RDAPClient as RDAPClientClass } from './application/client';
export default RDAPClientClass;
