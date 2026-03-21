/**
 * RDAP response type definitions
 * @module types/responses
 */

import type { RDAPStatus, RoleType } from './enums';
import type { RDAPEntity, RDAPEvent, RDAPLink, RDAPRemark } from './entities';

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
 * Normalized RDAP response for nameserver queries
 */
export interface NameserverResponse {
  query: string;
  objectClass: 'nameserver';
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  status?: RDAPStatus[];
  ipAddresses?: {
    v4?: string[];
    v6?: string[];
  };
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
 * Normalized RDAP response for entity queries
 */
export interface EntityResponse {
  query: string;
  objectClass: 'entity';
  handle?: string;
  vcardArray?: any[];
  roles?: RoleType[];
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
 * Domain availability check result
 */
export interface AvailabilityResult {
  domain: string;
  available: boolean;
  expiresAt?: Date;
}

/**
 * Union type for all RDAP responses
 */
export type RDAPResponse = DomainResponse | IPResponse | ASNResponse | NameserverResponse | EntityResponse;

/**
 * Raw RDAP server response (before normalization)
 */
export interface RawRDAPResponse {
  objectClassName: string;
  handle?: string;
  [key: string]: any;
}
