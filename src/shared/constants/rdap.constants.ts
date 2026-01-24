/**
 * RDAP protocol constants
 * @module shared/constants
 */

/**
 * Default IANA bootstrap base URL
 */
export const DEFAULT_BOOTSTRAP_URL = 'https://data.iana.org/rdap';

/**
 * Default cache TTL (1 hour in seconds)
 */
export const DEFAULT_CACHE_TTL = 3600;

/**
 * Default cache max size
 */
export const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Bootstrap cache TTL (24 hours in milliseconds)
 */
export const BOOTSTRAP_CACHE_TTL = 86400000;

/**
 * Default user agent
 */
export const DEFAULT_USER_AGENT = 'RDAPify/0.1.0-alpha.4 (https://github.com/rdapify/rdapify)';

/**
 * RDAP content types
 */
export const RDAP_CONTENT_TYPES = [
  'application/rdap+json',
  'application/json',
] as const;

/**
 * Supported RDAP object classes
 */
export const RDAP_OBJECT_CLASSES = [
  'domain',
  'ip network',
  'autnum',
  'nameserver',
  'entity',
] as const;

/**
 * Bootstrap service types
 */
export const BOOTSTRAP_TYPES = ['dns', 'ipv4', 'ipv6', 'asn'] as const;
