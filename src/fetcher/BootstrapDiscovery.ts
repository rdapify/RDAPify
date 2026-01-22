/**
 * IANA Bootstrap service for RDAP server discovery
 * @module fetcher/BootstrapDiscovery
 */

import type { QueryType } from '../types';
import { NoServerFoundError, NetworkError } from '../types/errors';
import { extractTLD } from '../utils/helpers';
import { Fetcher } from './Fetcher';

/**
 * Bootstrap service entry
 */
interface BootstrapEntry {
  patterns: string[];
  servers: string[];
}

/**
 * Bootstrap service response
 */
interface BootstrapResponse {
  version: string;
  publication: string;
  description: string;
  services: Array<[string[], string[]]>;
}

/**
 * IANA Bootstrap discovery service
 */
export class BootstrapDiscovery {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private cache: Map<string, BootstrapEntry[]>;
  private cacheExpiry: Map<string, number>;
  private readonly cacheTTL: number = 86400000; // 24 hours

  constructor(baseUrl: string = 'https://data.iana.org/rdap', fetcher?: Fetcher) {
    this.baseUrl = baseUrl;
    this.fetcher = fetcher || new Fetcher();
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  /**
   * Discovers RDAP server URL for a domain
   */
  async discoverDomain(domain: string): Promise<string> {
    const tld = extractTLD(domain);
    const entries = await this.getBootstrapData('dns');

    for (const entry of entries) {
      if (entry.patterns.includes(tld.toLowerCase())) {
        if (entry.servers.length === 0) {
          throw new NoServerFoundError(`No RDAP server found for TLD: ${tld}`, { domain, tld });
        }
        return entry.servers[0]; // Return first server
      }
    }

    throw new NoServerFoundError(`No RDAP server found for domain: ${domain}`, { domain, tld });
  }

  /**
   * Discovers RDAP server URL for an IPv4 address
   */
  async discoverIPv4(ip: string): Promise<string> {
    const entries = await this.getBootstrapData('ipv4');

    // Find matching CIDR range
    for (const entry of entries) {
      for (const pattern of entry.patterns) {
        if (this.ipMatchesCIDR(ip, pattern)) {
          if (entry.servers.length === 0) {
            throw new NoServerFoundError(`No RDAP server found for IPv4: ${ip}`, { ip, pattern });
          }
          return entry.servers[0];
        }
      }
    }

    throw new NoServerFoundError(`No RDAP server found for IPv4: ${ip}`, { ip });
  }

  /**
   * Discovers RDAP server URL for an IPv6 address
   */
  async discoverIPv6(ip: string): Promise<string> {
    const entries = await this.getBootstrapData('ipv6');

    // Find matching CIDR range
    for (const entry of entries) {
      for (const pattern of entry.patterns) {
        if (this.ipMatchesCIDR(ip, pattern)) {
          if (entry.servers.length === 0) {
            throw new NoServerFoundError(`No RDAP server found for IPv6: ${ip}`, { ip, pattern });
          }
          return entry.servers[0];
        }
      }
    }

    throw new NoServerFoundError(`No RDAP server found for IPv6: ${ip}`, { ip });
  }

  /**
   * Discovers RDAP server URL for an ASN
   */
  async discoverASN(asn: number): Promise<string> {
    const entries = await this.getBootstrapData('asn');

    for (const entry of entries) {
      for (const pattern of entry.patterns) {
        const [start, end] = pattern.split('-').map((n) => parseInt(n, 10));

        if (asn >= start && asn <= end) {
          if (entry.servers.length === 0) {
            throw new NoServerFoundError(`No RDAP server found for ASN: ${asn}`, { asn, pattern });
          }
          return entry.servers[0];
        }
      }
    }

    throw new NoServerFoundError(`No RDAP server found for ASN: ${asn}`, { asn });
  }

  /**
   * Gets bootstrap data for a specific type
   */
  private async getBootstrapData(type: string): Promise<BootstrapEntry[]> {
    // Check cache
    const cached = this.cache.get(type);
    const expiry = this.cacheExpiry.get(type);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Fetch from IANA
    const url = `${this.baseUrl}/${type}.json`;

    let response: any;
    try {
      response = await this.fetcher.fetch(url);
    } catch (error) {
      throw new NetworkError(`Failed to fetch bootstrap data for ${type}`, undefined, {
        type,
        url,
        originalError: error,
      });
    }

    // Parse bootstrap response
    const bootstrapData = response as BootstrapResponse;

    if (!bootstrapData.services || !Array.isArray(bootstrapData.services)) {
      throw new NetworkError(`Invalid bootstrap data format for ${type}`, undefined, { type, url });
    }

    // Convert to internal format
    const entries: BootstrapEntry[] = bootstrapData.services.map((service) => ({
      patterns: service[0],
      servers: service[1],
    }));

    // Cache the data
    this.cache.set(type, entries);
    this.cacheExpiry.set(type, Date.now() + this.cacheTTL);

    return entries;
  }

  /**
   * Checks if an IP matches a CIDR range
   * Note: This is a simplified implementation
   */
  private ipMatchesCIDR(ip: string, cidr: string): boolean {
    // For now, just do exact match
    // TODO: Implement proper CIDR matching
    return ip === cidr || cidr.includes(ip);
  }

  /**
   * Clears bootstrap cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    size: number;
    types: string[];
  } {
    return {
      size: this.cache.size,
      types: Array.from(this.cache.keys()),
    };
  }
}
