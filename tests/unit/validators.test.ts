/**
 * Unit tests for validators
 */

import {
  validateDomain,
  validateIPv4,
  validateIPv6,
  validateIP,
  validateASN,
  isPrivateIP,
  isLocalhost,
  isLinkLocal,
  normalizeDomain,
  normalizeIP,
  normalizeASN,
} from '../../src/shared/utils/validators';
import { ValidationError } from '../../src/shared/types/errors';

describe('validateDomain', () => {
  it('should accept valid domains', () => {
    expect(() => validateDomain('example.com')).not.toThrow();
    expect(() => validateDomain('sub.example.com')).not.toThrow();
    expect(() => validateDomain('test-domain.co.uk')).not.toThrow();
    expect(() => validateDomain('a.b.c.d.example.com')).not.toThrow();
  });

  it('should reject empty domain', () => {
    expect(() => validateDomain('')).toThrow(ValidationError);
    expect(() => validateDomain('   ')).toThrow(ValidationError);
  });

  it('should reject invalid characters', () => {
    expect(() => validateDomain('exam ple.com')).toThrow(ValidationError);
    expect(() => validateDomain('example!.com')).toThrow(ValidationError);
    expect(() => validateDomain('example@.com')).toThrow(ValidationError);
  });

  it('should reject consecutive dots', () => {
    expect(() => validateDomain('example..com')).toThrow(ValidationError);
  });

  it('should reject leading/trailing dots or hyphens', () => {
    expect(() => validateDomain('.example.com')).toThrow(ValidationError);
    expect(() => validateDomain('example.com.')).toThrow(ValidationError);
    expect(() => validateDomain('-example.com')).toThrow(ValidationError);
  });

  it('should reject too long domains', () => {
    const longDomain = 'a'.repeat(254) + '.com';
    expect(() => validateDomain(longDomain)).toThrow(ValidationError);
  });

  it('should reject non-string input', () => {
    expect(() => validateDomain(null as any)).toThrow(ValidationError);
    expect(() => validateDomain(undefined as any)).toThrow(ValidationError);
    expect(() => validateDomain(123 as any)).toThrow(ValidationError);
  });
});

describe('validateIPv4', () => {
  it('should accept valid IPv4 addresses', () => {
    expect(() => validateIPv4('192.168.1.1')).not.toThrow();
    expect(() => validateIPv4('8.8.8.8')).not.toThrow();
    expect(() => validateIPv4('255.255.255.255')).not.toThrow();
    expect(() => validateIPv4('0.0.0.0')).not.toThrow();
  });

  it('should reject invalid IPv4 addresses', () => {
    expect(() => validateIPv4('256.1.1.1')).toThrow(ValidationError);
    expect(() => validateIPv4('1.1.1')).toThrow(ValidationError);
    expect(() => validateIPv4('1.1.1.1.1')).toThrow(ValidationError);
    expect(() => validateIPv4('abc.def.ghi.jkl')).toThrow(ValidationError);
  });

  it('should reject leading zeros', () => {
    expect(() => validateIPv4('192.168.001.1')).toThrow(ValidationError);
    expect(() => validateIPv4('01.1.1.1')).toThrow(ValidationError);
  });

  it('should accept single zero', () => {
    expect(() => validateIPv4('192.168.0.1')).not.toThrow();
  });
});

describe('validateIPv6', () => {
  it('should accept valid IPv6 addresses', () => {
    expect(() => validateIPv6('2001:db8::1')).not.toThrow();
    expect(() => validateIPv6('::1')).not.toThrow();
    expect(() => validateIPv6('fe80::1')).not.toThrow();
    expect(() => validateIPv6('2001:0db8:0000:0000:0000:0000:0000:0001')).not.toThrow();
  });

  it('should reject invalid IPv6 addresses', () => {
    expect(() => validateIPv6('gggg::1')).toThrow(ValidationError);
    expect(() => validateIPv6('192.168.1.1')).toThrow(ValidationError);
    expect(() => validateIPv6('not-an-ip')).toThrow(ValidationError);
  });
});

