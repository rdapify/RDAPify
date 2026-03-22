/**
 * Browser-compatible HTTP fetcher for RDAP queries.
 *
 * Browsers cannot contact RDAP servers directly because most servers do not
 * send the `Access-Control-Allow-Origin` header required by the Same-Origin
 * Policy.  This fetcher routes every request through a developer-supplied
 * CORS-enabled reverse proxy, making rdapify usable inside any browser
 * environment (React, Vue, Angular, vanilla JS, …).
 *
 * ### Proxy contract
 * The proxy receives a `GET` request whose URL is formed by appending the
 * encoded RDAP URL as the `url` query-string parameter:
 *
 * ```
 * GET {proxyUrl}?url={encodeURIComponent(rdapUrl)}
 * ```
 *
 * The proxy must:
 * 1. Fetch the RDAP URL server-side (no CORS restriction on the server).
 * 2. Return the JSON response body as-is.
 * 3. Include `Access-Control-Allow-Origin: *` (or the appropriate origin) in
 *    its own response headers.
 *
 * A minimal Express proxy looks like:
 * ```ts
 * app.get('/rdap-proxy', async (req, res) => {
 *   const target = decodeURIComponent(req.query.url as string);
 *   const data   = await fetch(target).then(r => r.json());
 *   res.set('Access-Control-Allow-Origin', '*').json(data);
 * });
 * ```
 *
 * @module infrastructure/http/BrowserFetcher
 */

import type { IFetcherPort } from '../../core/ports';
import type { RawRDAPResponse } from '../../shared/types';
import { NetworkError, RDAPServerError, TimeoutError, RDAPifyError } from '../../shared/errors';

export interface BrowserFetcherOptions {
  /**
   * Base URL of the CORS-enabled reverse proxy.
   *
   * Every RDAP request is forwarded as:
   * `GET {proxyUrl}?url={encodeURIComponent(rdapUrl)}`
   *
   * @example 'https://your-server.com/rdap-proxy'
   */
  proxyUrl: string;

  /**
   * Request timeout in milliseconds.
   * @default 15_000
   */
  timeout?: number;

  /**
   * Additional HTTP headers sent with every request to the proxy.
   */
  headers?: Record<string, string>;
}

/**
 * Browser-compatible RDAP fetcher.
 *
 * Routes all RDAP requests through a developer-provided CORS proxy, enabling
 * rdapify to run in any browser environment.  Uses only Web-standard APIs
 * (`fetch`, `AbortSignal`, `URL`, `URLSearchParams`) — no Node.js polyfills
 * are required.
 *
 * @example
 * ```ts
 * import { RDAPClient, BrowserFetcher } from 'rdapify';
 *
 * const client = new RDAPClient({
 *   fetcher: new BrowserFetcher({ proxyUrl: 'https://your-server.com/rdap-proxy' }),
 * });
 *
 * const domain = await client.domain('example.com');
 * ```
 */
export class BrowserFetcher implements IFetcherPort {
  private readonly proxyUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;

  constructor(options: BrowserFetcherOptions) {
    if (!options.proxyUrl) {
      throw new Error('BrowserFetcher: proxyUrl is required');
    }
    this.proxyUrl = options.proxyUrl.replace(/\/$/, ''); // strip trailing slash
    this.timeout = options.timeout ?? 15_000;
    this.headers = options.headers ?? {};
  }

  /**
   * Fetches RDAP data by routing the request through the configured proxy.
   */
  async fetch(url: string): Promise<RawRDAPResponse> {
    const proxiedUrl = `${this.proxyUrl}?url=${encodeURIComponent(url)}`;

    try {
      const response = await globalThis.fetch(proxiedUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/rdap+json, application/json',
          ...this.headers,
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new RDAPServerError(
          `RDAP proxy returned ${response.status} for ${url}`,
          response.status,
          { url: proxiedUrl },
        );
      }

      const data = (await response.json()) as RawRDAPResponse;
      return data;
    } catch (err) {
      if (err instanceof RDAPifyError) throw err;

      if (err instanceof DOMException && err.name === 'TimeoutError') {
        throw new TimeoutError(`Browser proxy request timed out after ${this.timeout}ms`, {
          url: proxiedUrl,
        });
      }

      throw new NetworkError(
        `BrowserFetcher: failed to fetch ${url} via proxy: ${
          err instanceof Error ? err.message : String(err)
        }`,
        undefined,
        { url: proxiedUrl, originalError: err },
      );
    }
  }

  /**
   * Returns the configured proxy URL (without trailing slash).
   */
  getProxyUrl(): string {
    return this.proxyUrl;
  }
}
