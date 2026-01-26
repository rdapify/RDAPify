/**
 * Tests for Enhanced Validators
 */

import {
  validateIdnDomain,
  validateIpv6WithZone,
  validateAsnRange,
  isIdnDomain,
  isPunycodeDomain,
  validateEmail,
  validatePhone,
  validateUrl,
} from '../../src/shared/utils/enhanced-validators';

describe('Enhanced Validators', () => {
  describe('validateIdnDomain', () => {
    it('should validate regular domains', () => {
      expect(validateIdnDomain('example.com')).toBe('example.com');
      expect(validateIdnDomain('sub.example.com')).toBe('sub.example.com');
    });

    it('should convert IDN to punycode', () => {
      const result = validateIdnDomain('مثال.السعودية');
      expect(result).toContain('xn--');
    });

    it('should throw on invalid domains', () => {
      expect(() => validateIdnDomain('')).toThrow();
      expect(() => validateIdnDomain('invalid domain')).toThrow();
      expect(() => validateIdnDomain('domain<script>')).toThrow();
    });

    it('should normalize domain case', () => {
      expect(validateIdnDomain('EXAMPLE.COM')).toBe('example.com');
    });
  });

  describe('validateIpv6WithZone', () => {
    it('should validate IPv6 without zone', () => {
      const result = validateIpv6WithZone('2001:db8::1');
      expect(result.ip).toBe('2001:db8::1');
      expect(result.zone).toBeUndefined();
    });

    it('should validate IPv6 with zone ID', () => {
      const result = validateIpv6WithZone('fe80::1%eth0');
      expect(result.ip).toBe('fe80::1');
      expect(result.zone).toBe('eth0');
    });

    it('should validate compressed IPv6', () => {
      const result = validateIpv6WithZone('::1');
      expect(result.ip).toBe('::1');
    });

    it('should throw on invalid IPv6', () => {
      expect(() => validateIpv6WithZone('invalid')).toThrow();
      expect(() => validateIpv6WithZone('192.168.1.1')).toThrow();
    });
  });

  describe('validateAsnRange', () => {
    it('should validate single ASN', () => {
      const result = validateAsnRange(15169);
      expect(result.start).toBe(15169);
      expect(result.end).toBeUndefined();
    });

    it('should validate ASN with AS prefix', () => {
      const result = validateAsnRange('AS15169');
      expect(result.start).toBe(15169);
    });

    it('should validate ASN range', () => {
      const result = validateAsnRange('15169-15200');
      expect(result.start).toBe(15169);
      expect(result.end).toBe(15200);
    });

    it('should validate ASN range with AS prefix', () => {
      const result = validateAsnRange('AS15169-AS15200');
      expect(result.start).toBe(15169);
      expect(result.end).toBe(15200);
    });

    it('should throw on invalid ASN', () => {
      expect(() => validateAsnRange('invalid')).toThrow();
      expect(() => validateAsnRange(-1)).toThrow();
      expect(() => validateAsnRange(4294967296)).toThrow();
    });

    it('should throw on invalid range', () => {
      expect(() => validateAsnRange('15200-15169')).toThrow();
    });
  });

  describe('isIdnDomain', () => {
    it('should detect IDN domains', () => {
      expect(isIdnDomain('مثال.السعودية')).toBe(true);
      expect(isIdnDomain('例え.jp')).toBe(true);
      expect(isIdnDomain('example.com')).toBe(false);
    });
  });

  describe('isPunycodeDomain', () => {
    it('should detect punycode domains', () => {
      expect(isPunycodeDomain('xn--mgbh0fb.xn--mgberp4a5d4ar')).toBe(true);
      expect(isPunycodeDomain('example.com')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('user.name@example.co.uk')).toBe(true);
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate phone numbers', () => {
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('123-456-7890')).toBe(true);
      expect(validatePhone('(123) 456-7890')).toBe(true);
      expect(validatePhone('123')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://example.com/path')).toBe(true);
      expect(validateUrl('invalid')).toBe(false);
    });
  });
});
