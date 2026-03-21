/**
 * Unit tests for BunFetcher
 *
 * Verifies that BunFetcher:
 *  - Uses Bun.fetch when globalThis.Bun.fetch is present
 *  - Falls back to globalThis.fetch when Bun is not available
 *  - Throws TimeoutError on AbortError with "TimeoutError" name
 *  - Throws RDAPServerError on non-2xx responses
 *  - Throws NetworkError on generic fetch failures
 *  - Applies SSRF protection before fetching
 */

import { BunFetcher } from '../../src/infrastructure/http/BunFetcher';
import {
  NetworkError,
  RDAPServerError,
  TimeoutError,
  SSRFProtectionError,
} from '../../src/shared/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return impl as unknown as typeof fetch;
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error('no body')),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// resolveFetch
// ---------------------------------------------------------------------------

describe('BunFetcher.resolveFetch()', () => {
  it('returns globalThis.fetch when Bun is not present', () => {
    const original = (globalThis as Record<string, unknown>)['Bun'];
    delete (globalThis as Record<string, unknown>)['Bun'];

    const resolved = BunFetcher.resolveFetch();
    expect(resolved).toBe(globalThis.fetch);

    if (original !== undefined) {
      (globalThis as Record<string, unknown>)['Bun'] = original;
    }
  });

  it('returns Bun.fetch when Bun runtime is detected', () => {
    const fakeBunFetch = jest.fn();
    (globalThis as Record<string, unknown>)['Bun'] = { fetch: fakeBunFetch };

    try {
      const resolved = BunFetcher.resolveFetch();
      expect(resolved).toBe(fakeBunFetch);
    } finally {
      delete (globalThis as Record<string, unknown>)['Bun'];
    }
  });

  it('falls back to globalThis.fetch when Bun.fetch is not a function', () => {
    (globalThis as Record<string, unknown>)['Bun'] = { fetch: 'not-a-function' };

    try {
      const resolved = BunFetcher.resolveFetch();
      expect(resolved).toBe(globalThis.fetch);
    } finally {
      delete (globalThis as Record<string, unknown>)['Bun'];
    }
  });
});

// ---------------------------------------------------------------------------
// BunFetcher.fetch()
// ---------------------------------------------------------------------------

describe('BunFetcher.fetch()', () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = jest.fn();
    globalThis.fetch = makeFetch(mockFetch);
    // Ensure Bun is absent so globalThis.fetch is used
    delete (globalThis as Record<string, unknown>)['Bun'];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed JSON on a successful response', async () => {
    const payload = { ldhName: 'example.com', objectClassName: 'domain' };
    mockFetch.mockResolvedValueOnce(okResponse(payload));

    const fetcher = new BunFetcher();
    const result = await fetcher.fetch('https://rdap.example.com/domain/example.com');

    expect(result).toEqual(payload);
  });

  it('sends User-Agent and Accept headers', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));

    const fetcher = new BunFetcher({ userAgent: 'TestAgent/1.0' });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('TestAgent/1.0');
    expect(headers['Accept']).toContain('rdap+json');
  });

  it('merges custom headers', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));

    const fetcher = new BunFetcher({ headers: { 'X-Custom': 'yes' } });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Custom']).toBe('yes');
  });

  it('throws RDAPServerError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404));

    const fetcher = new BunFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(
      RDAPServerError,
    );
  });

  it('includes HTTP status in RDAPServerError', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(429));

    const fetcher = new BunFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it('throws TimeoutError when fetch throws DOMException with name TimeoutError', async () => {
    const domEx = new DOMException('signal timed out', 'TimeoutError');
    mockFetch.mockRejectedValueOnce(domEx);

    const fetcher = new BunFetcher({ timeout: 100 });
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(
      TimeoutError,
    );
  });

  it('throws NetworkError on generic fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('connection refused'));

    const fetcher = new BunFetcher();
    await expect(fetcher.fetch('https://rdap.example.com/domain/example.com')).rejects.toThrow(
      NetworkError,
    );
  });

  it('uses Bun.fetch when Bun runtime is detected', async () => {
    const bunFetch = jest.fn().mockResolvedValueOnce(okResponse({ objectClassName: 'domain' }));
    (globalThis as Record<string, unknown>)['Bun'] = { fetch: bunFetch };

    try {
      const fetcher = new BunFetcher();
      await fetcher.fetch('https://rdap.example.com/domain/example.com');
      expect(bunFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as Record<string, unknown>)['Bun'];
    }
  });

  it('applies SSRF protection and throws SSRFProtectionError for private URLs', async () => {
    const ssrfGuard = {
      validateUrl: jest.fn().mockRejectedValueOnce(
        new SSRFProtectionError('Blocked: private IP', undefined, { url: 'http://192.168.1.1' }),
      ),
    };

    const fetcher = new BunFetcher({ ssrfProtection: ssrfGuard as never });
    await expect(fetcher.fetch('http://192.168.1.1/rdap/domain/test')).rejects.toThrow(
      SSRFProtectionError,
    );
    expect(ssrfGuard.validateUrl).toHaveBeenCalledWith('http://192.168.1.1/rdap/domain/test');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call fetch when SSRF protection blocks', async () => {
    const ssrfGuard = {
      validateUrl: jest.fn().mockRejectedValueOnce(
        new SSRFProtectionError('Blocked', undefined, { url: 'http://localhost' }),
      ),
    };

    const fetcher = new BunFetcher({ ssrfProtection: ssrfGuard as never });
    await expect(fetcher.fetch('http://localhost/rdap')).rejects.toBeInstanceOf(SSRFProtectionError);
    expect(mockFetch).toHaveBeenCalledTimes(0);
  });

  it('uses the configured timeout', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));

    const fetcher = new BunFetcher({ timeout: 5000 });
    await fetcher.fetch('https://rdap.example.com/domain/example.com');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    // AbortSignal is passed; we can't easily inspect the timeout, but the call must succeed
    expect(init.signal).toBeDefined();
  });
});
