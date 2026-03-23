/**
 * Main RDAP client
 * @module client/RDAPClient
 */

import { CacheManager } from '../../infrastructure/cache';
import { BootstrapDiscovery, Fetcher, Normalizer } from '../../infrastructure/http';
import { BunFetcher } from '../../infrastructure/http/BunFetcher';
import { DenoFetcher } from '../../infrastructure/http/DenoFetcher';
import { CloudflareWorkersFetcher } from '../../infrastructure/http/CloudflareWorkersFetcher';
import type { IFetcherPort } from '../../core/ports';
import { RateLimiter } from '../../infrastructure/http/RateLimiter';
import { ConnectionPool } from '../../infrastructure/http/ConnectionPool';
import { isBun, isDeno, isCloudflareWorkers } from '../../shared/utils/helpers/runtime';
import { SSRFProtection, PIIRedactor } from '../../infrastructure/security';
import { MetricsCollector } from '../../infrastructure/monitoring/MetricsCollector';
import { Logger } from '../../infrastructure/logging/Logger';
import type { LogLevel } from '../../infrastructure/logging/Logger';
import type { DomainResponse, IPResponse, ASNResponse, NameserverResponse, EntityResponse, AvailabilityResult, ExplainResult, SearchResult } from '../../shared/types';
import { ValidationError, RDAPServerError, SearchNotSupportedError } from '../../shared/errors';
import { UsageTelemetry } from '../../infrastructure/telemetry/UsageTelemetry';
import { validateDomain as _validateDomainFn, validateIP as _validateIPFn, validateASN as _validateASNFn } from '../../shared/utils/validators';
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
import type { BatchQueryRequest, StreamBatchOptions } from '../services/BatchProcessor';
import type { QueryTypeLiteral, BatchQueryResult } from '../../shared/types/generics';
import { MiddlewareManager } from '../hooks/MiddlewareHooks';
import type { MiddlewareOptions } from '../hooks/MiddlewareHooks';
import { QueryDeduplicator } from '../deduplication/QueryDeduplicator';
import { NativeBackend } from '../../infrastructure/native/NativeBackend';

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
 *
 * @example Debug Mode
 * ```typescript
 * const client = new RDAPClient({
 *   debug: true,
 * });
 *
 * // Logs RDAP server discovery, request duration, cache hits/misses, retries, redirects
 * const result = await client.domain('example.com');
 * ```
 *
 * @example Custom Logger
 * ```typescript
 * const customLogger = {
 *   debug: (msg, meta) => console.debug('[DEBUG]', msg, meta),
 *   info: (msg, meta) => console.info('[INFO]', msg, meta),
 *   warn: (msg, meta) => console.warn('[WARN]', msg, meta),
 *   error: (msg, meta) => console.error('[ERROR]', msg, meta),
 * };
 *
 * const client = new RDAPClient({
 *   debug: { logger: customLogger },
 * });
 * ```
 */
export class RDAPClient {
  private readonly options: Required<RDAPClientOptions>;
  private readonly cache: CacheManager;
  private readonly fetcher: IFetcherPort;
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
  private readonly middlewareManager: MiddlewareManager;
  private readonly queryDeduplicator: QueryDeduplicator;
  private readonly debugEnabled: boolean;
  private readonly debugLogger?: {
    debug: (message: string, metadata?: Record<string, any>) => void;
    info: (message: string, metadata?: Record<string, any>) => void;
    warn: (message: string, metadata?: Record<string, any>) => void;
    error: (message: string, metadata?: Record<string, any>) => void;
  };
  private readonly nativeBackend: NativeBackend | null;

