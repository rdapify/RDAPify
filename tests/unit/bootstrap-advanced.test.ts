/**
 * Unit tests for Advanced Bootstrap Configuration
 * Tests: customServers, TTL override, fallback behaviour
 */

import { BootstrapDiscovery } from '../../src/infrastructure/http/BootstrapDiscovery';
import { Fetcher } from '../../src/infrastructure/http/Fetcher';
import { NoServerFoundError } from '../../src/shared/errors';

const dnsBootstrap = {
  version: '1.0',
  services: [
    [['com', 'net'], ['https://rdap.verisign.com/com/v1']],
    [['org'], ['https://rdap.publicinterestregistry.org/rdap']],
  ],
};

function makeFetcher(): jest.Mocked<Fetcher> {
  return { fetch: jest.fn() } as any;
}

describe('BootstrapDiscovery — customServers', () => {
  it('uses custom server for a configured TLD without calling IANA', async () => {
    const fetcher = makeFetcher();
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      customServers: [{ tld: 'com', url: 'https://my-rdap.internal/com' }],
    });

    const result = await discovery.discoverDomain('example.com');

    expect(result).toBe('https://my-rdap.internal/com');
    // IANA fetch must NOT be called
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('uses custom server for nameserver TLD without calling IANA', async () => {
    const fetcher = makeFetcher();
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      customServers: [{ tld: 'com', url: 'https://my-rdap.internal/com' }],
    });

    const result = await discovery.discoverNameserver('ns1.example.com');

    expect(result).toBe('https://my-rdap.internal/com');
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('is case-insensitive: TLD matching normalises to lowercase', async () => {
    const fetcher = makeFetcher();
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      customServers: [{ tld: 'COM', url: 'https://my-rdap.internal/com' }],
    });

    const result = await discovery.discoverDomain('example.COM');

    expect(result).toBe('https://my-rdap.internal/com');
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('falls back to IANA for TLDs not in customServers (fallback=true)', async () => {
    const fetcher = makeFetcher();
    fetcher.fetch.mockResolvedValueOnce(dnsBootstrap);

    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      customServers: [{ tld: 'net', url: 'https://my-rdap.internal/net' }],
      fallback: true,
    });

    const result = await discovery.discoverDomain('example.org');

    expect(result).toBe('https://rdap.publicinterestregistry.org/rdap');
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('BootstrapDiscovery — fallback: false', () => {
  it('throws NoServerFoundError for domain when fallback is disabled and no custom server', async () => {
    const fetcher = makeFetcher();
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      customServers: [{ tld: 'net', url: 'https://my-rdap.internal/net' }],
      fallback: false,
    });

    await expect(discovery.discoverDomain('example.org')).rejects.toBeInstanceOf(NoServerFoundError);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });

  it('throws NoServerFoundError for nameserver when fallback is disabled', async () => {
    const fetcher = makeFetcher();
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      fallback: false,
    });

    await expect(discovery.discoverNameserver('ns1.example.com')).rejects.toBeInstanceOf(NoServerFoundError);
    expect(fetcher.fetch).not.toHaveBeenCalled();
  });
});

describe('BootstrapDiscovery — TTL override', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('respects custom TTL: re-fetches after TTL expires', async () => {
    const fetcher = makeFetcher();
    fetcher.fetch.mockResolvedValue(dnsBootstrap);

    // TTL = 1 second
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      ttl: 1,
    });

    await discovery.discoverDomain('example.com');
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);

    // Advance time just past TTL
    jest.advanceTimersByTime(1001);

    await discovery.discoverDomain('example.com');
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not re-fetch within TTL', async () => {
    const fetcher = makeFetcher();
    fetcher.fetch.mockResolvedValue(dnsBootstrap);

    // TTL = 60 seconds
    const discovery = new BootstrapDiscovery('https://data.iana.org/rdap', fetcher, {
      ttl: 60,
    });

    await discovery.discoverDomain('example.com');
    jest.advanceTimersByTime(30000);
    await discovery.discoverDomain('example.com');

    // Still only fetched once
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('BootstrapDiscovery — RDAPClient integration', () => {
  it('client passes bootstrap options to BootstrapDiscovery', async () => {
    const { RDAPClient } = await import('../../src/application/client/RDAPClient');

    const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;

    // Custom server for .com — no IANA fetch needed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/rdap+json' }),
      json: async () => ({
        objectClassName: 'domain',
        ldhName: 'example.com',
        status: ['active'],
        events: [],
        entities: [],
      }),
    } as Response);

    const client = new RDAPClient({
      cache: false,
      privacy: { redactPII: false },
      bootstrap: {
        customServers: [{ tld: 'com', url: 'https://custom-rdap.example.com/v1' }],
        fallback: false,
      },
    });

    await client.domain('example.com');

    // Should only call the custom server — no IANA bootstrap fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-rdap.example.com/v1/domain/example.com',
      expect.any(Object)
    );

    client.destroy();
    jest.restoreAllMocks();
  });
});
