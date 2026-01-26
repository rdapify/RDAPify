/**
 * Tests for ProxyManager
 */

import { ProxyManager } from '../../src/infrastructure/http/ProxyManager';

describe('ProxyManager', () => {
  describe('constructor', () => {
    it('should create proxy manager with basic config', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
      });

      expect(proxy.getInfo().host).toBe('proxy.example.com');
      expect(proxy.getInfo().port).toBe(8080);
    });

    it('should use default protocol', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
      });

      expect(proxy.getInfo().protocol).toBe('http');
    });

    it('should accept custom protocol', () => {
      const proxy = new ProxyManager({
        protocol: 'https',
        host: 'proxy.example.com',
        port: 8080,
      });

      expect(proxy.getInfo().protocol).toBe('https');
    });

    it('should throw error without host', () => {
      expect(() => {
        new ProxyManager({
          host: '',
          port: 8080,
        });
      }).toThrow('Proxy host is required');
    });

    it('should throw error with invalid port', () => {
      expect(() => {
        new ProxyManager({
          host: 'proxy.example.com',
          port: 0,
        });
      }).toThrow('Proxy port must be between 1 and 65535');
    });

    it('should throw error with incomplete auth', () => {
      expect(() => {
        new ProxyManager({
          host: 'proxy.example.com',
          port: 8080,
          auth: {
            username: 'user',
            password: '',
          },
        });
      }).toThrow('Proxy auth requires both username and password');
    });
  });

  describe('getProxyUrl', () => {
    it('should generate proxy URL without auth', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
      });

      expect(proxy.getProxyUrl()).toBe('http://proxy.example.com:8080');
    });

    it('should generate proxy URL with auth', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user',
          password: 'pass',
        },
      });

      expect(proxy.getProxyUrl()).toBe('http://user:pass@proxy.example.com:8080');
    });

    it('should encode special characters in auth', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user@domain',
          password: 'p@ss:word',
        },
      });

      const url = proxy.getProxyUrl();
      expect(url).toContain('user%40domain');
      expect(url).toContain('p%40ss%3Aword');
    });
  });

  describe('shouldBypass', () => {
    it('should not bypass by default', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
      });

      expect(proxy.shouldBypass('https://example.com')).toBe(false);
    });

    it('should bypass exact match', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        bypassList: ['localhost', 'internal.example.com'],
      });

      expect(proxy.shouldBypass('http://localhost')).toBe(true);
      expect(proxy.shouldBypass('https://internal.example.com')).toBe(true);
      expect(proxy.shouldBypass('https://example.com')).toBe(false);
    });

    it('should bypass wildcard patterns', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        bypassList: ['*.internal.com'],
      });

      expect(proxy.shouldBypass('https://api.internal.com')).toBe(true);
      expect(proxy.shouldBypass('https://web.internal.com')).toBe(true);
      expect(proxy.shouldBypass('https://external.com')).toBe(false);
    });
  });

  describe('bypass list management', () => {
    it('should add bypass pattern', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
      });

      proxy.addBypass('localhost');
      expect(proxy.shouldBypass('http://localhost')).toBe(true);
    });

    it('should remove bypass pattern', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        bypassList: ['localhost'],
      });

      proxy.removeBypass('localhost');
      expect(proxy.shouldBypass('http://localhost')).toBe(false);
    });

    it('should get bypass list', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        bypassList: ['localhost', '*.internal.com'],
      });

      const list = proxy.getBypassList();
      expect(list).toContain('localhost');
      expect(list).toContain('*.internal.com');
    });
  });

  describe('getInfo', () => {
    it('should return proxy info', () => {
      const proxy = new ProxyManager({
        protocol: 'https',
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user',
          password: 'pass',
        },
        timeout: 5000,
        bypassList: ['localhost'],
      });

      const info = proxy.getInfo();
      expect(info.protocol).toBe('https');
      expect(info.host).toBe('proxy.example.com');
      expect(info.port).toBe(8080);
      expect(info.hasAuth).toBe(true);
      expect(info.timeout).toBe(5000);
      expect(info.bypassCount).toBe(1);
    });

    it('should not expose sensitive auth data', () => {
      const proxy = new ProxyManager({
        host: 'proxy.example.com',
        port: 8080,
        auth: {
          username: 'user',
          password: 'secret',
        },
      });

      const info = proxy.getInfo();
      expect(info).not.toHaveProperty('username');
      expect(info).not.toHaveProperty('password');
      expect(info.hasAuth).toBe(true);
    });
  });
});
