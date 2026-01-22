/**
 * Integration tests for RDAPClient with mocked network calls
 * Uses fixtures to simulate real RDAP responses
 */

import { RDAPClient } from '../../src/client/RDAPClient';
import * as bootstrapDns from '../fixtures/bootstrap-dns.json';
import * as bootstrapIpv4 from '../fixtures/bootstrap-ipv4.json';
import * as bootstrapAsn from '../fixtures/bootstrap-asn.json';
import * as rdapDomain from '../fixtures/rdap-domain-example.json';
import * as rdapIp from '../fixtures/rdap-ip-8888.json';
import * as rdapAsn from '../fixtures/rdap-asn-15169.json';

// Mock global fetch
global.fetch = jest.fn();

describe('RDAPClient Integration Tests (Mocked)', () => {
  let client: RDAPClient;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    client = new RDAPClient({ 
      cache: false, // Disable cache for predictable tests
      privacy: { redactPII: false } // Disable PII redaction for testing
    });
    mockFetch.mockClear();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('domain queries', () => {
    it('should successfully query domain with bootstrap discovery', async () => {
      // Mock bootstrap DNS response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => bootstrapDns,
      } as Response);

      // Mock RDAP domain response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/rdap+json' }),
        json: async () => rdapDomain,
      } as Response);

      const result = await client.domain('example.com');

      expect(result.objectClass).toBe('domain');
      expect(result.ldhName).toBe('example.com');
      expect(result.status).toContain('active');
      expect(result.nameservers).toHaveLength(2);
      expect(result.nameservers).toContain('ns1.example.com');
      expect(result.metadata.source).toBe('https://rdap.verisign.com/com/v1');
      expect(result.metadata.cached).toBe(false);

      // Verify fetch was called twice (bootstrap + RDAP)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://data.iana.org/rdap/dns.json',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://rdap.verisign.com/com/v1/domain/example.com',
        expect.any(Object)
      );
    });

    it('should extract registrar information', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapDns,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapDomain,
      } as Response);

      const result = await client.domain('example.com');

      expect(result.registrar).toBeDefined();
      expect(result.registrar?.name).toBe('Example Registrar Inc.');
      expect(result.registrar?.handle).toBe('REG123');
    });

    it('should extract events correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapDns,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapDomain,
      } as Response);

      const result = await client.domain('example.com');

      expect(result.events).toHaveLength(2);
      const regEvent = result.events.find(e => e.type === 'registration');
      const expEvent = result.events.find(e => e.type === 'expiration');
      
      expect(regEvent).toBeDefined();
      expect(expEvent).toBeDefined();
      if (regEvent && expEvent) {
        expect(regEvent.date).toBe('1995-08-14T04:00:00Z');
        expect(expEvent.date).toBe('2025-08-13T04:00:00Z');
      }
    });
  });

  describe('IP queries', () => {
    it('should successfully query IPv4 address', async () => {
      // Mock bootstrap IPv4 response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapIpv4,
      } as Response);

      // Mock RDAP IP response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapIp,
      } as Response);

      const result = await client.ip('8.8.8.8');

      expect(result.objectClass).toBe('ip network');
      expect(result.startAddress).toBe('8.0.0.0');
      expect(result.endAddress).toBe('8.255.255.255');
      expect(result.ipVersion).toBe('v4');
      expect(result.country).toBe('US');
      expect(result.metadata.source).toBe('https://rdap.arin.net/registry');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://data.iana.org/rdap/ipv4.json',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://rdap.arin.net/registry/ip/8.8.8.8',
        expect.any(Object)
      );
    });

    it('should normalize IP address', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapIpv4,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapIp,
      } as Response);

      // Query with spaces (should be normalized)
      const result = await client.ip('  8.8.8.8  ');

      expect(result.query).toBe('8.8.8.8');
      expect(result.objectClass).toBe('ip network');
    });
  });

  describe('ASN queries', () => {
    it('should successfully query ASN by number', async () => {
      // Mock bootstrap ASN response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapAsn,
      } as Response);

      // Mock RDAP ASN response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapAsn,
      } as Response);

      const result = await client.asn(15169);

      expect(result.objectClass).toBe('autnum');
      expect(result.startAutnum).toBe(15169);
      expect(result.endAutnum).toBe(15169);
      expect(result.name).toBe('GOOGLE');
      expect(result.country).toBe('US');
      expect(result.metadata.source).toBe('https://rdap.arin.net/registry');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://data.iana.org/rdap/asn.json',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://rdap.arin.net/registry/autnum/15169',
        expect.any(Object)
      );
    });

    it('should successfully query ASN by string with AS prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapAsn,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapAsn,
      } as Response);

      const result = await client.asn('AS15169');

      expect(result.query).toBe('AS15169');
      expect(result.startAutnum).toBe(15169);
      expect(result.name).toBe('GOOGLE');
    });

    it('should successfully query ASN by string without AS prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapAsn,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapAsn,
      } as Response);

      const result = await client.asn('15169');

      expect(result.query).toBe('AS15169');
      expect(result.startAutnum).toBe(15169);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.domain('example.com')).rejects.toThrow('Failed to fetch bootstrap data');
    });

    it('should handle invalid domain names', async () => {
      await expect(client.domain('')).rejects.toThrow('Domain must be a non-empty string');
      await expect(client.domain('invalid..domain')).rejects.toThrow('Invalid domain');
    });

    it('should handle invalid IP addresses', async () => {
      await expect(client.ip('999.999.999.999')).rejects.toThrow('Invalid IP');
      await expect(client.ip('not-an-ip')).rejects.toThrow('Invalid IP');
    });

    it('should handle invalid ASN', async () => {
      await expect(client.asn(-1)).rejects.toThrow('ASN out of valid range');
      await expect(client.asn(4294967296)).rejects.toThrow('ASN out of valid range');
    });
  });

  describe('caching behavior', () => {
    it('should not cache when cache is disabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => bootstrapDns,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => rdapDomain,
      } as Response);

      const result1 = await client.domain('example.com');
      expect(result1.metadata.cached).toBe(false);
    });
  });

  describe('retry behavior', () => {
    it('should not retry on validation errors', async () => {
      const retryClient = new RDAPClient({ 
        cache: false,
        retry: { maxAttempts: 3, initialDelay: 10, backoff: 'fixed' }
      });

      // Should fail immediately without retry
      await expect(retryClient.domain('')).rejects.toThrow('Domain must be a non-empty string');
      
      // Fetch should not be called at all
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
