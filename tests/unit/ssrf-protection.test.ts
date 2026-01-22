/**
 * Unit tests for SSRF Protection
 */

import { SSRFProtection } from '../../src/fetcher/SSRFProtection';
import { SSRFProtectionError } from '../../src/types/errors';

describe('SSRFProtection', () => {
  let protection: SSRFProtection;

  beforeEach(() => {
    protection = new SSRFProtection({
      enabled: true,
      blockPrivateIPs: true,
      blockLocalhost: true,
      blockLinkLocal: true,
    });
  });

  describe('validateUrl', () => {
    describe('protocol validation', () => {
      it('should accept HTTPS URLs', async () => {
        await expect(protection.validateUrl('https://example.com')).resolves.not.toThrow();
      });

      it('should reject HTTP URLs', async () => {
        await expect(protection.validateUrl('http://example.com')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should reject other protocols', async () => {
        await expect(protection.validateUrl('ftp://example.com')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('file:///etc/passwd')).rejects.toThrow(
          SSRFProtectionError
        );
      });
    });

    describe('private IP blocking', () => {
      it('should block private IPv4 addresses', async () => {
        await expect(protection.validateUrl('https://10.0.0.1')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://172.16.0.1')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://192.168.1.1')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should allow public IPv4 addresses', async () => {
        await expect(protection.validateUrl('https://8.8.8.8')).resolves.not.toThrow();

        await expect(protection.validateUrl('https://1.1.1.1')).resolves.not.toThrow();
      });
    });

    describe('localhost blocking', () => {
      it('should block localhost IP', async () => {
        await expect(protection.validateUrl('https://127.0.0.1')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://127.0.0.2')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should block localhost domain', async () => {
        await expect(protection.validateUrl('https://localhost')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://localhost.localdomain')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should block IPv6 localhost', async () => {
        await expect(protection.validateUrl('https://[::1]')).rejects.toThrow(SSRFProtectionError);
      });
    });

    describe('link-local blocking', () => {
      it('should block link-local IPv4', async () => {
        await expect(protection.validateUrl('https://169.254.0.1')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should block link-local IPv6', async () => {
        await expect(protection.validateUrl('https://[fe80::1]')).rejects.toThrow(
          SSRFProtectionError
        );
      });
    });

    describe('internal domain blocking', () => {
      it('should block internal domains', async () => {
        await expect(protection.validateUrl('https://internal')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://server.internal')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://app.corp')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(protection.validateUrl('https://server.local')).rejects.toThrow(
          SSRFProtectionError
        );
      });
    });

    describe('whitelist', () => {
      it('should allow whitelisted domains', async () => {
        const whitelistProtection = new SSRFProtection({
          enabled: true,
          allowedDomains: ['trusted.com', 'api.trusted.com'],
        });

        await expect(whitelistProtection.validateUrl('https://trusted.com')).resolves.not.toThrow();

        await expect(
          whitelistProtection.validateUrl('https://api.trusted.com')
        ).resolves.not.toThrow();

        await expect(
          whitelistProtection.validateUrl('https://sub.trusted.com')
        ).resolves.not.toThrow();
      });

      it('should block non-whitelisted domains', async () => {
        const whitelistProtection = new SSRFProtection({
          enabled: true,
          allowedDomains: ['trusted.com'],
        });

        await expect(whitelistProtection.validateUrl('https://untrusted.com')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should skip other checks for whitelisted domains', async () => {
        const whitelistProtection = new SSRFProtection({
          enabled: true,
          blockPrivateIPs: true,
          allowedDomains: ['192.168.1.1'],
        });

        // Should allow even though it's a private IP
        await expect(whitelistProtection.validateUrl('https://192.168.1.1')).resolves.not.toThrow();
      });
    });

    describe('blacklist', () => {
      it('should block blacklisted domains', async () => {
        const blacklistProtection = new SSRFProtection({
          enabled: true,
          blockedDomains: ['blocked.com', 'evil.com'],
        });

        await expect(blacklistProtection.validateUrl('https://blocked.com')).rejects.toThrow(
          SSRFProtectionError
        );

        await expect(blacklistProtection.validateUrl('https://sub.blocked.com')).rejects.toThrow(
          SSRFProtectionError
        );
      });

      it('should allow non-blacklisted domains', async () => {
        const blacklistProtection = new SSRFProtection({
          enabled: true,
          blockedDomains: ['blocked.com'],
        });

        await expect(blacklistProtection.validateUrl('https://allowed.com')).resolves.not.toThrow();
      });
    });

    describe('disabled protection', () => {
      it('should allow all URLs when disabled', async () => {
        const disabledProtection = new SSRFProtection({
          enabled: false,
        });

        await expect(disabledProtection.validateUrl('http://localhost')).resolves.not.toThrow();

        await expect(disabledProtection.validateUrl('https://192.168.1.1')).resolves.not.toThrow();
      });
    });

    describe('invalid URLs', () => {
      it('should reject invalid URLs', async () => {
        await expect(protection.validateUrl('not-a-url')).rejects.toThrow(SSRFProtectionError);

        await expect(protection.validateUrl('')).rejects.toThrow(SSRFProtectionError);
      });
    });
  });

  describe('getConfig', () => {
    it('should return configuration', () => {
      const config = protection.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.blockPrivateIPs).toBe(true);
      expect(config.blockLocalhost).toBe(true);
      expect(config.blockLinkLocal).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return enabled status', () => {
      expect(protection.isEnabled()).toBe(true);

      const disabled = new SSRFProtection({ enabled: false });
      expect(disabled.isEnabled()).toBe(false);
    });
  });
});
