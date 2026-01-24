/**
 * Query orchestration - handles common query pattern
 * @module client/QueryOrchestrator
 * @internal
 */

import type { CacheManager } from '../cache/CacheManager';
import type { BootstrapDiscovery } from '../fetcher/BootstrapDiscovery';
import type { Fetcher } from '../fetcher/Fetcher';
import type { Normalizer } from '../normalizer/Normalizer';
import type { PIIRedactor } from '../normalizer/PIIRedactor';
import type { DomainResponse, IPResponse, ASNResponse } from '../types';
import { generateCacheKey } from '../utils/helpers';
import {
  validateDomain,
  validateIP,
  validateASN,
  normalizeDomain,
  normalizeIP,
  normalizeASN,
} from '../utils/validators';

/**
 * Query orchestrator configuration
 */
export interface QueryOrchestratorConfig {
  cache: CacheManager;
  bootstrap: BootstrapDiscovery;
  fetcher: Fetcher;
  normalizer: Normalizer;
  piiRedactor: PIIRedactor;
  includeRaw: boolean;
  fetchWithRetry: (url: string) => Promise<any>;
}

/**
 * Orchestrates RDAP queries with common pattern:
 * validate → cache check → discover → fetch → normalize → cache → redact
 */
export class QueryOrchestrator {
  private readonly config: QueryOrchestratorConfig;

  constructor(config: QueryOrchestratorConfig) {
    this.config = config;
  }

  /**
   * Executes a domain query
   */
  async queryDomain(domain: string): Promise<DomainResponse> {
    // Validate and normalize
    validateDomain(domain);
    const normalized = normalizeDomain(domain);

    // Check cache
    const cacheKey = generateCacheKey('domain', normalized);
    const cached = await this.config.cache.get(cacheKey);
    if (cached && cached.objectClass === 'domain') {
      return this.config.piiRedactor.redact(cached) as DomainResponse;
    }

    // Discover RDAP server
    const serverUrl = await this.config.bootstrap.discoverDomain(normalized);

    // Build query URL
    const queryUrl = `${serverUrl}/domain/${normalized}`;

    // Fetch with retry
    const raw = await this.config.fetchWithRetry(queryUrl);

    // Normalize response
    const response = this.config.normalizer.normalize(
      raw,
      normalized,
      serverUrl,
      false,
      this.config.includeRaw
    ) as DomainResponse;

    // Cache the response
    await this.config.cache.set(cacheKey, response);

    // Redact PII
    return this.config.piiRedactor.redact(response) as DomainResponse;
  }

  /**
   * Executes an IP query
   */
  async queryIP(ip: string): Promise<IPResponse> {
    // Validate and normalize
    const version = validateIP(ip);
    const normalized = normalizeIP(ip);

    // Check cache
    const cacheKey = generateCacheKey('ip', normalized);
    const cached = await this.config.cache.get(cacheKey);
    if (cached && cached.objectClass === 'ip network') {
      return this.config.piiRedactor.redact(cached) as IPResponse;
    }

    // Discover RDAP server
    const serverUrl =
      version === 'v4'
        ? await this.config.bootstrap.discoverIPv4(normalized)
        : await this.config.bootstrap.discoverIPv6(normalized);

    // Build query URL
    const queryUrl = `${serverUrl}/ip/${normalized}`;

    // Fetch with retry
    const raw = await this.config.fetchWithRetry(queryUrl);

    // Normalize response
    const response = this.config.normalizer.normalize(
      raw,
      normalized,
      serverUrl,
      false,
      this.config.includeRaw
    ) as IPResponse;

    // Cache the response
    await this.config.cache.set(cacheKey, response);

    // Redact PII
    return this.config.piiRedactor.redact(response) as IPResponse;
  }

  /**
   * Executes an ASN query
   */
  async queryASN(asn: string | number): Promise<ASNResponse> {
    // Validate and normalize
    const asnNumber = validateASN(asn);
    const normalized = normalizeASN(asnNumber);

    // Check cache
    const cacheKey = generateCacheKey('asn', normalized);
    const cached = await this.config.cache.get(cacheKey);
    if (cached && cached.objectClass === 'autnum') {
      return this.config.piiRedactor.redact(cached) as ASNResponse;
    }

    // Discover RDAP server
    const serverUrl = await this.config.bootstrap.discoverASN(asnNumber);

    // Build query URL
    const queryUrl = `${serverUrl}/autnum/${asnNumber}`;

    // Fetch with retry
    const raw = await this.config.fetchWithRetry(queryUrl);

    // Normalize response
    const response = this.config.normalizer.normalize(
      raw,
      normalized,
      serverUrl,
      false,
      this.config.includeRaw
    ) as ASNResponse;

    // Cache the response
    await this.config.cache.set(cacheKey, response);

    // Redact PII
    return this.config.piiRedactor.redact(response) as ASNResponse;
  }
}
