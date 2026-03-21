/**
 * Live integration tests — run against real RDAP servers.
 *
 * These tests require a network connection and are intentionally opt-in.
 * They are excluded from the regular `npm test` run.
 *
 * Usage:
 *   LIVE_TESTS=1 npm run test:live
 *
 * In CI: triggered weekly via `.github/workflows/live-tests.yml`
 * They never block a merge — they run in a separate scheduled workflow.
 */

import { RDAPClient } from '../../src/application/client/RDAPClient';
import { RDAPServerError, NoServerFoundError } from '../../src/shared/errors';

const SKIP = !process.env['LIVE_TESTS'];
const maybeDescribe = SKIP ? describe.skip : describe;

// Generous timeout for live network calls
const LIVE_TIMEOUT = 25_000;

maybeDescribe('Live RDAP — Verisign (.com / .net)', () => {
  let client: RDAPClient;

  beforeAll(() => {
    client = new RDAPClient({
      cache: false,
      retry: { maxAttempts: 2, initialDelay: 500 },
    });
  });

  afterAll(() => client.destroy());

  it(
    'queries a registered .com domain and returns a valid DomainResponse',
    async () => {
      const result = await client.domain('example.com');

      expect(result.objectClass).toBe('domain');
      expect(result.ldhName?.toLowerCase()).toBe('example.com');
      expect(result.status).toBeDefined();
      expect(result.metadata.source).toMatch(/verisign/i);
      expect(result.metadata.cached).toBe(false);
    },
    LIVE_TIMEOUT
  );

  it(
    'queries a registered .net domain',
    async () => {
      const result = await client.domain('iana.net');

      expect(result.objectClass).toBe('domain');
      expect(result.metadata.source).toMatch(/verisign/i);
    },
    LIVE_TIMEOUT
  );

  it(
    'checkAvailability returns available: false for example.com',
    async () => {
      const result = await client.checkAvailability('example.com');

      expect(result.domain).toBe('example.com');
      expect(result.available).toBe(false);
    },
    LIVE_TIMEOUT
  );

  it(
    'checkAvailability returns available: true for an unregistered domain',
    async () => {
      // Use a domain highly unlikely to be registered
      const result = await client.checkAvailability(
        'rdapify-live-test-this-should-not-exist-99999.com'
      );

      expect(result.available).toBe(true);
    },
    LIVE_TIMEOUT
  );
});

maybeDescribe('Live RDAP — ARIN (IPv4)', () => {
  let client: RDAPClient;

  beforeAll(() => {
    client = new RDAPClient({ cache: false });
  });

  afterAll(() => client.destroy());

  it(
    'queries 8.8.8.8 (Google DNS) and returns a valid IPResponse',
    async () => {
      const result = await client.ip('8.8.8.8');

      expect(result.objectClass).toBe('ip network');
      expect(result.ipVersion).toBe('v4');
      expect(result.metadata.source).toMatch(/arin/i);
    },
    LIVE_TIMEOUT
  );

  it(
    'queries 1.1.1.1 (Cloudflare DNS)',
    async () => {
      const result = await client.ip('1.1.1.1');

      expect(result.objectClass).toBe('ip network');
      expect(result.ipVersion).toBe('v4');
    },
    LIVE_TIMEOUT
  );
});

maybeDescribe('Live RDAP — RIPE (IPv4 European range)', () => {
  let client: RDAPClient;

  beforeAll(() => {
    client = new RDAPClient({ cache: false });
  });

  afterAll(() => client.destroy());

  it(
    'queries a RIPE-managed IP address',
    async () => {
      // 193.0.0.1 is RIPE NCC's own IP
      const result = await client.ip('193.0.0.1');

      expect(result.objectClass).toBe('ip network');
      expect(result.metadata.source).toMatch(/ripe/i);
    },
    LIVE_TIMEOUT
  );
});

maybeDescribe('Live RDAP — ASN', () => {
  let client: RDAPClient;

  beforeAll(() => {
    client = new RDAPClient({ cache: false });
  });

  afterAll(() => client.destroy());

  it(
    'queries ASN 15169 (Google)',
    async () => {
      const result = await client.asn(15169);

      expect(result.objectClass).toBe('autnum');
      expect(result.name).toBeDefined();
    },
    LIVE_TIMEOUT
  );
});

maybeDescribe('Live RDAP — Error handling', () => {
  let client: RDAPClient;

  beforeAll(() => {
    client = new RDAPClient({ cache: false });
  });

  afterAll(() => client.destroy());

  it(
    'throws RDAPServerError(404) for a non-existent domain',
    async () => {
      await expect(
        client.domain('rdapify-live-test-this-should-not-exist-99999.com')
      ).rejects.toBeInstanceOf(RDAPServerError);
    },
    LIVE_TIMEOUT
  );

  it(
    'throws NoServerFoundError or RDAPServerError for an unsupported TLD',
    async () => {
      // .invalid is a reserved TLD with no RDAP server
      await expect(client.domain('test.invalid')).rejects.toThrow();
    },
    LIVE_TIMEOUT
  );
});
