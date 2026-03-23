/**
 * Unit tests for client.validate() async config validation (Feature 7)
 */

import { RDAPClient } from '../../../src/application/client/RDAPClient';

describe('RDAPClient.validate()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns valid: true with no errors for default configuration', async () => {
    const client = new RDAPClient();
    const result = await client.validate();
    // Default config uses standard IANA bootstrap — no reachability check performed
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports error when custom bootstrap URL is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const client = new RDAPClient({
      bootstrapUrl: 'https://custom-bootstrap.example.com',
      ssrfProtection: false,
    });

    const result = await client.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Bootstrap URL unreachable'))).toBe(true);
  });

  it('does not check IANA bootstrap reachability (default URL)', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch;

    const client = new RDAPClient();
    await client.validate();

    // Should not have called fetch for bootstrap check (default URL is trusted)
    // (It may call fetch for other reasons, but not for bootstrap validation)
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('data.iana.org'),
      expect.anything()
    );
  });

  it('reports warning when SSRF protection is disabled', async () => {
    const client = new RDAPClient({ ssrfProtection: { enabled: false } });
    const result = await client.validate();
    expect(result.warnings.some(w => w.includes('SSRF protection disabled'))).toBe(true);
  });

  it('reports Redis error when Redis client ping fails', async () => {
    const fakeRedisClient = {
      ping: jest.fn().mockRejectedValue(new Error('Connection refused')),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      dbsize: jest.fn(),
    };

    const client = new RDAPClient({
      cache: { strategy: 'redis', redisClient: fakeRedisClient },
    });

    const result = await client.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Redis'))).toBe(true);
  });
});
