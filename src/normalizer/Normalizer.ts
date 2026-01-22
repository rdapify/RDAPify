/**
 * RDAP response normalizer
 * @module normalizer/Normalizer
 */

import type {
  RawRDAPResponse,
  DomainResponse,
  IPResponse,
  ASNResponse,
  RDAPResponse,
  RDAPEvent,
  EventType,
} from '../types';
import { ParseError } from '../types/errors';

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
    if (!raw['nameservers'] || !Array.isArray(raw['nameservers'])) {
      return [];
    }

    return raw['nameservers']
      .map((ns: any) => ns.ldhName || ns.unicodeName)
      .filter((name: string) => name);
  }

  /**
   * Extracts registrar information from entities
   */
  private extractRegistrar(raw: RawRDAPResponse): DomainResponse['registrar'] {
    if (!raw['entities'] || !Array.isArray(raw['entities'])) {
      return undefined;
    }

    // Find entity with registrar role
    const registrar = raw['entities'].find(
      (entity: any) => entity.roles?.includes('registrar')
    );

    if (!registrar) {
      return undefined;
    }

    // Extract registrar name from vCard
    let name: string | undefined;
    if (registrar.vcardArray && Array.isArray(registrar.vcardArray)) {
      const vcard = registrar.vcardArray[1];
      if (Array.isArray(vcard)) {
        const fnField = vcard.find((field: any) => Array.isArray(field) && field[0] === 'fn');
        if (fnField?.[3]) {
          name = fnField[3];
        }
      }
    }

    // Extract URL from links
    let url: string | undefined;
    if (registrar.links && Array.isArray(registrar.links)) {
      const selfLink = registrar.links.find((link: any) => link.rel === 'self');
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
