/**
 * Core type definitions for RDAPify
 * @module types
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
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * RDAP event object
 */
export interface RDAPEvent {
  type: EventType;
  date: string;
  actor?: string;
}

/**
 * RDAP entity/contact object
 */
export interface RDAPEntity {
  handle?: string;
  roles?: RoleType[];
  vcardArray?: any[];
  publicIds?: Array<{
    type: string;
    identifier: string;
  }>;
  entities?: RDAPEntity[];
  remarks?: RDAPRemark[];
  links?: RDAPLink[];
  events?: RDAPEvent[];
  status?: RDAPStatus[];
}

/**
 * RDAP link object
 */
export interface RDAPLink {
  value?: string;
  rel?: string;
  href: string;
  hreflang?: string[];
  title?: string;
  media?: string;
  type?: string;
}

/**
 * RDAP remark/notice object
 */
export interface RDAPRemark {
  title?: string;
  type?: string;
  description?: string[];
  links?: RDAPLink[];
}

/**
 * RDAP nameserver object
 */
export interface RDAPNameserver {
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  ipAddresses?: {
    v4?: string[];
    v6?: string[];
  };
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  remarks?: RDAPRemark[];
  links?: RDAPLink[];
  events?: RDAPEvent[];
}

/**
 * Normalized RDAP response for domain queries
 */
export interface DomainResponse {
  query: string;
  objectClass: 'domain';
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  status?: RDAPStatus[];
  nameservers?: string[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  registrar?: {
    name?: string;
    handle?: string;
    url?: string;
  };
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;
  metadata: {
    source: string;
    timestamp: string;
    cached: boolean;
  };
}

/**
 * Normalized RDAP response for IP queries
 */
export interface IPResponse {
  query: string;
  objectClass: 'ip network';
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  ipVersion?: 'v4' | 'v6';
  name?: string;
  type?: string;
  country?: string;
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;
  metadata: {
    source: string;
    timestamp: string;
    cached: boolean;
  };
}

/**
 * Normalized RDAP response for ASN queries
 */
export interface ASNResponse {
  query: string;
  objectClass: 'autnum';
  handle?: string;
  startAutnum?: number;
  endAutnum?: number;
  name?: string;
  type?: string;
  country?: string;
  status?: RDAPStatus[];
  entities?: RDAPEntity[];
  events?: RDAPEvent[];
  links?: RDAPLink[];
  remarks?: RDAPRemark[];
  raw?: any;
  metadata: {
    source: string;
    timestamp: string;
    cached: boolean;
  };
}

/**
 * Union type for all RDAP responses
 */
export type RDAPResponse = DomainResponse | IPResponse | ASNResponse;

/**
 * Raw RDAP server response (before normalization)
 */
export interface RawRDAPResponse {
  objectClassName: string;
  handle?: string;
  [key: string]: any;
}
