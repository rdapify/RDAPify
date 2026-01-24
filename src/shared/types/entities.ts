/**
 * RDAP entity and related object definitions
 * @module types/entities
 */

import type { EventType, RoleType, RDAPStatus } from './enums';

/**
 * RDAP event object
 */
export interface RDAPEvent {
  type: EventType;
  date: string;
  actor?: string;
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
