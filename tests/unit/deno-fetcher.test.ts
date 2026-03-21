/**
 * Unit tests for DenoFetcher
 */

import { DenoFetcher } from '../../src/infrastructure/http/DenoFetcher';
import { NetworkError, RDAPServerError, TimeoutError, SSRFProtectionError } from '../../src/shared/errors';

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: () => Promise.reject(new Error('no body')) } as unknown as Response;
}

describe('DenoFetcher', () => {
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

    const fetcher = new DenoFetcher();
    const result = await fetcher.fetch('https://rdap.example.com/domain/example.com');
    expect(result).toEqual(payload);
  });

  it('uses Deno-specific User-Agent by default', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));

    const fetcher = new DenoFetcher();
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('Deno');
  });

  it('accepts custom User-Agent', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const fetcher = new DenoFetcher({ userAgent: 'MyAgent/1.0' });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('MyAgent/1.0');
  });

  it('merges custom headers', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const fetcher = new DenoFetcher({ headers: { 'X-Deno': 'true' } });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Deno']).toBe('true');
  });

  it('throws RDAPServerError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404));
    const fetcher = new DenoFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(RDAPServerError);
  });

  it('throws TimeoutError on DOMException TimeoutError', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));
    const fetcher = new DenoFetcher({ timeout: 100 });
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(TimeoutError);
  });

  it('throws NetworkError on generic failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('connection refused'));
    const fetcher = new DenoFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(NetworkError);
  });

  it('applies SSRF protection before fetch', async () => {
    const ssrfGuard = {
      validateUrl: jest.fn().mockRejectedValueOnce(
        new SSRFProtectionError('Blocked', undefined, { url: 'http://localhost' }),
      ),
    };
    const fetcher = new DenoFetcher({ ssrfProtection: ssrfGuard as never });
    await expect(fetcher.fetch('http://localhost/rdap')).rejects.toBeInstanceOf(SSRFProtectionError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not use Node.js-specific require()', () => {
    // Verify no require() in the module source — structural test
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/infrastructure/http/DenoFetcher.ts'),
      'utf8',
    ) as string;
    expect(src).not.toMatch(/\brequire\s*\(/);
  });
});
