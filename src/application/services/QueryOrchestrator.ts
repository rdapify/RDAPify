/**
 * Query orchestration - handles common query pattern
 * @module client/QueryOrchestrator
 * @internal
 */

import type { CacheManager } from '../../infrastructure/cache';
import type { BootstrapDiscovery, Fetcher, Normalizer } from '../../infrastructure/http';
import type { RateLimiter } from '../../infrastructure/http/RateLimiter';
import type { PIIRedactor } from '../../infrastructure/security';
import type { MetricsCollector } from '../../infrastructure/monitoring/MetricsCollector';
import type { Logger } from '../../infrastructure/logging/Logger';
import type { DomainResponse, IPResponse, ASNResponse } from '../../shared/types';
import { generateCacheKey } from '../../shared/utils/helpers';
import {
  validateDomain,
  validateIP,
  validateASN,
  normalizeDomain,
  normalizeIP,
  normalizeASN,
} from '../../shared/utils/validators';

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
  rateLimiter?: RateLimiter;
  metricsCollector?: MetricsCollector;
  logger?: Logger;
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
    const startTime = Date.now();
    
    // Log request
    this.config.logger?.logRequest('domain', domain);

    // Check rate limit
    if (this.config.rateLimiter) {
      await this.config.rateLimiter.checkLimit();
    }

    try {
      // Validate and normalize
      validateDomain(domain);
      const normalized = normalizeDomain(domain);

      // Check cache
      const cacheKey = generateCacheKey('domain', normalized);
      const cached = await this.config.cache.get(cacheKey);
      
      if (cached && cached.objectClass === 'domain') {
        this.config.logger?.logCache('hit', cacheKey);
        const duration = Date.now() - startTime;
        
        // Record metrics
        this.config.metricsCollector?.record({
          type: 'domain',
          query: normalized,
          success: true,
          duration,
          cached: true,
          timestamp: Date.now(),
        });
        
        this.config.logger?.logResponse('domain', normalized, true, duration);
        return this.config.piiRedactor.redact(cached) as DomainResponse;
      }

      this.config.logger?.logCache('miss', cacheKey);

      // Discover RDAP server
      const serverUrl = await this.config.bootstrap.discoverDomain(normalized);
      this.config.logger?.debug(`Discovered server: ${serverUrl}`);

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
      this.config.logger?.logCache('set', cacheKey);

      const duration = Date.now() - startTime;

      // Record metrics
      this.config.metricsCollector?.record({
        type: 'domain',
        query: normalized,
        success: true,
        duration,
        cached: false,
        timestamp: Date.now(),
      });

      this.config.logger?.logResponse('domain', normalized, true, duration);

      // Redact PII
      return this.config.piiRedactor.redact(response) as DomainResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failure metrics
      this.config.metricsCollector?.record({
        type: 'domain',
        query: domain,
        success: false,
        duration,
        cached: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.name : 'Unknown',
      });

      this.config.logger?.logResponse('domain', domain, false, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Executes an IP query
   */
  async queryIP(ip: string): Promise<IPResponse> {
    const startTime = Date.now();
    
    // Log request
    this.config.logger?.logRequest('ip', ip);

    // Check rate limit
    if (this.config.rateLimiter) {
      await this.config.rateLimiter.checkLimit();
    }

    try {
      // Validate and normalize
      const version = validateIP(ip);
      const normalized = normalizeIP(ip);

      // Check cache
      const cacheKey = generateCacheKey('ip', normalized);
      const cached = await this.config.cache.get(cacheKey);
      
      if (cached && cached.objectClass === 'ip network') {
        this.config.logger?.logCache('hit', cacheKey);
        const duration = Date.now() - startTime;
        
        // Record metrics
        this.config.metricsCollector?.record({
          type: 'ip',
          query: normalized,
          success: true,
          duration,
          cached: true,
          timestamp: Date.now(),
        });
        
        this.config.logger?.logResponse('ip', normalized, true, duration);
        return this.config.piiRedactor.redact(cached) as IPResponse;
      }

      this.config.logger?.logCache('miss', cacheKey);

      // Discover RDAP server
      const serverUrl =
        version === 'v4'
          ? await this.config.bootstrap.discoverIPv4(normalized)
          : await this.config.bootstrap.discoverIPv6(normalized);
      this.config.logger?.debug(`Discovered server: ${serverUrl}`);

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
      this.config.logger?.logCache('set', cacheKey);

      const duration = Date.now() - startTime;

      // Record metrics
      this.config.metricsCollector?.record({
        type: 'ip',
        query: normalized,
        success: true,
        duration,
        cached: false,
        timestamp: Date.now(),
      });

      this.config.logger?.logResponse('ip', normalized, true, duration);

      // Redact PII
      return this.config.piiRedactor.redact(response) as IPResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failure metrics
      this.config.metricsCollector?.record({
        type: 'ip',
        query: ip,
        success: false,
        duration,
        cached: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.name : 'Unknown',
      });

      this.config.logger?.logResponse('ip', ip, false, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Executes an ASN query
   */
  async queryASN(asn: string | number): Promise<ASNResponse> {
    const startTime = Date.now();
    const asnStr = typeof asn === 'number' ? `AS${asn}` : asn;
    
    // Log request
    this.config.logger?.logRequest('asn', asnStr);

    // Check rate limit
    if (this.config.rateLimiter) {
      await this.config.rateLimiter.checkLimit();
    }

    try {
      // Validate and normalize
      const asnNumber = validateASN(asn);
      const normalized = normalizeASN(asnNumber);

      // Check cache
      const cacheKey = generateCacheKey('asn', normalized);
      const cached = await this.config.cache.get(cacheKey);
      
      if (cached && cached.objectClass === 'autnum') {
        this.config.logger?.logCache('hit', cacheKey);
        const duration = Date.now() - startTime;
        
        // Record metrics
        this.config.metricsCollector?.record({
          type: 'asn',
          query: normalized,
          success: true,
          duration,
          cached: true,
          timestamp: Date.now(),
        });
        
        this.config.logger?.logResponse('asn', normalized, true, duration);
        return this.config.piiRedactor.redact(cached) as ASNResponse;
      }

      this.config.logger?.logCache('miss', cacheKey);

      // Discover RDAP server
      const serverUrl = await this.config.bootstrap.discoverASN(asnNumber);
      this.config.logger?.debug(`Discovered server: ${serverUrl}`);

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
      this.config.logger?.logCache('set', cacheKey);

      const duration = Date.now() - startTime;

      // Record metrics
      this.config.metricsCollector?.record({
        type: 'asn',
        query: normalized,
        success: true,
        duration,
        cached: false,
        timestamp: Date.now(),
      });

      this.config.logger?.logResponse('asn', normalized, true, duration);

      // Redact PII
      return this.config.piiRedactor.redact(response) as ASNResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failure metrics
      this.config.metricsCollector?.record({
        type: 'asn',
        query: asnStr,
        success: false,
        duration,
        cached: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.name : 'Unknown',
      });

      this.config.logger?.logResponse('asn', asnStr, false, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }
}
