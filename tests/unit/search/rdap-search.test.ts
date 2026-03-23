/**
 * Unit tests for RDAP Search API (Feature 5)
 */

import { RDAPClient } from '../../../src/application/client/RDAPClient';
import { SearchNotSupportedError, RDAPServerError } from '../../../src/shared/errors';

describe('RDAP Search API', () => {
  const SERVER = 'https://rdap.verisign.com/com/v1';

  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Default bootstrap mock
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('iana.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: () => null },
          json: async () => ({
            version: '1.0',
            services: [[['com'], [SERVER]]],
          }),
        });
      }
      return Promise.reject(new Error('Unexpected URL: ' + url));
    });
  });

  describe('searchDomains()', () => {
    it('returns search results for matching domains', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('iana.org')) {
          return Promise.resolve({
            ok: true, status: 200, statusText: 'OK',
            headers: { get: () => null },
            json: async () => ({ version: '1.0', services: [[['com'], [SERVER]]] }),
          });
        }
        if (url.includes('/domains?name=')) {
          return Promise.resolve({
            ok: true, status: 200, statusText: 'OK',
            headers: { get: () => null },
            json: async () => ({
              domainSearchResults: [
                { objectClassName: 'domain', handle: 'EXAMPLE-COM', ldhName: 'example.com' },
              ],
            }),
          });
        }
        return Promise.reject(new Error('Unexpected: ' + url));
      });

      const client = new RDAPClient({ ssrfProtection: false });
      const results = await client.searchDomains('example*', SERVER);

      expect(results.results).toHaveLength(1);
      expect(results.results[0]?.objectClass).toBe('domain');
      expect(results.query).toBe('example*');
    });

    it('throws SearchNotSupportedError when server returns 404', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('iana.org')) {
          return Promise.resolve({
            ok: true, status: 200, statusText: 'OK',
            headers: { get: () => null },
            json: async () => ({ version: '1.0', services: [[['com'], [SERVER]]] }),
          });
        }
        return Promise.resolve({
          ok: false, status: 404, statusText: 'Not Found',
          headers: { get: () => null },
          json: async () => ({ errorCode: 404 }),
        });
      });

      const client = new RDAPClient({ ssrfProtection: false });
      await expect(client.searchDomains('example*', SERVER)).rejects.toThrow(
        SearchNotSupportedError
      );
    });

    it('throws SearchNotSupportedError when server returns 501', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('iana.org')) {
          return Promise.resolve({
            ok: true, status: 200, statusText: 'OK',
            headers: { get: () => null },
            json: async () => ({ version: '1.0', services: [[['com'], [SERVER]]] }),
          });
        }
        return Promise.resolve({
          ok: false, status: 501, statusText: 'Not Implemented',
          headers: { get: () => null },
          json: async () => ({ errorCode: 501 }),
        });
      });

      const client = new RDAPClient({ ssrfProtection: false });
      await expect(client.searchDomains('example*', SERVER)).rejects.toThrow(
        SearchNotSupportedError
      );
    });
  });

  describe('searchEntities()', () => {
    it('returns search results for matching entities', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('iana.org')) {
          return Promise.resolve({
            ok: true, status: 200, statusText: 'OK',
            headers: { get: () => null },
            json: async () => ({ version: '1.0', services: [[['com'], [SERVER]]] }),
          });
        }
        if (url.includes('/entities?fn=')) {
          return Promise.resolve({
            ok: true, status: 200, statusText: 'OK',
            headers: { get: () => null },
            json: async () => ({
              entitySearchResults: [
                { objectClassName: 'entity', handle: 'ARIN-HN-1' },
              ],
            }),
          });
        }
        return Promise.reject(new Error('Unexpected: ' + url));
      });

      const client = new RDAPClient({ ssrfProtection: false });
      const results = await client.searchEntities('Example Corp', 'https://rdap.arin.net/registry');

      expect(results.results).toHaveLength(1);
      expect(results.results[0]?.objectClass).toBe('entity');
    });

    it('throws SearchNotSupportedError when no serverUrl provided', async () => {
      const client = new RDAPClient({ ssrfProtection: false });
      await expect(client.searchEntities('Example Corp')).rejects.toThrow(SearchNotSupportedError);
    });
  });
});
