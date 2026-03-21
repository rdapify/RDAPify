/**
 * Deno-native HTTP fetcher for RDAP queries.
 *
 * Uses the standard global `fetch` (available in Deno since v1.0) and adds a
 * Deno-specific User-Agent string.  Falls back gracefully to `globalThis.fetch`
 * on any runtime that provides a Web-standard `fetch`.
 *
 * Implements the same `IFetcherPort` contract as `Fetcher` and `BunFetcher`.
 *
 * @module infrastructure/http/DenoFetcher
 */

import type { IFetcherPort } from '../../core/ports';
import type { RawRDAPResponse } from '../../shared/types';
import { NetworkError, RDAPServerError, TimeoutError, RDAPifyError } from '../../shared/errors';
import type { SSRFProtection } from '../security/SSRFProtection';

export interface DenoFetcherOptions {
  /** Request timeout in milliseconds. @default 10_000 */
  timeout?: number;
  /** Custom User-Agent header. */
  userAgent?: string;
  /** Additional HTTP headers sent with every request. */
  headers?: Record<string, string>;
  /** SSRF protection guard. */
  ssrfProtection?: SSRFProtection;
}

/**
 * Deno-compatible RDAP fetcher.
 *
 * Uses the Web-standard `fetch` which is built into Deno.  The implementation
 * is intentionally free of any Node.js-specific APIs (no `require`, no
 * `process`, no `Buffer`) so it works both in Deno and in any other
 * Web-standard environment.
 */
export class DenoFetcher implements IFetcherPort {
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly ssrfProtection?: SSRFProtection;

  constructor(options: DenoFetcherOptions = {}) {
    this.timeout = options.timeout ?? 10_000;
    this.userAgent = options.userAgent ?? 'RDAPify/0.2.2 (Deno) (https://rdapify.com)';
    this.headers = options.headers ?? {};
    this.ssrfProtection = options.ssrfProtection;
  }

  /**
   * Fetches RDAP data from a URL using the Web-standard `fetch`.
   */
  async fetch(url: string): Promise<RawRDAPResponse> {
    if (this.ssrfProtection) {
      await this.ssrfProtection.validateUrl(url);
    }

    try {
      const response = await globalThis.fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/rdap+json, application/json',
          ...this.headers,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new RDAPServerError(
          `RDAP server returned ${response.status}`,
          response.status,
          { url },
        );
      }

      const data = (await response.json()) as RawRDAPResponse;
      return data;
    } catch (err) {
      if (err instanceof RDAPifyError) throw err;

      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`, { url });
      }

      throw new NetworkError(
        `DenoFetcher: failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        { url, originalError: err },
      );
    }
  }
}
