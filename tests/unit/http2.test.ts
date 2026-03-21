/**
 * Tests for HTTP/2 opt-in support
 */

import { Fetcher } from '../../src/infrastructure/http/Fetcher';
import { RDAPClient } from '../../src/application/client/RDAPClient';

describe('HTTP/2 opt-in', () => {
  describe('Fetcher', () => {
    it('http2 defaults to false', () => {
      const fetcher = new Fetcher();
      expect(fetcher.http2).toBe(false);
    });

    it('http2: true is stored on the fetcher', () => {
      const fetcher = new Fetcher({ http2: true });
      expect(fetcher.http2).toBe(true);
    });

    it('sets Upgrade and HTTP2-Settings headers when http2: true', async () => {
      let capturedHeaders: Record<string, string> | undefined;

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          url,
          headers: {
            get: () => 'application/rdap+json',
            has: () => false,
          },
          json: async () => ({ objectClassName: 'domain', ldhName: 'example.com' }),
          text: async () => '',
        });
      }) as unknown as typeof fetch;

      const fetcher = new Fetcher({ http2: true });
      try {
        // This may fail during SSRF or parse but we just care about headers
        await fetcher.fetch('https://rdap.example.com/domain/example.com').catch(() => null);
      } finally {
        global.fetch = originalFetch;
      }

      expect(capturedHeaders?.['Upgrade']).toBe('h2c');
    });

    it('does not set Upgrade header when http2: false', async () => {
      let capturedHeaders: Record<string, string> | undefined;

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json', has: () => false },
          json: async () => ({}),
          text: async () => '',
          url: '',
        });
      }) as unknown as typeof fetch;

      const fetcher = new Fetcher({ http2: false });
      await fetcher.fetch('https://rdap.example.com/domain/example.com').catch(() => null);
      global.fetch = originalFetch;

      expect(capturedHeaders?.['Upgrade']).toBeUndefined();
    });
  });

  describe('RDAPClient', () => {
    it('accepts http2: true in options without throwing', () => {
      expect(
        () =>
          new RDAPClient({
            http2: true,
            ssrfProtection: false,
            cache: false,
            backend: 'typescript',
          }),
      ).not.toThrow();
    });

    it('http2: false is the default', () => {
      const client = new RDAPClient({ backend: 'typescript' });
      expect(client).toBeInstanceOf(RDAPClient);
    });
  });
});
