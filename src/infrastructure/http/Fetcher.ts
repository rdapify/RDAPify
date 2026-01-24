/**
 * HTTP fetcher for RDAP queries with SSRF protection
 * @module fetcher/Fetcher
 */

import type { RawRDAPResponse } from '../../shared/types';
import { NetworkError, TimeoutError, RDAPServerError } from '../../shared/errors';
import type { TimeoutOptions } from '../../shared/types/options';
import { withTimeout } from '../../shared/utils/helpers';

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

  constructor(options: FetcherOptions = {}) {
    this.timeout = {
      connect: options.timeout?.connect || 5000,
      request: options.timeout?.request || 10000,
      dns: options.timeout?.dns || 3000,
    };

    this.userAgent = options.userAgent || 'RDAPify/0.1.0 (https://rdapify.com)';
    this.headers = options.headers || {};
    this.followRedirects = options.followRedirects ?? true;
    this.maxRedirects = options.maxRedirects || 5;
    this.ssrfProtection = options.ssrfProtection;
  }

  /**
   * Fetches RDAP data from a URL
   */
  async fetch(url: string): Promise<RawRDAPResponse> {
    // SSRF protection check
    if (this.ssrfProtection) {
      await this.ssrfProtection.validateUrl(url);
    }

    try {
      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      if (error instanceof TimeoutError || error instanceof NetworkError) {
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

    // Make request with timeout
    let response: Response;

    try {
      response = await withTimeout(
        fetch(url, {
          method: 'GET',
          headers: requestHeaders,
          redirect: 'manual', // Handle redirects manually for SSRF protection
        }),
        this.timeout.request,
        `Request timeout after ${this.timeout.request}ms`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new TimeoutError(`Request timed out after ${this.timeout.request}ms`, { url });
      }
      throw error;
    }

    // Handle redirects manually
    if (response.status >= 300 && response.status < 400) {
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

      // Resolve relative URLs
      const redirectUrl = new URL(location, url).toString();

      // SSRF protection for redirect
      if (this.ssrfProtection) {
        await this.ssrfProtection.validateUrl(redirectUrl);
      }

      return this.makeRequest(redirectUrl, redirectCount + 1);
    }

    // Handle error responses
    if (!response.ok) {
      let errorBody: any;
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
    let data: any;
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
        data,
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
