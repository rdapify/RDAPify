/**
 * HTTP fetcher for RDAP queries with SSRF protection
 * @module fetcher/Fetcher
 */

import type { RawRDAPResponse } from '../../shared/types';
import { NetworkError, TimeoutError, RDAPServerError, RDAPifyError, QueryAbortedError } from '../../shared/errors';
import type { TimeoutOptions } from '../../shared/types/options';
import { withTimeout } from '../../shared/utils/helpers';
import { VERSION } from '../../shared/constants/version.constants';
import { CircuitBreaker, CircuitOpenError } from './CircuitBreaker';
import type { CircuitBreakerOptions, CircuitState } from './CircuitBreaker';

import { SSRFProtection } from '../security/SSRFProtection';


/**
 * Fetcher options
 */
export interface FetcherOptions {
  timeout?: TimeoutOptions;
  userAgent?: string;
  headers?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
  ssrfProtection?: SSRFProtection;
  logRedirect?: (fromUrl: string, toUrl: string) => void;
  /** Enable HTTP/2 multiplexing hints (opt-in). @default false */
  http2?: boolean;
  /** AbortSignal to cancel in-flight requests */
  signal?: AbortSignal;
  /**
   * Per-registry circuit breaker configuration.
   * One circuit breaker is maintained per RDAP registry origin (e.g. `https://rdap.verisign.com`).
   * Pass `false` to disable circuit breaking.
   * @default {} (enabled with default thresholds: 5 failures / 30s half-open)
   */
  circuitBreaker?: CircuitBreakerOptions | false;
}

/** Per-registry circuit breaker state snapshot. */
export interface CircuitBreakerStats {
  [origin: string]: { state: CircuitState };
}

/**
 * HTTP fetcher for RDAP queries
 */
export class Fetcher {
  private readonly timeout: Required<TimeoutOptions>;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly followRedirects: boolean;
  private readonly maxRedirects: number;
  private readonly ssrfProtection?: SSRFProtection;
  private readonly logRedirect?: (fromUrl: string, toUrl: string) => void;
  readonly http2: boolean;
  private readonly signal?: AbortSignal;
  private readonly circuits: Map<string, CircuitBreaker> = new Map();
  private readonly cbOptions: CircuitBreakerOptions | false;

  constructor(options: FetcherOptions = {}) {
    this.timeout = {
      connect: options.timeout?.connect || 5000,
      request: options.timeout?.request || 10000,
      dns: options.timeout?.dns || 3000,
    };

    this.userAgent = options.userAgent || `RDAPify/${VERSION} (https://rdapify.com)`;
    this.headers = options.headers || {};
    this.followRedirects = options.followRedirects ?? true;
    this.maxRedirects = options.maxRedirects || 5;
    this.ssrfProtection = options.ssrfProtection;
    this.logRedirect = options.logRedirect;
    this.http2 = options.http2 ?? false;
    this.signal = options.signal;
    // undefined → enabled with defaults; false → disabled; object → custom options
    this.cbOptions = options.circuitBreaker !== undefined ? options.circuitBreaker : {};
  }

