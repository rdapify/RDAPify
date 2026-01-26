/**
 * Main RDAP client
 * @module client/RDAPClient
 */

import { CacheManager } from '../../infrastructure/cache';
import { BootstrapDiscovery, Fetcher, Normalizer } from '../../infrastructure/http';
import { RateLimiter } from '../../infrastructure/http/RateLimiter';
import { ConnectionPool } from '../../infrastructure/http/ConnectionPool';
import { SSRFProtection, PIIRedactor } from '../../infrastructure/security';
import { MetricsCollector } from '../../infrastructure/monitoring/MetricsCollector';
import { Logger } from '../../infrastructure/logging/Logger';
import type { DomainResponse, IPResponse, ASNResponse } from '../../shared/types';
import { ValidationError } from '../../shared/errors';
import { DEFAULT_OPTIONS } from '../../shared/types/options';
import type {
  RDAPClientOptions,
  RetryOptions,
  CacheOptions,
  RateLimitOptions,
} from '../../shared/types/options';
import { deepMerge, calculateBackoff, sleep } from '../../shared/utils/helpers';
import { QueryOrchestrator } from '../services';
import { BatchProcessor } from '../services/BatchProcessor';

/**
 * Main RDAP client for querying domain, IP, and ASN information
 *
 * @example
 * ```typescript
 * const client = new RDAPClient({
 *   cache: true,
 *   redactPII: true,
 * });
 *
 * const result = await client.domain('example.com');
 * console.log(result.registrar?.name);
 * ```
 */
export class RDAPClient {
  private readonly options: Required<RDAPClientOptions>;
  private readonly cache: CacheManager;
  private readonly fetcher: Fetcher;
  private readonly ssrfProtection: SSRFProtection;
  private readonly bootstrap: BootstrapDiscovery;
  private readonly normalizer: Normalizer;
  private readonly piiRedactor: PIIRedactor;
  private readonly orchestrator: QueryOrchestrator;
  private readonly rateLimiter: RateLimiter;
  private readonly batchProcessor: BatchProcessor;
  private readonly connectionPool: ConnectionPool;
  private readonly metricsCollector: MetricsCollector;
  private readonly logger: Logger;
  constructor(options: RDAPClientOptions = {}) {
    // Merge with defaults
    this.options = this.normalizeOptions(options);

    // Initialize SSRF protection
    const ssrfOptions =
      typeof this.options.ssrfProtection === 'boolean'
        ? { enabled: this.options.ssrfProtection }
        : this.options.ssrfProtection;
    this.ssrfProtection = new SSRFProtection(ssrfOptions);

    // Initialize fetcher
    this.fetcher = new Fetcher({
      timeout:
        typeof this.options.timeout === 'number'
          ? {
              request: this.options.timeout,
              connect: this.options.timeout,
              dns: this.options.timeout,
            }
          : this.options.timeout,
      userAgent: this.options.userAgent,
      headers: this.options.headers,
      followRedirects: this.options.followRedirects,
      maxRedirects: this.options.maxRedirects,
      ssrfProtection: this.ssrfProtection,
    });

    // Initialize bootstrap discovery
    this.bootstrap = new BootstrapDiscovery(this.options.bootstrapUrl, this.fetcher);

    // Initialize cache
    const cacheOptions =
      typeof this.options.cache === 'boolean'
        ? this.options.cache
          ? (DEFAULT_OPTIONS.cache as CacheOptions)
          : { strategy: 'none' as const }
        : this.options.cache;
    this.cache = new CacheManager(cacheOptions);

    // Initialize normalizer
    this.normalizer = new Normalizer();

    // Initialize PII redactor
    const privacyOptions =
      typeof this.options.privacy === 'boolean'
        ? { redactPII: this.options.privacy }
        : this.options.privacy;
    this.piiRedactor = new PIIRedactor(privacyOptions);

    // Initialize rate limiter
    const rateLimitOptions =
      typeof this.options.rateLimit === 'boolean'
        ? this.options.rateLimit
          ? (DEFAULT_OPTIONS.rateLimit as RateLimitOptions)
          : { enabled: false }
        : this.options.rateLimit;
    this.rateLimiter = new RateLimiter(rateLimitOptions);

    // Initialize connection pool
    this.connectionPool = new ConnectionPool({
      maxConnections: 10,
      keepAlive: true,
    });

    // Initialize metrics collector
    this.metricsCollector = new MetricsCollector({
      enabled: true,
      maxMetrics: 10000,
    });

    // Initialize logger
    this.logger = new Logger({
      level: (this.options.logging?.level as any) || 'info',
      enabled: true,
      logRequests: true,
      logResponses: true,
    });

    // Initialize batch processor
    this.batchProcessor = new BatchProcessor(this);

    // Initialize query orchestrator
    this.orchestrator = new QueryOrchestrator({
      cache: this.cache,
      bootstrap: this.bootstrap,
      fetcher: this.fetcher,
      normalizer: this.normalizer,
      piiRedactor: this.piiRedactor,
      includeRaw: this.options.includeRaw,
      fetchWithRetry: this.fetchWithRetry.bind(this),
      rateLimiter: this.rateLimiter,
      metricsCollector: this.metricsCollector,
      logger: this.logger,
    });
  }

