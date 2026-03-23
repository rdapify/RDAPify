/**
 * Unit tests for DNS rebinding protection (Feature 1)
 */

import * as dns from 'dns';
import { SSRFProtection } from '../../../src/infrastructure/security/SSRFProtection';
import { SSRFProtectionError } from '../../../src/shared/types/errors';

jest.mock('dns', () => ({
  promises: {
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  },
}));

const mockResolve4 = dns.promises.resolve4 as jest.Mock;
const mockResolve6 = dns.promises.resolve6 as jest.Mock;

describe('DNS Rebinding Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: resolve6 always fails (no AAAA records)
    mockResolve6.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
  });

  it('blocks private IP resolved via DNS (192.168.x.x)', async () => {
    mockResolve4.mockResolvedValue(['192.168.1.1']);
    const protection = new SSRFProtection({ dnsRebinding: true });
    await expect(protection.validateUrl('https://evil-rebind.example.com')).rejects.toThrow(
      SSRFProtectionError
    );
  });

  it('allows public IP resolved via DNS (1.1.1.1)', async () => {
    mockResolve4.mockResolvedValue(['1.1.1.1']);
    const protection = new SSRFProtection({ dnsRebinding: true });
    await expect(protection.validateUrl('https://public.example.com')).resolves.not.toThrow();
  });

  it('passes when DNS resolution fails with ENOTFOUND', async () => {
    mockResolve4.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    const protection = new SSRFProtection({ dnsRebinding: true });
    await expect(protection.validateUrl('https://nonexistent.example.com')).resolves.not.toThrow();
  });

  it('does not perform DNS resolution when dnsRebinding is false', async () => {
    const protection = new SSRFProtection({ dnsRebinding: false });
    await protection.validateUrl('https://example.com');
    expect(mockResolve4).not.toHaveBeenCalled();
  });

  it('blocks localhost IP (127.0.0.1) resolved via DNS', async () => {
    mockResolve4.mockResolvedValue(['127.0.0.1']);
    const protection = new SSRFProtection({ dnsRebinding: true });
    await expect(protection.validateUrl('https://looks-public.example.com')).rejects.toThrow(
      SSRFProtectionError
    );
  });
});
