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
import type { DomainResponse, IPResponse, ASNResponse, NameserverResponse, EntityResponse } from '../../shared/types';
import { generateCacheKey } from '../../shared/utils/helpers';
import {
  validateDomain,
  validateIP,
  validateASN,
  validateNameserver,
  validateEntityHandle,
  normalizeDomain,
  normalizeIP,
  normalizeASN,
  normalizeNameserver,
  normalizeEntityHandle,
} from '../../shared/utils/validators';
import type { MiddlewareManager } from '../hooks/MiddlewareHooks';
import type { QueryDeduplicator } from '../deduplication/QueryDeduplicator';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchWithRetry: (url: string) => Promise<any>;
  rateLimiter?: RateLimiter;
  metricsCollector?: MetricsCollector;
  logger?: Logger;
  middleware?: MiddlewareManager;
  deduplicator?: QueryDeduplicator;
  debugEnabled: boolean;
  debugLogger?: {
    debug: (message: string, metadata?: Record<string, unknown>) => void;
    info: (message: string, metadata?: Record<string, unknown>) => void;
    warn: (message: string, metadata?: Record<string, unknown>) => void;
    error: (message: string, metadata?: Record<string, unknown>) => void;
  };
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

    // Validate and normalize early so we can build context / cache key
    validateDomain(domain);
    const normalized = normalizeDomain(domain);
    const cacheKey = generateCacheKey('domain', normalized);

    const baseCtx = {
      queryType: 'domain' as const,
      query: domain,
      normalized,
      startTime,
    };

    // beforeQuery hook
    await this.config.middleware?.runBeforeQuery(baseCtx);

    try {
      // Check cache
      const cached = await this.config.cache.get(cacheKey);

      if (cached && cached.objectClass === 'domain') {
        this.config.logger?.logCache('hit', cacheKey);
        if (this.config.debugEnabled && this.config.debugLogger) {
          this.config.debugLogger.debug('Cache hit', {
            queryType: 'domain',
            query: normalized,
            cacheKey,
          });
        }
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

        // Cache hit hook
        await this.config.middleware?.runOnCacheHit({ ...baseCtx, cached: true });

        this.config.logger?.logResponse('domain', normalized, true, duration);
        const result = this.config.piiRedactor.redact(cached) as DomainResponse;

        // afterQuery hook
        await this.config.middleware?.runAfterQuery({
          ...baseCtx,
          duration,
          result,
          fromCache: true,
        });

        return result;
      }

      this.config.logger?.logCache('miss', cacheKey);
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.debug('Cache miss', {
          queryType: 'domain',
          query: normalized,
          cacheKey,
        });
      }

      // Cache miss hook
      await this.config.middleware?.runOnCacheMiss({ ...baseCtx, cached: false });

      // Fetch + normalize (with optional deduplication)
      const fetchAndNormalize = async (): Promise<DomainResponse> => {
        // Discover RDAP server
        const serverUrl = await this.config.bootstrap.discoverDomain(normalized);
        this.config.logger?.debug(`Discovered server: ${serverUrl}`);
        if (this.config.debugEnabled && this.config.debugLogger) {
          this.config.debugLogger.debug('RDAP server discovered', {
            queryType: 'domain',
            query: normalized,
            serverUrl,
          });
        }

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

        return response;
      };

      const response = this.config.deduplicator
        ? await this.config.deduplicator.deduplicate(cacheKey, fetchAndNormalize)
        : await fetchAndNormalize();

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
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.debug('Request completed', {
          queryType: 'domain',
          query: normalized,
          durationMs: duration,
        });
      }

      // Redact PII
      const result = this.config.piiRedactor.redact(response) as DomainResponse;

      // afterQuery hook
      await this.config.middleware?.runAfterQuery({
        ...baseCtx,
        duration,
        result,
        fromCache: false,
      });

      return result;
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
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.error('Request failed', {
          queryType: 'domain',
          query: domain,
          durationMs: duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : 'Unknown',
        });
      }

      // onError hook
      await this.config.middleware?.runOnError({
        ...baseCtx,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
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

    // Validate and normalize early so we can build context / cache key
    const version = validateIP(ip);
    const normalized = normalizeIP(ip);
    const cacheKey = generateCacheKey('ip', normalized);

    const baseCtx = {
      queryType: 'ip' as const,
      query: ip,
      normalized,
      startTime,
    };

    // beforeQuery hook
    await this.config.middleware?.runBeforeQuery(baseCtx);

    try {
      // Check cache
      const cached = await this.config.cache.get(cacheKey);

      if (cached && cached.objectClass === 'ip network') {
        this.config.logger?.logCache('hit', cacheKey);
        if (this.config.debugEnabled && this.config.debugLogger) {
          this.config.debugLogger.debug('Cache hit', {
            queryType: 'ip',
            query: normalized,
            cacheKey,
          });
        }
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

        // Cache hit hook
        await this.config.middleware?.runOnCacheHit({ ...baseCtx, cached: true });

        this.config.logger?.logResponse('ip', normalized, true, duration);
        const result = this.config.piiRedactor.redact(cached) as IPResponse;

        // afterQuery hook
        await this.config.middleware?.runAfterQuery({
          ...baseCtx,
          duration,
          result,
          fromCache: true,
        });

        return result;
      }

      this.config.logger?.logCache('miss', cacheKey);
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.debug('Cache miss', {
          queryType: 'ip',
          query: normalized,
          cacheKey,
        });
      }

      // Cache miss hook
      await this.config.middleware?.runOnCacheMiss({ ...baseCtx, cached: false });

      // Fetch + normalize (with optional deduplication)
      const fetchAndNormalize = async (): Promise<IPResponse> => {
        // Discover RDAP server
        const serverUrl =
          version === 'v4'
            ? await this.config.bootstrap.discoverIPv4(normalized)
            : await this.config.bootstrap.discoverIPv6(normalized);
        this.config.logger?.debug(`Discovered server: ${serverUrl}`);
        if (this.config.debugEnabled && this.config.debugLogger) {
          this.config.debugLogger.debug('RDAP server discovered', {
            queryType: 'ip',
            query: normalized,
            serverUrl,
          });
        }

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

        return response;
      };

      const response = this.config.deduplicator
        ? await this.config.deduplicator.deduplicate(cacheKey, fetchAndNormalize)
        : await fetchAndNormalize();

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
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.debug('Request completed', {
          queryType: 'ip',
          query: normalized,
          durationMs: duration,
        });
      }

      // Redact PII
      const result = this.config.piiRedactor.redact(response) as IPResponse;

      // afterQuery hook
      await this.config.middleware?.runAfterQuery({
        ...baseCtx,
        duration,
        result,
        fromCache: false,
      });

      return result;
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
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.error('Request failed', {
          queryType: 'ip',
          query: ip,
          durationMs: duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : 'Unknown',
        });
      }

      // onError hook
      await this.config.middleware?.runOnError({
        ...baseCtx,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
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

    // Validate and normalize early so we can build context / cache key
    const asnNumber = validateASN(asn);
    const normalized = normalizeASN(asnNumber);
    const cacheKey = generateCacheKey('asn', normalized);

    const baseCtx = {
      queryType: 'asn' as const,
      query: asnStr,
      normalized,
      startTime,
    };

    // beforeQuery hook
    await this.config.middleware?.runBeforeQuery(baseCtx);

    try {
      // Check cache
      const cached = await this.config.cache.get(cacheKey);

      if (cached && cached.objectClass === 'autnum') {
        this.config.logger?.logCache('hit', cacheKey);
        if (this.config.debugEnabled && this.config.debugLogger) {
          this.config.debugLogger.debug('Cache hit', {
            queryType: 'asn',
            query: normalized,
            cacheKey,
          });
        }
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

        // Cache hit hook
        await this.config.middleware?.runOnCacheHit({ ...baseCtx, cached: true });

        this.config.logger?.logResponse('asn', normalized, true, duration);
        const result = this.config.piiRedactor.redact(cached) as ASNResponse;

        // afterQuery hook
        await this.config.middleware?.runAfterQuery({
          ...baseCtx,
          duration,
          result,
          fromCache: true,
        });

        return result;
      }

      this.config.logger?.logCache('miss', cacheKey);
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.debug('Cache miss', {
          queryType: 'asn',
          query: normalized,
          cacheKey,
        });
      }

      // Cache miss hook
      await this.config.middleware?.runOnCacheMiss({ ...baseCtx, cached: false });

      // Fetch + normalize (with optional deduplication)
      const fetchAndNormalize = async (): Promise<ASNResponse> => {
        // Discover RDAP server
        const serverUrl = await this.config.bootstrap.discoverASN(asnNumber);
        this.config.logger?.debug(`Discovered server: ${serverUrl}`);
        if (this.config.debugEnabled && this.config.debugLogger) {
          this.config.debugLogger.debug('RDAP server discovered', {
            queryType: 'asn',
            query: normalized,
            serverUrl,
          });
        }

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

        return response;
      };

      const response = this.config.deduplicator
        ? await this.config.deduplicator.deduplicate(cacheKey, fetchAndNormalize)
        : await fetchAndNormalize();

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
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.debug('Request completed', {
          queryType: 'asn',
          query: normalized,
          durationMs: duration,
        });
      }

      // Redact PII
      const result = this.config.piiRedactor.redact(response) as ASNResponse;

      // afterQuery hook
      await this.config.middleware?.runAfterQuery({
        ...baseCtx,
        duration,
        result,
        fromCache: false,
      });

      return result;
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
      if (this.config.debugEnabled && this.config.debugLogger) {
        this.config.debugLogger.error('Request failed', {
          queryType: 'asn',
          query: asnStr,
          durationMs: duration,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : 'Unknown',
        });
      }

      // onError hook
      await this.config.middleware?.runOnError({
        ...baseCtx,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
      });

      throw error;
    }
  }

  /**
   * Executes a nameserver query
   */
  async queryNameserver(nameserver: string): Promise<NameserverResponse> {
    const startTime = Date.now();

    this.config.logger?.logRequest('nameserver', nameserver);

    if (this.config.rateLimiter) {
      await this.config.rateLimiter.checkLimit();
    }

    validateNameserver(nameserver);
    const normalized = normalizeNameserver(nameserver);
    const cacheKey = generateCacheKey('nameserver', normalized);

    const baseCtx = {
      queryType: 'nameserver' as const,
      query: nameserver,
      normalized,
      startTime,
    };

    await this.config.middleware?.runBeforeQuery(baseCtx);

    try {
      const cached = await this.config.cache.get(cacheKey);

      if (cached && cached.objectClass === 'nameserver') {
        this.config.logger?.logCache('hit', cacheKey);
        const duration = Date.now() - startTime;

        this.config.metricsCollector?.record({
          type: 'nameserver',
          query: normalized,
          success: true,
          duration,
          cached: true,
          timestamp: Date.now(),
        });

        await this.config.middleware?.runOnCacheHit({ ...baseCtx, cached: true });
        this.config.logger?.logResponse('nameserver', normalized, true, duration);
        const result = this.config.piiRedactor.redact(cached) as NameserverResponse;

        await this.config.middleware?.runAfterQuery({
          ...baseCtx,
          duration,
          result,
          fromCache: true,
        });

        return result;
      }

      this.config.logger?.logCache('miss', cacheKey);
      await this.config.middleware?.runOnCacheMiss({ ...baseCtx, cached: false });

      const fetchAndNormalize = async (): Promise<NameserverResponse> => {
        const serverUrl = await this.config.bootstrap.discoverNameserver(normalized);
        this.config.logger?.debug(`Discovered server: ${serverUrl}`);

        const queryUrl = `${serverUrl}/nameserver/${normalized}`;
        const raw = await this.config.fetchWithRetry(queryUrl);

        const response = this.config.normalizer.normalize(
          raw,
          normalized,
          serverUrl,
          false,
          this.config.includeRaw
        ) as NameserverResponse;

        await this.config.cache.set(cacheKey, response);
        this.config.logger?.logCache('set', cacheKey);

        return response;
      };

      const response = this.config.deduplicator
        ? await this.config.deduplicator.deduplicate(cacheKey, fetchAndNormalize)
        : await fetchAndNormalize();

      const duration = Date.now() - startTime;

      this.config.metricsCollector?.record({
        type: 'nameserver',
        query: normalized,
        success: true,
        duration,
        cached: false,
        timestamp: Date.now(),
      });

      this.config.logger?.logResponse('nameserver', normalized, true, duration);
      const result = this.config.piiRedactor.redact(response) as NameserverResponse;

      await this.config.middleware?.runAfterQuery({
        ...baseCtx,
        duration,
        result,
        fromCache: false,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.config.metricsCollector?.record({
        type: 'nameserver',
        query: nameserver,
        success: false,
        duration,
        cached: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.name : 'Unknown',
      });

      this.config.logger?.logResponse('nameserver', nameserver, false, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.config.middleware?.runOnError({
        ...baseCtx,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
      });

      throw error;
    }
  }

  /**
   * Executes an entity query.
   * Requires an explicit serverUrl since there is no global IANA bootstrap for entities.
   */
  async queryEntity(handle: string, serverUrl: string): Promise<EntityResponse> {
    const startTime = Date.now();

    this.config.logger?.logRequest('entity', handle);

    if (this.config.rateLimiter) {
      await this.config.rateLimiter.checkLimit();
    }

    validateEntityHandle(handle);
    const normalized = normalizeEntityHandle(handle);
    const cacheKey = generateCacheKey('entity', `${serverUrl}:${normalized}`);

    const baseCtx = {
      queryType: 'entity' as const,
      query: handle,
      normalized,
      startTime,
    };

    await this.config.middleware?.runBeforeQuery(baseCtx);

    try {
      const cached = await this.config.cache.get(cacheKey);

      if (cached && cached.objectClass === 'entity') {
        this.config.logger?.logCache('hit', cacheKey);
        const duration = Date.now() - startTime;

        this.config.metricsCollector?.record({
          type: 'entity',
          query: normalized,
          success: true,
          duration,
          cached: true,
          timestamp: Date.now(),
        });

        await this.config.middleware?.runOnCacheHit({ ...baseCtx, cached: true });
        this.config.logger?.logResponse('entity', normalized, true, duration);
        const result = this.config.piiRedactor.redact(cached) as EntityResponse;

        await this.config.middleware?.runAfterQuery({
          ...baseCtx,
          duration,
          result,
          fromCache: true,
        });

        return result;
      }

      this.config.logger?.logCache('miss', cacheKey);
      await this.config.middleware?.runOnCacheMiss({ ...baseCtx, cached: false });

      const fetchAndNormalize = async (): Promise<EntityResponse> => {
        const queryUrl = `${serverUrl}/entity/${normalized}`;
        const raw = await this.config.fetchWithRetry(queryUrl);

        const response = this.config.normalizer.normalize(
          raw,
          normalized,
          serverUrl,
          false,
          this.config.includeRaw
        ) as EntityResponse;

        await this.config.cache.set(cacheKey, response);
        this.config.logger?.logCache('set', cacheKey);

        return response;
      };

      const response = this.config.deduplicator
        ? await this.config.deduplicator.deduplicate(cacheKey, fetchAndNormalize)
        : await fetchAndNormalize();

      const duration = Date.now() - startTime;

      this.config.metricsCollector?.record({
        type: 'entity',
        query: normalized,
        success: true,
        duration,
        cached: false,
        timestamp: Date.now(),
      });

      this.config.logger?.logResponse('entity', normalized, true, duration);
      const result = this.config.piiRedactor.redact(response) as EntityResponse;

      await this.config.middleware?.runAfterQuery({
        ...baseCtx,
        duration,
        result,
        fromCache: false,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.config.metricsCollector?.record({
        type: 'entity',
        query: handle,
        success: false,
        duration,
        cached: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.name : 'Unknown',
      });

      this.config.logger?.logResponse('entity', handle, false, duration, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.config.middleware?.runOnError({
        ...baseCtx,
        duration,
        error: error instanceof Error ? error : new Error(String(error)),
        fromCache: false,
      });

      throw error;
    }
  }
}