  /**
   * Queries RDAP information for a domain
   *
   * @param domain - Domain name to query (e.g., "example.com")
   * @returns Normalized domain RDAP response
   *
   * @example
   * ```typescript
   * const result = await client.domain('example.com');
   * console.log(result.registrar?.name);
   * console.log(result.nameservers);
   * ```
   */
  async domain(domain: string): Promise<DomainResponse> {
    return this.orchestrator.queryDomain(domain);
  }

  /**
   * Queries RDAP information for an IP address
   *
   * @param ip - IP address to query (IPv4 or IPv6)
   * @returns Normalized IP RDAP response
   *
   * @example
   * ```typescript
   * const result = await client.ip('8.8.8.8');
   * console.log(result.name);
   * console.log(result.country);
   * ```
   */
  async ip(ip: string): Promise<IPResponse> {
    return this.orchestrator.queryIP(ip);
  }

  /**
   * Queries RDAP information for an ASN (Autonomous System Number)
   *
   * @param asn - ASN to query (number or string with "AS" prefix)
   * @returns Normalized ASN RDAP response
   *
   * @example
   * ```typescript
   * const result = await client.asn(15169); // or "AS15169"
   * console.log(result.name);
   * ```
   */
  async asn(asn: string | number): Promise<ASNResponse> {
    return this.orchestrator.queryASN(asn);
  }

  /**
   * Fetches data with retry logic
   */
  private async fetchWithRetry(url: string): Promise<any> {
    const retryOptions =
      typeof this.options.retry === 'boolean'
        ? this.options.retry
          ? (DEFAULT_OPTIONS.retry as RetryOptions)
          : { maxAttempts: 1 }
        : this.options.retry;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= (retryOptions.maxAttempts || 1); attempt++) {
      try {
        return await this.fetcher.fetch(url);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation errors
        if (error instanceof ValidationError) {
          throw error;
        }

        // Check if we should retry
        if (attempt < (retryOptions.maxAttempts || 1)) {
          const delay = calculateBackoff(
            attempt,
            retryOptions.backoff || 'exponential',
            retryOptions.initialDelay || 1000,
            retryOptions.maxDelay || 10000
          );

          await sleep(delay);
          continue;
        }
      }
    }

    throw lastError;
  }

  /**
   * Normalizes client options with defaults
   */
  private normalizeOptions(options: RDAPClientOptions): Required<RDAPClientOptions> {
    return deepMerge(DEFAULT_OPTIONS, options);
  }

  /**
   * Clears all caches (response cache and bootstrap cache)
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.bootstrap.clearCache();
  }

  /**
   * Gets client statistics
   */
  async getStats(): Promise<{
    cache: {
      size: number;
      enabled: boolean;
      ttl: number;
    };
    bootstrap: {
      size: number;
      types: string[];
    };
  }> {
    return {
      cache: await this.cache.getStats(),
      bootstrap: this.bootstrap.getCacheStats(),
    };
  }

  /**
   * Gets client configuration
   */
  getConfig(): Required<RDAPClientOptions> {
    return { ...this.options };
  }

  /**
   * Gets rate limiter instance for advanced usage
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Gets batch processor instance for batch operations
   */
  getBatchProcessor(): BatchProcessor {
    return this.batchProcessor;
  }

  /**
   * Gets metrics summary
   */
  getMetrics(since?: number) {
    return this.metricsCollector.getSummary(since);
  }

  /**
   * Gets connection pool statistics
   */
  getConnectionPoolStats() {
    return this.connectionPool.getStats();
  }

  /**
   * Gets logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Gets recent logs
   */
  getLogs(count?: number) {
    return this.logger.getLogs(count);
  }

  /**
   * Clears all caches, metrics, and logs
   */
  async clearAll(): Promise<void> {
    await this.cache.clear();
    this.bootstrap.clearCache();
    this.metricsCollector.clear();
    this.logger.clear();
  }

  /**
   * Destroys the client and cleans up resources
   */
  destroy(): void {
    this.rateLimiter.destroy();
    this.connectionPool.destroy();
  }
}
