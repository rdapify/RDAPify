/**
 * Tests for SSRFProtection IPv6 handling
 */

import { SSRFProtection } from '../../src/infrastructure/security/SSRFProtection';

describe('SSRFProtection', () => {
  describe('IPv6 handling', () => {
    let protection: SSRFProtection;

    beforeEach(() => {
      protection = new SSRFProtection({
        enabled: true,
        blockLocalhost: true,
        blockPrivateIPs: true,
        blockLinkLocal: true,
      });
    });

    it('should block localhost IPv6', async () => {
      await expect(protection.validateUrl('https://[::1]/')).rejects.toThrow('Localhost');
    });

    it('should block private IPv6 (ULA)', async () => {
      await expect(protection.validateUrl('https://[fc00::1]/')).rejects.toThrow('Private');
    });

    it('should block link-local IPv6', async () => {
      // fe80::1 is link-local which is also considered private
      await expect(protection.validateUrl('https://[fe80::1]/')).rejects.toThrow('Private');
    });

    it('should allow public IPv6', async () => {
      // This should not throw since it's a public IP
      await expect(protection.validateUrl('https://[2001:db8::1]/')).resolves.toBeUndefined();
    });

    it('should handle IPv6 with brackets normally', async () => {
      await expect(protection.validateUrl('https://[2001:db8::1]/')).resolves.toBeUndefined();
    });
  });
});
