/**
 * Unit tests for CloudflareWorkersFetcher
 */

import { CloudflareWorkersFetcher } from '../../src/infrastructure/http/CloudflareWorkersFetcher';
import { NetworkError, RDAPServerError, TimeoutError, SSRFProtectionError } from '../../src/shared/errors';

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: () => Promise.reject(new Error('no body')) } as unknown as Response;
}

describe('CloudflareWorkersFetcher', () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed JSON on success', async () => {
    const payload = { ldhName: 'example.com', objectClassName: 'domain' };
    mockFetch.mockResolvedValueOnce(okResponse(payload));

    const fetcher = new CloudflareWorkersFetcher();
    const result = await fetcher.fetch('https://rdap.example.com/domain/example.com');
    expect(result).toEqual(payload);
  });

  it('uses Cloudflare-Workers User-Agent by default', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const fetcher = new CloudflareWorkersFetcher();
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('Cloudflare-Workers');
  });

  it('accepts custom User-Agent', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const fetcher = new CloudflareWorkersFetcher({ userAgent: 'EdgeApp/2.0' });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('EdgeApp/2.0');
  });

  it('merges custom headers', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const fetcher = new CloudflareWorkersFetcher({ headers: { 'CF-Worker': 'yes' } });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['CF-Worker']).toBe('yes');
  });

  it('throws RDAPServerError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(503));
    const fetcher = new CloudflareWorkersFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(RDAPServerError);
  });

  it('includes HTTP status in RDAPServerError', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429));
    const fetcher = new CloudflareWorkersFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toMatchObject({ statusCode: 429 });
  });

  it('throws TimeoutError on DOMException TimeoutError', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));
    const fetcher = new CloudflareWorkersFetcher({ timeout: 100 });
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(TimeoutError);
  });

  it('throws NetworkError on generic failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    const fetcher = new CloudflareWorkersFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(NetworkError);
  });

  it('applies SSRF protection before fetch', async () => {
    const ssrfGuard = {
      validateUrl: jest.fn().mockRejectedValueOnce(
        new SSRFProtectionError('Blocked', undefined, { url: 'http://localhost' }),
      ),
    };
    const fetcher = new CloudflareWorkersFetcher({ ssrfProtection: ssrfGuard as never });
    await expect(fetcher.fetch('http://localhost/rdap')).rejects.toBeInstanceOf(SSRFProtectionError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not use Node.js-specific require()', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/infrastructure/http/CloudflareWorkersFetcher.ts'),
      'utf8',
    ) as string;
    expect(src).not.toMatch(/\brequire\s*\(/);
  });

  it('does not use process or Buffer in executable code', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/infrastructure/http/CloudflareWorkersFetcher.ts'),
      'utf8',
    ) as string;
    // Strip single-line comments and block comments before checking
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')  // block comments
      .replace(/\/\/[^\n]*/g, '');        // line comments
    expect(codeOnly).not.toMatch(/\bprocess\b/);
    expect(codeOnly).not.toMatch(/\bBuffer\b/);
  });

  it('passes AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const fetcher = new CloudflareWorkersFetcher({ timeout: 5000 });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeDefined();
  });

  it('auto-selected by RDAPClient when isCloudflareWorkers() is true', () => {
    // Structural test — verify RDAPClient uses CloudflareWorkersFetcher when CF Workers detected
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/application/client/RDAPClient.ts'),
      'utf8',
    ) as string;
    expect(src).toContain('CloudflareWorkersFetcher');
    expect(src).toContain('isCloudflareWorkers');
  });
});
