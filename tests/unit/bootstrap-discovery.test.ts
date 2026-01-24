/**
 * Tests for BootstrapDiscovery CIDR matching
 */

import { BootstrapDiscovery } from '../../src/infrastructure/http/BootstrapDiscovery';
import { Fetcher } from '../../src/infrastructure/http/Fetcher';

describe('BootstrapDiscovery', () => {
  describe('CIDR matching (via IPv4 discovery)', () => {
    let discovery: BootstrapDiscovery;
    let mockFetcher: jest.Mocked<Fetcher>;

    beforeEach(() => {
      mockFetcher = {
        fetch: jest.fn(),
      } as any;
      discovery = new BootstrapDiscovery('https://test.example', mockFetcher);
    });

    it('should match IPv4 address in CIDR range', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['8.0.0.0/8'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('8.8.8.8');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should not match IPv4 outside CIDR range', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['8.0.0.0/8'], ['https://rdap.example.com']],
        ],
      });

      await expect(discovery.discoverIPv4('9.9.9.9')).rejects.toThrow('No RDAP server found');
    });

    it('should match exact IP when no CIDR notation', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['8.8.8.8'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('8.8.8.8');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should not match different IP when no CIDR notation', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['8.8.8.8'], ['https://rdap.example.com']],
        ],
      });

      await expect(discovery.discoverIPv4('8.8.8.9')).rejects.toThrow('No RDAP server found');
    });

    it('should handle private IPv4 ranges (10.0.0.0/8)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['10.0.0.0/8'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('10.1.2.3');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle private IPv4 ranges (172.16.0.0/12)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['172.16.0.0/12'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('172.20.1.1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle private IPv4 ranges (192.168.0.0/16)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['192.168.0.0/16'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('192.168.1.1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle loopback range (127.0.0.0/8)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['127.0.0.0/8'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('127.0.0.1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle link-local range (169.254.0.0/16)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['169.254.0.0/16'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('169.254.1.1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle multicast range (224.0.0.0/4)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['224.0.0.0/4'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv4('224.0.0.1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should fail-closed on malformed CIDR', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['invalid/cidr'], ['https://rdap.example.com']],
        ],
      });

      await expect(discovery.discoverIPv4('8.8.8.8')).rejects.toThrow('No RDAP server found');
    });
  });

  describe('CIDR matching (via IPv6 discovery)', () => {
    let discovery: BootstrapDiscovery;
    let mockFetcher: jest.Mocked<Fetcher>;

    beforeEach(() => {
      mockFetcher = {
        fetch: jest.fn(),
      } as any;
      discovery = new BootstrapDiscovery('https://test.example', mockFetcher);
    });

    it('should match IPv6 address in CIDR range', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['2001:db8::/32'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv6('2001:db8::1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should not match IPv6 outside CIDR range', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['2001:db8::/32'], ['https://rdap.example.com']],
        ],
      });

      await expect(discovery.discoverIPv6('2001:db9::1')).rejects.toThrow('No RDAP server found');
    });

    it('should handle IPv6 loopback (::1)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['::1/128'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv6('::1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle IPv6 ULA (fc00::/7)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['fc00::/7'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv6('fc00::1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should handle IPv6 link-local (fe80::/10)', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['fe80::/10'], ['https://rdap.example.com']],
        ],
      });

      const result = await discovery.discoverIPv6('fe80::1');
      expect(result).toBe('https://rdap.example.com');
    });

    it('should fail-closed on malformed IPv6 CIDR', async () => {
      mockFetcher.fetch.mockResolvedValueOnce({
        version: '1.0',
        services: [
          [['invalid::/cidr'], ['https://rdap.example.com']],
        ],
      });

      await expect(discovery.discoverIPv6('2001:db8::1')).rejects.toThrow('No RDAP server found');
    });
  });
});
