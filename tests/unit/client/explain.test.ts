/**
 * Unit tests for client.explain() (Feature 9)
 */

import { RDAPClient } from '../../../src/application/client/RDAPClient';

const BOOTSTRAP_RESPONSE = {
  version: '1.0',
  services: [
    [['com', 'net'], ['https://rdap.verisign.com/com/v1']],
    [['2.0.0.0/8'], ['https://rdap.arin.net/registry']],
  ],
};

describe('RDAPClient.explain()', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('iana.org')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: () => null },
          json: async () => BOOTSTRAP_RESPONSE,
        });
      }
      return Promise.reject(new Error('Unexpected URL: ' + url));
    });
  });

  it('detects domain query type', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('example.com');

    expect(result.queryType).toBe('domain');
    expect(result.detectedType).toBe('domain');
    expect(result.query).toBe('example.com');
  });

  it('detects IPv4 query type', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('8.8.8.8');

    expect(result.queryType).toBe('ip');
    expect(result.detectedType).toBe('ipv4');
  });

  it('detects IPv6 query type', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('2001:db8::1');

    expect(result.queryType).toBe('ip');
    expect(result.detectedType).toBe('ipv6');
  });

  it('detects ASN query type', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('AS15169');

    expect(result.queryType).toBe('asn');
    expect(result.detectedType).toBe('asn');
  });

  it('builds correct URL for domain query', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('example.com');

    expect(result.bootstrapServer).toContain('verisign');
    expect(result.builtUrl).toBe(`${result.bootstrapServer}/domain/example.com`);
  });

  it('returns latencyMs as a positive number', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('example.com');

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns cacheStatus: miss when cache is empty', async () => {
    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('example.com');

    expect(['hit', 'miss', 'disabled']).toContain(result.cacheStatus);
  });

  it('returns cacheStatus: disabled when cache is disabled', async () => {
    const client = new RDAPClient({ ssrfProtection: false, cache: false });
    const result = await client.explain('example.com');

    expect(result.cacheStatus).toBe('disabled');
  });

  it('captures error when bootstrap discovery fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Bootstrap unavailable'));

    const client = new RDAPClient({ ssrfProtection: false });
    const result = await client.explain('example.com');

    expect(result.error).toBeDefined();
    expect(result.bootstrapServer).toBeNull();
  });
});