  constructor(options: RDAPClientOptions = {}) {
    // Merge with defaults
    this.options = this.normalizeOptions(options);

    // Initialize SSRF protection
    const ssrfOptions =
      typeof this.options.ssrfProtection === 'boolean'
        ? { enabled: this.options.ssrfProtection }
        : this.options.ssrfProtection;
    this.ssrfProtection = new SSRFProtection(ssrfOptions);

    // Initialize fetcher — auto-select based on detected runtime
    const timeoutMs =
      typeof this.options.timeout === 'number'
        ? this.options.timeout
        : (this.options.timeout as { request?: number } | undefined)?.request ?? 10_000;

    if (isCloudflareWorkers()) {
      this.fetcher = new CloudflareWorkersFetcher({
        timeout: timeoutMs,
        userAgent: this.options.userAgent,
        headers: this.options.headers,
        ssrfProtection: this.ssrfProtection,
      });
    } else if (isDeno()) {
      this.fetcher = new DenoFetcher({
        timeout: timeoutMs,
        userAgent: this.options.userAgent,
        headers: this.options.headers,
        ssrfProtection: this.ssrfProtection,
      });
    } else if (isBun()) {
      this.fetcher = new BunFetcher({
        timeout: timeoutMs,
        userAgent: this.options.userAgent,
        headers: this.options.headers,
        ssrfProtection: this.ssrfProtection,
      });
    } else {
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
        http2: this.options.http2,
        signal: this.options.signal,
        logRedirect: (fromUrl, toUrl) => {
          this.logger?.warn(`Redirect: ${fromUrl} → ${toUrl}`);
          if (this.debugEnabled && this.debugLogger) {
            this.debugLogger.debug('Redirect occurred', {
              fromUrl,
              toUrl,
            });
          }
        },
      });
    }

    // Initialize bootstrap discovery
    const bootstrapOpts = this.options.bootstrap && typeof this.options.bootstrap === 'object'
      ? this.options.bootstrap
      : undefined;
    this.bootstrap = new BootstrapDiscovery(this.options.bootstrapUrl, this.fetcher, bootstrapOpts);

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
    const validLogLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configuredLevel = this.options.logging?.level as string | undefined;
    const logLevel: LogLevel =
      configuredLevel && (validLogLevels as string[]).includes(configuredLevel)
        ? (configuredLevel as LogLevel)
        : 'info';
    this.logger = new Logger({
      level: logLevel,
      enabled: true,
      logRequests: true,
      logResponses: true,
    });

    // Initialize debug logger
    const debugOptions = this.options.debug;
    this.debugEnabled = typeof debugOptions === 'boolean' ? debugOptions : debugOptions?.enabled ?? false;
    this.debugLogger = typeof debugOptions === 'object' && debugOptions?.logger ? debugOptions.logger : undefined;

    // Initialize middleware manager
    const middlewareOpts = this.options.middleware as MiddlewareOptions | undefined;
    this.middlewareManager = new MiddlewareManager(middlewareOpts);

    // Initialize query deduplicator
    const dedupOpts = this.options.deduplication;
    this.queryDeduplicator = new QueryDeduplicator(
      typeof dedupOpts === 'boolean'
        ? { enabled: dedupOpts }
        : (dedupOpts as { windowMs?: number; enabled?: boolean } | undefined)
    );

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
      debugEnabled: this.debugEnabled,
      debugLogger: this.debugLogger,
      middleware: this.middlewareManager,
      deduplicator: this.queryDeduplicator,
    });

    // Initialize optional native backend
    const backendMode = this.options.backend;
    this.nativeBackend =
      backendMode === 'typescript'
        ? null
        : NativeBackend.create(backendMode === 'native' ? 'native' : 'auto');
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
    if (this.nativeBackend) return this.nativeBackend.domain(domain);
    const result = await this.orchestrator.queryDomain(domain);
    this.pingTelemetry('domain');
    return result;
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
    if (this.nativeBackend) return this.nativeBackend.ip(ip);
    const result = await this.orchestrator.queryIP(ip);
    this.pingTelemetry('ip');
    return result;
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
    if (this.nativeBackend) return this.nativeBackend.asn(asn);
    const result = await this.orchestrator.queryASN(asn);
    this.pingTelemetry('asn');
    return result;
  }

  /**
   * Queries RDAP information for a nameserver
   *
   * @param nameserver - Nameserver hostname to query (e.g., "ns1.example.com")
   * @returns Normalized nameserver RDAP response
   *
   * @example
   * ```typescript
   * const result = await client.nameserver('ns1.example.com');
   * console.log(result.ipAddresses?.v4);
   * ```
   */
  async nameserver(nameserver: string): Promise<NameserverResponse> {
    if (this.nativeBackend) return this.nativeBackend.nameserver(nameserver);
    const result = await this.orchestrator.queryNameserver(nameserver);
    this.pingTelemetry('nameserver');
    return result;
  }

  /**
   * Queries RDAP information for an entity (contact/registrant/registrar) by handle.
   * Requires an explicit RDAP server URL since there is no global bootstrap for entities.
   *
   * @param handle - Entity handle to query (e.g., "VRSN-96", "ARIN-HN-1")
   * @param serverUrl - RDAP server base URL (e.g., "https://rdap.arin.net/registry")
   * @returns Normalized entity RDAP response
   *
   * @example
   * ```typescript
   * const result = await client.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
   * console.log(result.handle);
   * console.log(result.vcardArray);
   * ```
   */
  async entity(handle: string, serverUrl: string): Promise<EntityResponse> {
    if (this.nativeBackend) return this.nativeBackend.entity(handle, serverUrl);
    const result = await this.orchestrator.queryEntity(handle, serverUrl);
    this.pingTelemetry('entity');
    return result;
  }

  /**
   * Checks whether a domain name is available for registration.
   * Analyzes the RDAP response — does not rely on WHOIS.
   * Returns `available: true` when the registry returns 404 (domain not found).
   *
   * @param domain - Domain name to check (e.g., "example.com")
   * @returns Availability result with optional expiration date
   *
   * @example
   * ```typescript
   * const result = await client.checkAvailability('example.com');
   * if (result.available) {
   *   console.log('Domain is available!');
   * } else {
   *   console.log('Expires:', result.expiresAt);
   * }
   * ```
   */
  async checkAvailability(domain: string): Promise<AvailabilityResult> {
    try {
      const response = await this.domain(domain);
      const expirationEvent = response.events?.find(e => e.type === 'expiration');
      const expiresAt = expirationEvent ? new Date(expirationEvent.date) : undefined;
      return { domain: response.query, available: false, expiresAt };
    } catch (error) {
      if (error instanceof RDAPServerError && error.statusCode === 404) {
        return { domain, available: true };
      }
      throw error;
    }
  }

  /**
   * Checks availability for multiple domains in parallel.
   *
   * @param domains - Array of domain names to check
   * @returns Map from domain name to its availability result
   *
   * @example
   * ```typescript
   * const results = await client.checkAvailabilityBatch(['example.com', 'taken.com']);
   * for (const [domain, result] of results) {
   *   console.log(domain, result.available);
   * }
   * ```
   */
  async checkAvailabilityBatch(domains: string[]): Promise<Map<string, AvailabilityResult>> {
    const entries = await Promise.all(
      domains.map(async domain => {
        const result = await this.checkAvailability(domain);
        return [domain, result] as [string, AvailabilityResult];
      })
    );
    return new Map(entries);
  }

  /**
   * Searches for domains matching a pattern via the RDAP Search API (RFC 7483).
   *
   * @param pattern - Domain name search pattern (may include wildcards, e.g. "example*")
   * @param serverUrl - Optional RDAP server base URL; falls back to bootstrap discovery for "com"
   * @returns Search results containing matching domain responses
   * @throws {SearchNotSupportedError} When the server returns 404 or 501
   *
   * @example
   * ```typescript
   * const results = await client.searchDomains('example*', 'https://rdap.verisign.com/com/v1');
   * console.log(results.results.length);
   * ```
   */
  async searchDomains(
    pattern: string,
    serverUrl?: string
  ): Promise<SearchResult<DomainResponse>> {
    const server = serverUrl ?? (await this.bootstrap.discoverDomain('example.com'));
    const url = `${server}/domains?name=${encodeURIComponent(pattern)}`;

    let raw: any;
    try {
      raw = await this.fetchWithRetry(url);
    } catch (error) {
      if (
        error instanceof RDAPServerError &&
        (error.statusCode === 404 || error.statusCode === 501)
      ) {
        throw new SearchNotSupportedError(
          `RDAP server does not support domain search: ${server}`,
          { pattern, serverUrl: server }
        );
      }
      throw error;
    }

    const domainSearchResults: any[] = raw['domainSearchResults'] ?? [];
    const results = domainSearchResults.map((item: any) =>
      this.normalizer.normalize(item, pattern, server, false, this.options.includeRaw) as DomainResponse
    );

    return { results, totalCount: results.length, query: pattern };
  }

  /**
   * Searches for entities matching a pattern via the RDAP Search API (RFC 7483).
   *
   * @param pattern - Entity handle or name search pattern
   * @param serverUrl - RDAP server base URL to query
   * @returns Search results containing matching entity responses
   * @throws {SearchNotSupportedError} When the server returns 404 or 501
   */
  async searchEntities(
    pattern: string,
    serverUrl?: string
  ): Promise<SearchResult<EntityResponse>> {
    if (!serverUrl) {
      throw new SearchNotSupportedError(
        'searchEntities requires an explicit serverUrl — there is no global bootstrap for entities',
        { pattern }
      );
    }

    const url = `${serverUrl}/entities?fn=${encodeURIComponent(pattern)}`;

    let raw: any;
    try {
      raw = await this.fetchWithRetry(url);
    } catch (error) {
      if (
        error instanceof RDAPServerError &&
        (error.statusCode === 404 || error.statusCode === 501)
      ) {
        throw new SearchNotSupportedError(
          `RDAP server does not support entity search: ${serverUrl}`,
          { pattern, serverUrl }
        );
      }
      throw error;
    }

    const entitySearchResults: any[] = raw['entitySearchResults'] ?? [];
    const results = entitySearchResults.map((item: any) =>
      this.normalizer.normalize(item, pattern, serverUrl, false, this.options.includeRaw) as EntityResponse
    );

    return { results, totalCount: results.length, query: pattern };
  }

  /**
   * Explains the RDAP query pipeline for a given input without making a real RDAP request.
   * Useful for debugging server discovery, cache status, and URL construction.
   *
   * @param query - A domain, IP address, or ASN to explain
   * @returns Detailed breakdown of the query pipeline
   *
   * @example
   * ```typescript
   * const info = await client.explain('example.com');
   * console.log(info.bootstrapServer); // 'https://rdap.verisign.com/com/v1'
   * console.log(info.builtUrl);        // 'https://rdap.verisign.com/com/v1/domain/example.com'
   * ```
   */
  async explain(query: string): Promise<ExplainResult> {
    const startTime = Date.now();

    // Auto-detect query type
    let queryType: ExplainResult['queryType'] = 'domain';
    let detectedType = 'unknown';

    try {
      if (/^\d+$/.test(query) || /^AS\d+$/i.test(query)) {
        _validateASNFn(query);
        queryType = 'asn';
        detectedType = 'asn';
      } else if (query.includes('.') && /^\d/.test(query)) {
        _validateIPFn(query);
        queryType = 'ip';
        detectedType = 'ipv4';
      } else if (query.includes(':')) {
        _validateIPFn(query);
        queryType = 'ip';
        detectedType = 'ipv6';
      } else {
        _validateDomainFn(query);
        queryType = 'domain';
        detectedType = 'domain';
      }
    } catch {
      // Validation failed — default to domain
      queryType = 'domain';
      detectedType = 'unknown';
    }

    // Check cache (without side effects)
    const cacheEnabled = this.options.cache !== false;
    let cacheStatus: ExplainResult['cacheStatus'] = cacheEnabled ? 'miss' : 'disabled';

    if (cacheEnabled) {
      const { generateCacheKey } = await import('../../shared/utils/helpers');
      const cacheKey = generateCacheKey(queryType, query.toLowerCase());
      const cached = await this.cache.get(cacheKey);
      if (cached) cacheStatus = 'hit';
    }

    // Discover bootstrap server
    let bootstrapServer: string | null = null;
    let builtUrl: string | null = null;
    let error: string | undefined;

    try {
      if (queryType === 'domain') {
        bootstrapServer = await this.bootstrap.discoverDomain(query.toLowerCase());
        builtUrl = `${bootstrapServer}/domain/${query.toLowerCase()}`;
      } else if (queryType === 'ip') {
        const version = _validateIPFn(query);
        bootstrapServer =
          version === 'v4'
            ? await this.bootstrap.discoverIPv4(query)
            : await this.bootstrap.discoverIPv6(query);
        builtUrl = `${bootstrapServer}/ip/${query}`;
      } else if (queryType === 'asn') {
        const asnNum = _validateASNFn(query);
        bootstrapServer = await this.bootstrap.discoverASN(asnNum);
        builtUrl = `${bootstrapServer}/autnum/${asnNum}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    return {
      query,
      queryType,
      detectedType,
      bootstrapServer,
      builtUrl,
      cacheStatus,
      latencyMs: Date.now() - startTime,
      error,
    };
  }

  /**
   * Fires anonymous usage telemetry if enabled — never awaited, never throws.
   */
  private pingTelemetry(queryType: string): void {
    const telemetryOpts = this.options.usageTelemetry as { enabled?: boolean; endpoint?: string } | undefined;
    if (telemetryOpts?.enabled === true) {
      UsageTelemetry.ping(queryType, telemetryOpts.endpoint);
    }
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
   * Validates the client configuration asynchronously.
   * Checks reachability of custom bootstrap URLs and Redis connectivity.
   *
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = await client.validate();
   * if (!result.valid) {
   *   console.error('Configuration errors:', result.errors);
   * }
   * ```
   */
  async validate(): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check custom bootstrap URL reachability
    const bootstrapUrl = this.options.bootstrapUrl;
    if (bootstrapUrl && bootstrapUrl !== 'https://data.iana.org/rdap') {
      try {
        await this.fetcher.fetch(`${bootstrapUrl}/dns.json`);
      } catch {
        errors.push(`Bootstrap URL unreachable: ${bootstrapUrl}`);
      }
    }

    // Check Redis connectivity
    const cacheOpts = this.options.cache as any;
    if (cacheOpts?.strategy === 'redis' && cacheOpts?.redisClient) {
      try {
        await (cacheOpts.redisClient as any).ping();
      } catch {
        errors.push('Redis connection failed');
      }
    }

    // Warn when SSRF protection is disabled
    const ssrfOpts = this.options.ssrfProtection as any;
    if (ssrfOpts?.enabled === false) {
      warnings.push('SSRF protection disabled — not safe for production');
    }

    return { valid: errors.length === 0, errors, warnings };
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
   * Gets batch processor instance for batch operations.
   *
   * @deprecated Use `client.streamBatch()` for streaming results as they arrive
   * or `client.getBatchProcessor().processBatch()` for collecting all results.
   * `getBatchProcessor()` exposes an internal class and will be removed in v1.0.0.
   * DEP_RDAPIFY_0001
   */
  getBatchProcessor(): BatchProcessor {
    return this.batchProcessor;
  }

  /**
   * Streams query results as an async iterable, yielding each result as soon
   * as it completes rather than waiting for the entire batch to finish.
   *
   * Suitable for large query sets (1 000+ items) — at most `concurrency`
   * queries are ever in-flight simultaneously, so memory usage stays flat.
   *
   * @param requests - Queries to execute
   * @param options  - Concurrency (default 5) and error-handling options
   *
   * @example
   * ```typescript
   * const requests = domains.map(d => ({ type: 'domain' as const, query: d }));
   *
   * for await (const result of client.streamBatch(requests, { concurrency: 10 })) {
   *   if (result.error) console.error(result.query, result.error.message);
   *   else console.log(result.query, result.result!.registrar?.name);
   * }
   * ```
   */
  streamBatch<T extends QueryTypeLiteral>(
    requests: BatchQueryRequest<T>[],
    options?: StreamBatchOptions
  ): AsyncGenerator<BatchQueryResult<T>, void, unknown> {
    return this.batchProcessor.streamBatch(requests, options);
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
   * Registers lifecycle middleware hooks (fluent API)
   *
   * @example
   * ```typescript
   * client
   *   .use({ beforeQuery: (ctx) => console.log('querying', ctx.query) })
   *   .use({ afterQuery: (ctx) => console.log('done in', ctx.duration, 'ms') });
   * ```
   */
  use(hooks: Partial<MiddlewareOptions>): this {
    this.middlewareManager.use(hooks);
    return this;
  }

  /**
   * Gets the middleware manager for advanced hook management
   */
  getMiddlewareManager(): MiddlewareManager {
    return this.middlewareManager;
  }

  /**
   * Gets query deduplicator stats
   */
  getDeduplicatorStats() {
    return this.queryDeduplicator.getStats();
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
