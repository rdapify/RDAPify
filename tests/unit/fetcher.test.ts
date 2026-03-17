/**
 * Tests for Fetcher — redirect handling, error paths, type safety
 */

import { Fetcher } from '../../src/infrastructure/http/Fetcher';
import { NetworkError, TimeoutError, RDAPServerError } from '../../src/shared/errors';

// Helper to create a mock Response
function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const jsonBody = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(jsonBody),
  } as unknown as Response;
}

describe('Fetcher', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('constructor defaults', () => {
    it('should create with default options', () => {
      const fetcher = new Fetcher();
      const config = fetcher.getConfig();

      expect(config.followRedirects).toBe(true);
      expect(config.maxRedirects).toBe(5);
      expect(config.timeout.request).toBe(10000);
      expect(config.timeout.connect).toBe(5000);
      expect(config.timeout.dns).toBe(3000);
      expect(config.userAgent).toContain('RDAPify');
    });

    it('should accept custom options', () => {
      const fetcher = new Fetcher({
        timeout: { request: 5000, connect: 2000, dns: 1000 },
        userAgent: 'TestAgent/1.0',
        followRedirects: false,
        maxRedirects: 3,
      });
      const config = fetcher.getConfig();

      expect(config.timeout.request).toBe(5000);
      expect(config.userAgent).toBe('TestAgent/1.0');
      expect(config.followRedirects).toBe(false);
      expect(config.maxRedirects).toBe(3);
    });
  });

  describe('successful fetch', () => {
    it('should return parsed JSON on success', async () => {
      const rdapData = { objectClassName: 'domain', handle: 'TEST-1' };
      global.fetch = jest.fn().mockResolvedValue(mockResponse(200, rdapData));

      const fetcher = new Fetcher();
      const result = await fetcher.fetch('https://rdap.example.com/domain/test.com');

      expect(result).toEqual(rdapData);
    });
  });

  describe('error responses', () => {
    it('should throw RDAPServerError on 404', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(404, { errorCode: 404 }));

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/notfound.com')).rejects.toThrow(
        RDAPServerError
      );
    });

    it('should throw RDAPServerError on 429 rate limit', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(429, { errorCode: 429 }));

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        RDAPServerError
      );
    });

    it('should throw RDAPServerError on 500 server error', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(500, 'Internal Server Error'));

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        RDAPServerError
      );
    });

    it('should handle non-JSON error body gracefully', async () => {
      const resp = mockResponse(503, null);
      (resp as any).json = () => Promise.reject(new Error('not json'));
      (resp as any).text = () => Promise.resolve('Service Unavailable');
      global.fetch = jest.fn().mockResolvedValue(resp);

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        RDAPServerError
      );
    });

    it('should handle completely unreadable error body', async () => {
      const resp = mockResponse(503, null);
      (resp as any).json = () => Promise.reject(new Error('not json'));
      (resp as any).text = () => Promise.reject(new Error('not text'));
      global.fetch = jest.fn().mockResolvedValue(resp);

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        RDAPServerError
      );
    });

    it('should throw NetworkError when JSON parse fails on success response', async () => {
      const resp = mockResponse(200, null);
      (resp as any).json = () => Promise.reject(new SyntaxError('Unexpected token'));
      global.fetch = jest.fn().mockResolvedValue(resp);

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });

    it('should throw NetworkError when response is not an object', async () => {
      const resp = mockResponse(200, null);
      (resp as any).json = () => Promise.resolve('just a string');
      global.fetch = jest.fn().mockResolvedValue(resp);

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });

    it('should throw NetworkError on network failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });
  });

  describe('redirect handling', () => {
    it('should follow redirects by default', async () => {
      const rdapData = { objectClassName: 'domain', handle: 'REDIRECTED' };
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse(301, null, { Location: 'https://rdap2.example.com/domain/test.com' })
        )
        .mockResolvedValueOnce(mockResponse(200, rdapData));

      const fetcher = new Fetcher();
      const result = await fetcher.fetch('https://rdap.example.com/domain/test.com');
      expect(result).toEqual(rdapData);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should call logRedirect on redirect', async () => {
      const rdapData = { objectClassName: 'domain' };
      const logRedirect = jest.fn();

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse(302, null, { Location: 'https://rdap2.example.com/domain/test.com' })
        )
        .mockResolvedValueOnce(mockResponse(200, rdapData));

      const fetcher = new Fetcher({ logRedirect });
      await fetcher.fetch('https://rdap.example.com/domain/test.com');

      expect(logRedirect).toHaveBeenCalledWith(
        'https://rdap.example.com/domain/test.com',
        'https://rdap2.example.com/domain/test.com'
      );
    });

    it('should throw NetworkError when followRedirects is false', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockResponse(301, null, { Location: 'https://rdap2.example.com/domain/test.com' })
        );

      const fetcher = new Fetcher({ followRedirects: false });
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });

    it('should throw NetworkError when redirect has no Location header', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse(301, null));

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });

    it('should throw NetworkError when too many redirects', async () => {
      const redirectResponse = mockResponse(301, null, {
        Location: 'https://rdap.example.com/domain/test.com',
      });
      global.fetch = jest.fn().mockResolvedValue(redirectResponse);

      const fetcher = new Fetcher({ maxRedirects: 2 });
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });

    it('should throw NetworkError on invalid redirect URL', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse(301, null, { Location: ':::invalid:::' }));

      const fetcher = new Fetcher();
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        NetworkError
      );
    });
  });

  describe('timeout handling', () => {
    it('should throw TimeoutError on request timeout', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(Object.assign(new Error('Request timeout after 10000ms'), {}));

      const fetcher = new Fetcher({ timeout: { request: 10000, connect: 5000, dns: 3000 } });
      await expect(fetcher.fetch('https://rdap.example.com/domain/test.com')).rejects.toThrow(
        TimeoutError
      );
    });
  });
});
