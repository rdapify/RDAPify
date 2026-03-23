/**
 * RDAP response normalizer
 * @module normalizer/Normalizer
 */

import type {
  RawRDAPResponse,
  DomainResponse,
  IPResponse,
  ASNResponse,
  NameserverResponse,
  EntityResponse,
  RDAPResponse,
  RDAPEvent,
  EventType,
} from '../../shared/types';
import { ParseError } from '../../shared/errors';

/**
 * RFC 7483 standard fields — all other top-level fields are vendor extensions.
 */
const RFC7483_STANDARD_FIELDS = new Set([
  'objectClassName', 'handle', 'ldhName', 'unicodeName', 'status', 'entities',
  'events', 'links', 'remarks', 'nameservers', 'secureDNS', 'registrar',
  'ipVersion', 'startAddress', 'endAddress', 'cidr0_cidrs', 'name', 'type',
  'country', 'startAutnum', 'endAutnum', 'port43', 'publicIds', 'network',
  'rdapConformance', 'notices', 'vcardArray', 'roles', 'ipAddresses',
]);

/**
 * Extracts non-standard extension fields from a raw RDAP response.
 */
function extractExtensions(raw: RawRDAPResponse): Record<string, unknown> | undefined {
  const extensions: Record<string, unknown> = {};
  let hasExtensions = false;

  for (const key of Object.keys(raw)) {
    if (!RFC7483_STANDARD_FIELDS.has(key)) {
      extensions[key] = raw[key];
      hasExtensions = true;
    }
  }

  return hasExtensions ? extensions : undefined;
}

/**
 * Normalizes RDAP responses to a consistent format
 */
export class Normalizer {
  /**
   * Normalizes a raw RDAP response
   */
  normalize(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean = false,
    includeRaw: boolean = false
  ): RDAPResponse {
    const objectClass = raw.objectClassName;

    if (!objectClass) {
      throw new ParseError('Missing objectClassName in RDAP response', { raw });
    }

    switch (objectClass) {
      case 'domain':
        return this.normalizeDomain(raw, query, source, cached, includeRaw);

      case 'ip network':
        return this.normalizeIP(raw, query, source, cached, includeRaw);

      case 'autnum':
        return this.normalizeASN(raw, query, source, cached, includeRaw);

      case 'nameserver':
        return this.normalizeNameserver(raw, query, source, cached, includeRaw);

      case 'entity':
        return this.normalizeEntity(raw, query, source, cached, includeRaw);

      default:
        throw new ParseError(`Unsupported object class: ${objectClass}`, { objectClass, raw });
    }
  }

  /**
   * Normalizes a domain RDAP response
   */
  private normalizeDomain(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): DomainResponse {
    const response: DomainResponse = {
      query,
      objectClass: 'domain',
      handle: raw.handle,
      ldhName: raw['ldhName'],
      unicodeName: raw['unicodeName'],
      status: raw['status'] || [],
      nameservers: this.extractNameservers(raw),
      entities: raw['entities'] || [],
      events: this.normalizeEvents(raw['events'] || []),
      registrar: this.extractRegistrar(raw),
      links: raw['links'] || [],
      remarks: raw['remarks'] || [],
      extensions: extractExtensions(raw),
      metadata: {
        source,
        timestamp: new Date().toISOString(),
        cached,
      },
    };

    if (includeRaw) {
      response.raw = raw;
    }

    return response;
  }

  /**
   * Normalizes an IP RDAP response
   */
  private normalizeIP(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): IPResponse {
    const response: IPResponse = {
      query,
      objectClass: 'ip network',
      handle: raw.handle,
      startAddress: raw['startAddress'],
      endAddress: raw['endAddress'],
      ipVersion: raw['ipVersion'],
      name: raw['name'],
      type: raw['type'],
      country: raw['country'],
      status: raw['status'] || [],
      entities: raw['entities'] || [],
      events: this.normalizeEvents(raw['events'] || []),
      links: raw['links'] || [],
      remarks: raw['remarks'] || [],
      extensions: extractExtensions(raw),
      metadata: {
        source,
        timestamp: new Date().toISOString(),
        cached,
      },
    };

    if (includeRaw) {
      response.raw = raw;
    }

    return response;
  }

