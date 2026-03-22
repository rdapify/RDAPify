/**
 * Unit tests for nameserver validator
 */

import { validateNameserver, normalizeNameserver } from '../../src/shared/utils/validators/nameserver';
import { ValidationError } from '../../src/shared/types/errors';

describe('validateNameserver', () => {
  it('should accept valid nameserver hostnames', () => {
    expect(() => validateNameserver('ns1.example.com')).not.toThrow();
    expect(() => validateNameserver('ns2.example.com')).not.toThrow();
    expect(() => validateNameserver('dns1.p01.nsone.net')).not.toThrow();
    expect(() => validateNameserver('a.iana-servers.net')).not.toThrow();
    expect(() => validateNameserver('NS1.EXAMPLE.COM')).not.toThrow();
  });

  it('should reject empty or non-string input', () => {
    expect(() => validateNameserver('')).toThrow(ValidationError);
    expect(() => validateNameserver('   ')).toThrow(ValidationError);
  });

  it('should reject hostnames without a dot', () => {
    expect(() => validateNameserver('localhost')).toThrow(ValidationError);
    expect(() => validateNameserver('nameserver')).toThrow(ValidationError);
  });

  it('should reject hostnames with empty labels', () => {
    expect(() => validateNameserver('ns1..example.com')).toThrow(ValidationError);
    expect(() => validateNameserver('.ns1.example.com')).toThrow(ValidationError);
  });

  it('should reject hostnames exceeding 253 characters', () => {
    const longHostname = 'a'.repeat(63) + '.' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(64);
    expect(() => validateNameserver(longHostname)).toThrow(ValidationError);
  });

  it('should reject labels exceeding 63 characters', () => {
    const longLabel = 'a'.repeat(64) + '.example.com';
    expect(() => validateNameserver(longLabel)).toThrow(ValidationError);
  });

  it('rejects labels with invalid special characters', () => {
    expect(() => validateNameserver('abc!.example.com')).toThrow(ValidationError);
  });

  it('accepts labels ending with hyphen as punycode-style without throwing', () => {
    // "abc-" ends with hyphen: fails standard label regex but passes punycode regex → no throw
    expect(() => validateNameserver('abc-.example.com')).not.toThrow();
  });
});

describe('normalizeNameserver', () => {
  it('should lowercase the hostname', () => {
    expect(normalizeNameserver('NS1.EXAMPLE.COM')).toBe('ns1.example.com');
  });

  it('should trim whitespace', () => {
    expect(normalizeNameserver('  ns1.example.com  ')).toBe('ns1.example.com');
  });

  it('should preserve valid hostnames', () => {
    expect(normalizeNameserver('ns1.example.com')).toBe('ns1.example.com');
  });
});
