/**
 * Bun-native HTTP fetcher for RDAP queries.
 *
 * Uses `Bun.fetch` when available for reduced overhead on the Bun runtime,
 * falls back to the standard `fetch` in other environments.
 * Implements the same `IFetcherPort` contract as the default `Fetcher`.
 *
 * @module infrastructure/http/BunFetcher
 */

import type { IFetcherPort } from '../../core/ports';
import type { RawRDAPResponse } from '../../shared/types';
import { NetworkError, RDAPServerError, TimeoutError, RDAPifyError } from '../../shared/errors';
import type { SSRFProtection } from '../security/SSRFProtection';

export interface BunFetcherOptions {
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
 * Bun-native RDAP fetcher.
 *
 * Identical behaviour to `Fetcher` but explicitly uses `Bun.fetch` when the
 * Bun runtime is detected.  On Node.js the standard `fetch` is used as a
 * fallback so tests pass without modification.
 */
export class BunFetcher implements IFetcherPort {
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly ssrfProtection?: SSRFProtection;

  constructor(options: BunFetcherOptions = {}) {
    this.timeout = options.timeout ?? 10_000;
    this.userAgent = options.userAgent ?? 'RDAPify/0.2.1 (Bun) (https://rdapify.com)';
    this.headers = options.headers ?? {};
    this.ssrfProtection = options.ssrfProtection;
  }

  /**
   * Fetches RDAP data from a URL using the Bun-native fetch implementation.
   */
  async fetch(url: string): Promise<RawRDAPResponse> {
    if (this.ssrfProtection) {
      await this.ssrfProtection.validateUrl(url);
    }

    try {
      // Use Bun.fetch when running under Bun; fall back to global fetch otherwise.
      const nativeFetch = BunFetcher.resolveFetch();

      const response = await nativeFetch(url, {
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

      const data = await response.json() as RawRDAPResponse;
      return data;
    } catch (err) {
      if (err instanceof RDAPifyError) throw err;

      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`, { url });
      }

      throw new NetworkError(
        `BunFetcher: failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        { url, originalError: err },
      );
    }
  }

  /**
   * Returns `Bun.fetch` when running under the Bun runtime, otherwise the
   * global `fetch` (Node.js 18+, browsers, Deno).
   */
  static resolveFetch(): typeof fetch {
    const bun = (globalThis as Record<string, unknown>)['Bun'];
    if (bun && typeof (bun as Record<string, unknown>)['fetch'] === 'function') {
      return (bun as Record<string, unknown>)['fetch'] as typeof fetch;
    }
    return globalThis.fetch;
  }
}