  /**
   * Returns the circuit breaker for the given URL's origin, creating it on first use.
   * Returns `null` when circuit breaking is disabled (`circuitBreaker: false`).
   */
  private getCircuit(url: string): CircuitBreaker | null {
    if (this.cbOptions === false) return null;
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return null; // malformed URL — let normal error handling deal with it
    }
    if (!this.circuits.has(origin)) {
      this.circuits.set(origin, new CircuitBreaker(this.cbOptions));
    }
    return this.circuits.get(origin)!;
  }

  /**
   * Fetches RDAP data from a URL.
   * Requests are guarded by a per-registry circuit breaker unless disabled.
   * Throws `CircuitOpenError` when the circuit for the target registry is open.
   */
  async fetch(url: string): Promise<RawRDAPResponse> {
    // SSRF protection check
    if (this.ssrfProtection) {
      await this.ssrfProtection.validateUrl(url);
    }

    const circuit = this.getCircuit(url);
    try {
      const response = circuit
        ? await circuit.execute(() => this.makeRequest(url))
        : await this.makeRequest(url);
      return response;
    } catch (error) {
      // Re-throw known typed errors (RDAPifyError subclasses and CircuitOpenError) as-is
      if (error instanceof RDAPifyError || error instanceof CircuitOpenError) {
        throw error;
      }

      throw new NetworkError(
        `Failed to fetch RDAP data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        { url, originalError: error }
      );
    }
  }

  /**
   * Returns circuit breaker state for each RDAP registry origin that has been
   * contacted at least once. Empty when circuit breaking is disabled.
   */
  getCircuitBreakerStats(): CircuitBreakerStats {
    const stats: CircuitBreakerStats = {};
    for (const [origin, cb] of this.circuits) {
      stats[origin] = { state: cb.getState() };
    }
    return stats;
  }

  /**
   * Makes HTTP request with timeout
   */
  private async makeRequest(url: string, redirectCount: number = 0): Promise<RawRDAPResponse> {
    // Check redirect limit
    if (redirectCount > this.maxRedirects) {
      throw new NetworkError(`Too many redirects (max: ${this.maxRedirects})`, undefined, { url });
    }

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: 'application/rdap+json, application/json',
      ...this.headers,
    };

    // HTTP/2 opt-in: signal preference for HTTP/2 via upgrade header
    if (this.http2) {
      requestHeaders['Upgrade'] = 'h2c';
      requestHeaders['HTTP2-Settings'] = '';
    }

    // Make request with timeout
    let response: Response;

    try {
      response = await withTimeout(
        fetch(url, {
          method: 'GET',
          headers: requestHeaders,
          redirect: 'manual', // Handle redirects manually for SSRF protection
          signal: this.signal,
        }),
        this.timeout.request,
        `Request timeout after ${this.timeout.request}ms`
      );
    } catch (error) {
      // AbortController cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        throw new QueryAbortedError(url);
      }
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new TimeoutError(`Request timed out after ${this.timeout.request}ms`, { url });
      }
      throw error;
    }

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
      const fromUrl = url;
      if (!this.followRedirects) {
        throw new NetworkError(
          `Redirect not allowed (status: ${response.status})`,
          response.status,
          { url }
        );
      }

      const location = response.headers.get('Location');
      if (!location) {
        throw new NetworkError('Redirect without Location header', response.status, { url });
      }

      // Validate and resolve redirect URL
      let redirectUrl: string;
      try {
        redirectUrl = new URL(location, url).toString();
      } catch {
        throw new NetworkError('Invalid redirect URL', response.status, { url, location });
      }

      // SSRF protection for redirect
      if (this.ssrfProtection) {
        await this.ssrfProtection.validateUrl(redirectUrl);
      }

      // Log redirect event
      this.logRedirect?.(fromUrl, redirectUrl);

      return this.makeRequest(redirectUrl, redirectCount + 1);
    }

    // Handle error responses
    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        try {
          errorBody = await response.text();
        } catch {
          errorBody = null;
        }
      }

      throw new RDAPServerError(
        `RDAP server error: ${response.status} ${response.statusText}`,
        response.status,
        { url, body: errorBody }
      );
    }

    // Parse JSON response
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new NetworkError('Failed to parse RDAP response as JSON', response.status, {
        url,
        originalError: error,
      });
    }

    // Validate RDAP response structure
    if (!data || typeof data !== 'object') {
      throw new NetworkError('Invalid RDAP response: not an object', response.status, {
        url,
      });
    }

    return data as RawRDAPResponse;
  }

  /**
   * Gets fetcher configuration
   */
  getConfig(): {
    timeout: Required<TimeoutOptions>;
    userAgent: string;
    followRedirects: boolean;
    maxRedirects: number;
  } {
    return {
      timeout: { ...this.timeout },
      userAgent: this.userAgent,
      followRedirects: this.followRedirects,
      maxRedirects: this.maxRedirects,
    };
  }
}
