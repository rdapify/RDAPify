/**
 * Enum-like type definitions for RDAPify
 * @module types/enums
 */

/**
 * RDAP query types
 */
export type QueryType = 'domain' | 'ip' | 'asn' | 'nameserver' | 'entity';

/**
 * RDAP object class types
 */
export type ObjectClass = 'domain' | 'ip network' | 'autnum' | 'nameserver' | 'entity';

/**
 * RDAP status values (RFC 7483)
 */
export type RDAPStatus =
  | 'validated'
  | 'renew prohibited'
  | 'update prohibited'
  | 'transfer prohibited'
  | 'delete prohibited'
  | 'proxy'
  | 'private'
  | 'removed'
  | 'obscured'
  | 'associated'
  | 'active'
  | 'inactive'
  | 'locked'
  | 'pending create'
  | 'pending renew'
  | 'pending transfer'
  | 'pending update'
  | 'pending delete';

/**
 * RDAP event types
 */
export type EventType =
  | 'registration'
  | 'reregistration'
  | 'last changed'
  | 'expiration'
  | 'deletion'
  | 'reinstantiation'
  | 'transfer'
  | 'locked'
  | 'unlocked';

/**
 * RDAP role types
 */
export type RoleType =
  | 'registrant'
  | 'technical'
  | 'administrative'
  | 'abuse'
  | 'billing'
  | 'registrar'
  | 'reseller'
  | 'sponsor'
  | 'proxy'
  | 'notifications'
  | 'noc';

/**
 * Cache strategy types
 */
export type CacheStrategy = 'memory' | 'redis' | 'custom' | 'none';

/**
 * Retry backoff strategies
 */
export type BackoffStrategy = 'linear' | 'exponential' | 'fixed';

/**
 * Re-export BackoffStrategy for options module
 */
export type { BackoffStrategy as BackoffStrategyType };

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
