/**
 * Cloudflare Workers–compatible HTTP fetcher for RDAP queries.
 *
 * Designed for the Cloudflare Workers (Edge) runtime.  Strictly avoids any
 * Node.js-only APIs (`require`, `process`, `Buffer`, `fs`, `crypto` module)
 * and relies exclusively on Web-standard globals that are available in all
 * Edge runtimes (`fetch`, `AbortSignal`, `DOMException`, `TextEncoder`).
 *
 * Implements the same `IFetcherPort` contract as all other fetchers.
 *
 * @module infrastructure/http/CloudflareWorkersFetcher
 */

import type { IFetcherPort } from '../../core/ports';
import type { RawRDAPResponse } from '../../shared/types';
import { NetworkError, RDAPServerError, TimeoutError, RDAPifyError } from '../../shared/errors';
import type { SSRFProtection } from '../security/SSRFProtection';

export interface CloudflareWorkersFetcherOptions {
  /** Request timeout in milliseconds. @default 10_000 */
  timeout?: number;
  /** Custom User-Agent header. */
  userAgent?: string;
  /** Additional HTTP headers sent with every request. */
  headers?: Record<string, string>;
  /**
   * SSRF protection guard.
   *
   * Note: DNS-based SSRF checks may behave differently at the edge because
   * Workers DNS is resolved by Cloudflare's network.  IP-block-list checks
   * still apply to any IPs visible in the URL.
   */
  ssrfProtection?: SSRFProtection;
}

/**
 * Cloudflare Workers–compatible RDAP fetcher.
 *
 * All APIs used here are Web standards:
 *  - `globalThis.fetch` — built into Workers
 *  - `AbortSignal.timeout()` — supported in Workers since 2023
 *  - `DOMException` — available in the Workers runtime
 *
 * No Node.js polyfills are required.
 */
export class CloudflareWorkersFetcher implements IFetcherPort {
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly headers: Record<string, string>;
  private readonly ssrfProtection?: SSRFProtection;

  constructor(options: CloudflareWorkersFetcherOptions = {}) {
    this.timeout = options.timeout ?? 10_000;
    this.userAgent =
      options.userAgent ?? 'RDAPify/0.2.2 (Cloudflare-Workers) (https://rdapify.com)';
    this.headers = options.headers ?? {};
    this.ssrfProtection = options.ssrfProtection;
  }

  /**
   * Fetches RDAP data from a URL using the edge-native `fetch`.
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
        `CloudflareWorkersFetcher: failed to fetch ${url}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        undefined,
        { url, originalError: err },
      );
    }
  }
}
