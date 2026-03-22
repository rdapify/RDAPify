/**
 * Unit tests for BrowserFetcher
 */

import { BrowserFetcher } from '../../src/infrastructure/http/BrowserFetcher';
import { NetworkError, RDAPServerError, TimeoutError } from '../../src/shared/errors';

// ---------------------------------------------------------------------------
// globalThis.fetch mock
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
(globalThis as Record<string, unknown>)['fetch'] = mockFetch;

// AbortSignal.timeout is available in Node 17.3+; polyfill for older envs
if (!AbortSignal.timeout) {
  (AbortSignal as unknown as Record<string, unknown>)['timeout'] = (_ms: number) =>
    new AbortController().signal;
}

function makeOkResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  };
}

function makeErrorResponse(status: number) {
  return { ok: false, status, json: jest.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrowserFetcher', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('throws when proxyUrl is not provided', () => {
    expect(() => new BrowserFetcher({ proxyUrl: '' })).toThrow('proxyUrl is required');
  });

  it('constructs and exposes proxyUrl (trailing slash stripped)', () => {
    const f = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com/rdap/' });
    expect(f.getProxyUrl()).toBe('https://proxy.example.com/rdap');
  });

  it('fetches RDAP data via proxy URL with encoded target', async () => {
    const rdapData = { objectClassName: 'domain', ldhName: 'example.com' };
    mockFetch.mockResolvedValue(makeOkResponse(rdapData));

    const fetcher = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com' });
    const result = await fetcher.fetch('https://rdap.verisign.com/com/v1/domain/example.com');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://proxy.example.com?url='),
      expect.any(Object)
    );
    const calledUrl: string = (mockFetch.mock.calls[0] as [string, ...unknown[]])[0];
    expect(calledUrl).toContain(encodeURIComponent('https://rdap.verisign.com'));
    expect(result).toEqual(rdapData);
  });

  it('throws RDAPServerError when proxy returns non-ok status', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404));

    const fetcher = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com' });
    await expect(fetcher.fetch('https://rdap.example.com/domain/x.com')).rejects.toBeInstanceOf(
      RDAPServerError
    );
  });

  it('throws NetworkError on generic fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const fetcher = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com' });
    await expect(fetcher.fetch('https://rdap.example.com/domain/x.com')).rejects.toBeInstanceOf(
      NetworkError
    );
  });

  it('re-throws RDAPifyError instances without wrapping', async () => {
    const rdapErr = new RDAPServerError('already wrapped', 503);
    mockFetch.mockRejectedValue(rdapErr);

    const fetcher = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com' });
    await expect(fetcher.fetch('https://rdap.example.com/domain/x.com')).rejects.toBe(rdapErr);
  });

  it('throws TimeoutError on DOMException TimeoutError', async () => {
    const domTimeout = new DOMException('timeout', 'TimeoutError');
    mockFetch.mockRejectedValue(domTimeout);

    const fetcher = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com', timeout: 100 });
    await expect(fetcher.fetch('https://rdap.example.com/domain/x.com')).rejects.toBeInstanceOf(
      TimeoutError
    );
  });

  it('includes custom headers in the request', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({}));

    const fetcher = new BrowserFetcher({
      proxyUrl: 'https://proxy.example.com',
      headers: { 'X-Api-Key': 'secret' },
    });
    await fetcher.fetch('https://rdap.example.com/domain/x.com');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['X-Api-Key']).toBe('secret');
  });

  it('wraps non-Error thrown objects in NetworkError', async () => {
    mockFetch.mockRejectedValue('string error');

    const fetcher = new BrowserFetcher({ proxyUrl: 'https://proxy.example.com' });
    await expect(fetcher.fetch('https://rdap.example.com/domain/x.com')).rejects.toBeInstanceOf(
      NetworkError
    );
  });
});
