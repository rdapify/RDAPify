/**
 * IANA Bootstrap service for RDAP server discovery
 * @module fetcher/BootstrapDiscovery
 */

import * as ipaddr from 'ipaddr.js';

import { NoServerFoundError, NetworkError } from '../../shared/errors';
import { extractTLD } from '../../shared/utils/helpers';
import type { BootstrapOptions } from '../../shared/types/options';

import { Fetcher } from './Fetcher';
import type { IFetcherPort } from '../../core/ports';

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
/**
 * Regional IANA bootstrap mirror URLs.
 * When `bootstrap.regions` is configured, the client tries each regional URL
 * in the provided order before falling back to the primary IANA endpoint.
 */
const REGIONAL_BOOTSTRAP_URLS: Record<string, string> = {
  us: 'https://data.iana.org/rdap',
  eu: 'https://data.iana.org/rdap',  // IANA CDN serves EU requests
  ap: 'https://data.iana.org/rdap',  // IANA CDN serves AP requests
};

export class BootstrapDiscovery {
  private readonly fetcher: IFetcherPort;
  private cache: Map<string, BootstrapEntry[]>;
  private cacheExpiry: Map<string, number>;
  private readonly cacheTTL: number;
  private readonly customServersMap: Map<string, string>;
  private readonly fallback: boolean;
  private readonly regionalUrls: string[];

  constructor(baseUrl: string = 'https://data.iana.org/rdap', fetcher?: IFetcherPort, options?: BootstrapOptions) {
    this.fetcher = fetcher || new Fetcher();
    this.cache = new Map();
    this.cacheExpiry = new Map();
    // TTL in seconds → ms; default 24h
    this.cacheTTL = ((options?.ttl ?? 86400) * 1000);
    this.fallback = options?.fallback ?? true;
    this.customServersMap = new Map(
      (options?.customServers ?? []).map(({ tld, url }) => [tld.toLowerCase(), url])
    );

    // Build ordered list of bootstrap URLs (regional mirrors first, then primary)
    const regionUrls = (options?.regions ?? [])
      .map((r) => REGIONAL_BOOTSTRAP_URLS[r])
      .filter((url): url is string => Boolean(url));
    // De-duplicate while preserving order
    const seen = new Set<string>();
    this.regionalUrls = [...regionUrls, baseUrl].filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });

    // Suppress unused parameter lint — baseUrl is the default for regionalUrls
    void baseUrl;
  }

  /**
   * Discovers RDAP server URL for a domain.
   * Custom servers (if configured) take priority over IANA bootstrap.
   */
  async discoverDomain(domain: string): Promise<string> {
    const tld = extractTLD(domain);
    const tldKey = tld.toLowerCase();

    // Check custom servers first
    const custom = this.customServersMap.get(tldKey);
    if (custom) return custom;

    // No custom server — fall back to IANA (unless disabled)
    if (!this.fallback) {
      throw new NoServerFoundError(`No RDAP server found for TLD: ${tld}`, { domain, tld });
    }

    const entries = await this.getBootstrapData('dns');

    for (const entry of entries) {
      if (entry.patterns.includes(tldKey)) {
        if (entry.servers.length === 0 || !entry.servers[0]) {
          throw new NoServerFoundError(`No RDAP server found for TLD: ${tld}`, { domain, tld });
        }
        return entry.servers[0];
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
          if (entry.servers.length === 0 || !entry.servers[0]) {
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
          if (entry.servers.length === 0 || !entry.servers[0]) {
            throw new NoServerFoundError(`No RDAP server found for IPv6: ${ip}`, { ip, pattern });
          }
          return entry.servers[0];
        }
      }
    }

    throw new NoServerFoundError(`No RDAP server found for IPv6: ${ip}`, { ip });
  }

  /**
   * Discovers RDAP server URL for a nameserver hostname.
   * Uses DNS TLD bootstrap — the nameserver's TLD determines the registry.
   * e.g., "ns1.example.com" → TLD "com" → Verisign RDAP server
   * Custom servers (if configured) take priority over IANA bootstrap.
   */
  async discoverNameserver(nameserver: string): Promise<string> {
    const tld = extractTLD(nameserver);
    const tldKey = tld.toLowerCase();

    // Check custom servers first
    const custom = this.customServersMap.get(tldKey);
    if (custom) return custom;

    if (!this.fallback) {
      throw new NoServerFoundError(`No RDAP server found for nameserver TLD: ${tld}`, {
        nameserver,
        tld,
      });
    }

    const entries = await this.getBootstrapData('dns');

    for (const entry of entries) {
      if (entry.patterns.includes(tldKey)) {
        if (entry.servers.length === 0 || !entry.servers[0]) {
          throw new NoServerFoundError(`No RDAP server found for nameserver TLD: ${tld}`, {
            nameserver,
            tld,
          });
        }
        return entry.servers[0];
      }
    }

    throw new NoServerFoundError(`No RDAP server found for nameserver: ${nameserver}`, {
      nameserver,
      tld,
    });
  }

  /**
   * Discovers RDAP server URL for an ASN
   */
  async discoverASN(asn: number): Promise<string> {
    const entries = await this.getBootstrapData('asn');

    for (const entry of entries) {
      for (const pattern of entry.patterns) {
        const parts = pattern.split('-').map((n) => parseInt(n, 10));
        const start = parts[0];
        const end = parts[1];

        // Validate parsed integers to prevent NaN comparison issues
        if (start === undefined || end === undefined || isNaN(start) || isNaN(end)) {
          continue;
        }

        if (asn >= start && asn <= end) {
          if (entry.servers.length === 0 || !entry.servers[0]) {
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

    // Try each regional URL in order, fall back to primary on network error
    let response: any;
    let lastError: unknown;
    let lastUrl = '';
    for (const base of this.regionalUrls) {
      const url = `${base}/${type}.json`;
      lastUrl = url;
      try {
        response = await this.fetcher.fetch(url);
        break; // success — stop trying
      } catch (error) {
        lastError = error;
        // continue to next mirror
      }
    }

    if (response === undefined) {
      throw new NetworkError(`Failed to fetch bootstrap data for ${type}`, undefined, {
        type,
        url: lastUrl,
        originalError: lastError,
      });
    }

    // Parse bootstrap response
    const bootstrapData = response as BootstrapResponse;

    if (!bootstrapData.services || !Array.isArray(bootstrapData.services)) {
      throw new NetworkError(`Invalid bootstrap data format for ${type}`, undefined, { type, url: lastUrl });
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
   * Uses ipaddr.js for proper CIDR matching with fail-closed behavior
   */
  private ipMatchesCIDR(ip: string, cidr: string): boolean {
    try {
      // If CIDR doesn't contain '/', treat as exact IP match
      if (!cidr.includes('/')) {
        return ip === cidr;
      }

      // Parse and validate IP address
      const addr = ipaddr.process(ip);
      
      // Parse and validate CIDR range
      const range = ipaddr.parseCIDR(cidr);
      
      // Check if IP matches the CIDR range
      return addr.match(range);
    } catch {
      // Fail-closed: if parsing fails, return false
      return false;
    }
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