  /**
   * Normalizes an ASN RDAP response
   */
  private normalizeASN(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): ASNResponse {
    const response: ASNResponse = {
      query,
      objectClass: 'autnum',
      handle: raw.handle,
      startAutnum: raw['startAutnum'],
      endAutnum: raw['endAutnum'],
      name: raw['name'],
      type: raw['type'],
      country: raw['country'],
      status: raw['status'] || [],
      entities: raw['entities'] || [],
      events: this.normalizeEvents(raw['events'] || []),
      links: raw['links'] || [],
      remarks: raw['remarks'] || [],
      extensions: extractExtensions(raw),
      metadata: {
        source,
        timestamp: new Date().toISOString(),
        cached,
      },
    };

    if (includeRaw) {
      response.raw = raw;
    }

    return response;
  }

  /**
   * Normalizes a nameserver RDAP response
   */
  private normalizeNameserver(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): NameserverResponse {
    const ipAddresses = raw['ipAddresses'];
    const response: NameserverResponse = {
      query,
      objectClass: 'nameserver',
      handle: raw.handle,
      ldhName: raw['ldhName'],
      unicodeName: raw['unicodeName'],
      status: raw['status'] || [],
      ipAddresses: ipAddresses
        ? {
            v4: ipAddresses.v4 || [],
            v6: ipAddresses.v6 || [],
          }
        : undefined,
      entities: raw['entities'] || [],
      events: this.normalizeEvents(raw['events'] || []),
      links: raw['links'] || [],
      remarks: raw['remarks'] || [],
      extensions: extractExtensions(raw),
      metadata: {
        source,
        timestamp: new Date().toISOString(),
        cached,
      },
    };

    if (includeRaw) {
      response.raw = raw;
    }

    return response;
  }

  /**
   * Normalizes an entity RDAP response
   */
  private normalizeEntity(
    raw: RawRDAPResponse,
    query: string,
    source: string,
    cached: boolean,
    includeRaw: boolean
  ): EntityResponse {
    const response: EntityResponse = {
      query,
      objectClass: 'entity',
      handle: raw.handle,
      vcardArray: raw['vcardArray'],
      roles: raw['roles'] || [],
      status: raw['status'] || [],
      entities: raw['entities'] || [],
      events: this.normalizeEvents(raw['events'] || []),
      links: raw['links'] || [],
      remarks: raw['remarks'] || [],
      extensions: extractExtensions(raw),
      metadata: {
        source,
        timestamp: new Date().toISOString(),
        cached,
      },
    };

    if (includeRaw) {
      response.raw = raw;
    }

    return response;
  }

  /**
   * Extracts nameserver list from domain response
   */
  private extractNameservers(raw: RawRDAPResponse): string[] {
    const nameservers = raw['nameservers'];
    if (!nameservers || !Array.isArray(nameservers)) {
      return [];
    }

    return nameservers
      .map((ns: any) => {
        if (!ns || typeof ns !== 'object') {
          return undefined;
        }
        return ns.ldhName || ns.unicodeName;
      })
      .filter((name: string | undefined): name is string => name !== undefined && name !== '');
  }

  /**
   * Extracts registrar information from entities
   */
  private extractRegistrar(raw: RawRDAPResponse): DomainResponse['registrar'] {
    const entities = raw['entities'];
    if (!entities || !Array.isArray(entities)) {
      return undefined;
    }

    // Find entity with registrar role
    const registrar = entities.find(
      (entity: any) => entity && typeof entity === 'object' && entity.roles?.includes('registrar')
    );

    if (!registrar) {
      return undefined;
    }

    // Extract registrar name from vCard
    let name: string | undefined;
    if (registrar.vcardArray && Array.isArray(registrar.vcardArray) && registrar.vcardArray.length >= 2) {
      const vcard = registrar.vcardArray[1];
      if (Array.isArray(vcard)) {
        const fnField = vcard.find((field: any) => Array.isArray(field) && field[0] === 'fn');
        if (fnField && Array.isArray(fnField) && fnField.length >= 4) {
          name = fnField[3];
        }
      }
    }

    // Extract URL from links
    let url: string | undefined;
    if (registrar.links && Array.isArray(registrar.links)) {
      const selfLink = registrar.links.find((link: any) => link && link.rel === 'self');
      if (selfLink) {
        url = selfLink.href;
      }
    }

    return {
      name,
      handle: registrar.handle,
      url,
    };
  }

  /**
   * Normalizes RDAP events array
   * Converts eventAction to type for consistency
   */
  private normalizeEvents(events: any[]): RDAPEvent[] {
    if (!Array.isArray(events)) {
      return [];
    }

    return events.map((event: any) => ({
      type: (event.eventAction || event.type) as EventType,
      date: event.eventDate || event.date,
      actor: event.eventActor || event.actor,
    }));
  }
}