describe('validateIP', () => {
  it('should detect IPv4 and return v4', () => {
    expect(validateIP('192.168.1.1')).toBe('v4');
    expect(validateIP('8.8.8.8')).toBe('v4');
  });

  it('should detect IPv6 and return v6', () => {
    expect(validateIP('2001:db8::1')).toBe('v6');
    expect(validateIP('::1')).toBe('v6');
  });

  it('should reject invalid IPs', () => {
    expect(() => validateIP('not-an-ip')).toThrow(ValidationError);
    expect(() => validateIP('256.1.1.1')).toThrow(ValidationError);
  });
});

describe('validateASN', () => {
  it('should accept valid ASN numbers', () => {
    expect(validateASN(15169)).toBe(15169);
    expect(validateASN(0)).toBe(0);
    expect(validateASN(4294967295)).toBe(4294967295);
  });

  it('should accept ASN strings with AS prefix', () => {
    expect(validateASN('AS15169')).toBe(15169);
    expect(validateASN('as15169')).toBe(15169);
  });

  it('should accept ASN strings without AS prefix', () => {
    expect(validateASN('15169')).toBe(15169);
  });

  it('should reject invalid ASN', () => {
    expect(() => validateASN(-1)).toThrow(ValidationError);
    expect(() => validateASN(4294967296)).toThrow(ValidationError);
    expect(() => validateASN('invalid')).toThrow(ValidationError);
  });

  it('should reject non-string/non-number input', () => {
    expect(() => validateASN(null as any)).toThrow(ValidationError);
    expect(() => validateASN(undefined as any)).toThrow(ValidationError);
  });
});

describe('isPrivateIP', () => {
  it('should detect private IPv4 addresses', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
  });

  it('should detect public IPv4 addresses', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('1.1.1.1')).toBe(false);
  });

  it('should detect private IPv6 addresses', () => {
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fd00::1')).toBe(true);
    expect(isPrivateIP('fe80::1')).toBe(true);
  });

  it('should detect public IPv6 addresses', () => {
    expect(isPrivateIP('2001:db8::1')).toBe(false);
  });
});

describe('isLocalhost', () => {
  it('should detect IPv4 localhost', () => {
    expect(isLocalhost('127.0.0.1')).toBe(true);
    expect(isLocalhost('127.0.0.2')).toBe(true);
  });

  it('should detect IPv6 localhost', () => {
    expect(isLocalhost('::1')).toBe(true);
  });

  it('should reject non-localhost', () => {
    expect(isLocalhost('8.8.8.8')).toBe(false);
    expect(isLocalhost('192.168.1.1')).toBe(false);
  });
});

describe('isLinkLocal', () => {
  it('should detect IPv4 link-local', () => {
    expect(isLinkLocal('169.254.0.1')).toBe(true);
    expect(isLinkLocal('169.254.255.255')).toBe(true);
  });

  it('should detect IPv6 link-local', () => {
    expect(isLinkLocal('fe80::1')).toBe(true);
  });

  it('should reject non-link-local', () => {
    expect(isLinkLocal('192.168.1.1')).toBe(false);
    expect(isLinkLocal('8.8.8.8')).toBe(false);
  });
});

describe('normalizeDomain', () => {
  it('should lowercase domain', () => {
    expect(normalizeDomain('EXAMPLE.COM')).toBe('example.com');
  });

  it('should trim whitespace', () => {
    expect(normalizeDomain('  example.com  ')).toBe('example.com');
  });

  it('should remove trailing dot', () => {
    expect(normalizeDomain('example.com.')).toBe('example.com');
  });

  it('should handle all transformations', () => {
    expect(normalizeDomain('  EXAMPLE.COM.  ')).toBe('example.com');
  });
});

describe('normalizeIP', () => {
  it('should lowercase IP', () => {
    expect(normalizeIP('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('should trim whitespace', () => {
    expect(normalizeIP('  8.8.8.8  ')).toBe('8.8.8.8');
  });
});

describe('normalizeASN', () => {
  it('should format ASN with AS prefix', () => {
    expect(normalizeASN(15169)).toBe('AS15169');
    expect(normalizeASN('15169')).toBe('AS15169');
    expect(normalizeASN('AS15169')).toBe('AS15169');
  });
});
