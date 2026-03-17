/**
 * Tests for ResponseValidator (RFC 7483 validation)
 */

import {
  ResponseValidator,
  ResponseValidationError,
} from '../../src/infrastructure/validation/ResponseValidator';
import type { ValidationResult } from '../../src/infrastructure/validation/ResponseValidator';
import type { DomainResponse, IPResponse, ASNResponse } from '../../src/shared/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function validDomain(overrides: Partial<DomainResponse> = {}): DomainResponse {
  return {
    objectClass: 'domain',
    query: 'example.com',
    ldhName: 'example.com',
    status: ['active'],
    events: [{ type: 'registration', date: '2000-01-01T00:00:00Z' }],
    nameservers: ['ns1.example.com', 'ns2.example.com'],
    entities: [{ roles: ['registrar'] }],
    metadata: { source: 'rdap.verisign.com', timestamp: '2026-03-17T00:00:00Z', cached: false },
    ...overrides,
  };
}

function validIP(overrides: Partial<IPResponse> = {}): IPResponse {
  return {
    objectClass: 'ip network',
    query: '1.2.3.0/24',
    startAddress: '1.2.3.0',
    endAddress: '1.2.3.255',
    ipVersion: 'v4',
    metadata: { source: 'rdap.arin.net', timestamp: '2026-03-17T00:00:00Z', cached: false },
    ...overrides,
  };
}

function validASN(overrides: Partial<ASNResponse> = {}): ASNResponse {
  return {
    objectClass: 'autnum',
    query: 'AS15169',
    startAutnum: 15169,
    endAutnum: 15169,
    metadata: { source: 'rdap.arin.net', timestamp: '2026-03-17T00:00:00Z', cached: false },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ResponseValidator — domain
// ---------------------------------------------------------------------------

describe('ResponseValidator - domain', () => {
  it('valid domain response passes validation', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validateDomain(validDomain());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('missing objectClass value produces an error', () => {
    const validator = new ResponseValidator({ mode: 'strict', onViolation: 'ignore' });
    // Force wrong objectClass via cast to test the check
    const response = validDomain({ objectClass: 'ip network' as 'domain' });
    const result = validator.validateDomain(response);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'objectClass')).toBe(true);
  });

  it('missing ldhName produces a warning in lenient mode', () => {
    const validator = new ResponseValidator({ mode: 'lenient', onViolation: 'ignore' });
    const response = validDomain({ ldhName: undefined });
    const result = validator.validateDomain(response);
    expect(result.valid).toBe(true); // warnings don't make it invalid
    expect(result.warnings.some((w) => w.field === 'ldhName')).toBe(true);
  });

  it('invalid events structure (no date) produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validDomain({
      events: [{ type: 'registration', date: '' }],
    });
    // empty string is falsy
    const result = validator.validateDomain(response);
    expect(result.errors.some((e) => e.field.startsWith('events[0].date'))).toBe(true);
  });

  it('invalid events structure (no type) produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validDomain({
      events: [{ type: '' as 'registration', date: '2000-01-01T00:00:00Z' }],
    });
    const result = validator.validateDomain(response);
    expect(result.errors.some((e) => e.field.startsWith('events[0].type'))).toBe(true);
  });

  it('entity without roles array produces a warning', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validDomain({ entities: [{ handle: 'ent1' }] });
    const result = validator.validateDomain(response);
    expect(result.warnings.some((w) => w.field.startsWith('entities[0].roles'))).toBe(true);
  });

  it('nameserver with empty string produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validDomain({ nameservers: [''] });
    const result = validator.validateDomain(response);
    expect(result.errors.some((e) => e.field.startsWith('nameservers[0]'))).toBe(true);
  });

  it('non-array status produces a warning', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validDomain({ status: 'active' as unknown as ['active'] });
    const result = validator.validateDomain(response);
    expect(result.warnings.some((w) => w.field === 'status')).toBe(true);
  });

  it('missing query field produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validDomain({ query: '' });
    const result = validator.validateDomain(response);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'query')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ResponseValidator — IP
// ---------------------------------------------------------------------------

describe('ResponseValidator - IP', () => {
  it('valid IP response passes validation', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validateIP(validIP());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('wrong objectClass produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validIP({ objectClass: 'domain' as 'ip network' });
    const result = validator.validateIP(response);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'objectClass')).toBe(true);
  });

  it('missing startAddress produces a warning', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validIP({ startAddress: undefined });
    const result = validator.validateIP(response);
    expect(result.warnings.some((w) => w.field === 'startAddress')).toBe(true);
  });

  it('missing endAddress produces a warning', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validIP({ endAddress: undefined });
    const result = validator.validateIP(response);
    expect(result.warnings.some((w) => w.field === 'endAddress')).toBe(true);
  });

  it('invalid ipVersion produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validIP({ ipVersion: 'v3' as 'v4' });
    const result = validator.validateIP(response);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'ipVersion')).toBe(true);
  });

  it('ipVersion v4 is accepted', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validateIP(validIP({ ipVersion: 'v4' }));
    expect(result.errors.some((e) => e.field === 'ipVersion')).toBe(false);
  });

  it('ipVersion v6 is accepted', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validateIP(validIP({ ipVersion: 'v6' }));
    expect(result.errors.some((e) => e.field === 'ipVersion')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ResponseValidator — ASN
// ---------------------------------------------------------------------------

describe('ResponseValidator - ASN', () => {
  it('valid ASN response passes validation', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validateASN(validASN());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('wrong objectClass produces an error', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validASN({ objectClass: 'domain' as 'autnum' });
    const result = validator.validateASN(response);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'objectClass')).toBe(true);
  });

  it('missing startAutnum produces a warning', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const response = validASN({ startAutnum: undefined });
    const result = validator.validateASN(response);
    expect(result.warnings.some((w) => w.field === 'startAutnum')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// onViolation behavior
// ---------------------------------------------------------------------------

describe('ResponseValidator - onViolation', () => {
  it('onViolation:throw throws ResponseValidationError on errors', () => {
    const validator = new ResponseValidator({ onViolation: 'throw' });
    expect(() => {
      validator.validateDomain(validDomain({ objectClass: 'ip network' as 'domain' }));
    }).toThrow(ResponseValidationError);
  });

  it('onViolation:throw error contains validation result', () => {
    const validator = new ResponseValidator({ onViolation: 'throw' });
    try {
      validator.validateDomain(validDomain({ objectClass: 'ip network' as 'domain' }));
      fail('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ResponseValidationError);
      const validationErr = err as ResponseValidationError;
      expect(validationErr.validationResult.errors.length).toBeGreaterThan(0);
    }
  });

  it('onViolation:warn does not throw on errors', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const validator = new ResponseValidator({ onViolation: 'warn' });
    expect(() => {
      validator.validateDomain(validDomain({ objectClass: 'ip network' as 'domain' }));
    }).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('onViolation:warn calls console.warn for each error', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const validator = new ResponseValidator({ onViolation: 'warn' });
    validator.validateDomain(validDomain({ objectClass: 'ip network' as 'domain' }));
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('onViolation:ignore does not throw and does not warn', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    expect(() => {
      validator.validateDomain(validDomain({ objectClass: 'ip network' as 'domain' }));
    }).not.toThrow();
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// mode: 'off'
// ---------------------------------------------------------------------------

describe('ResponseValidator - mode:off', () => {
  it('returns valid:true always for domain', () => {
    const validator = new ResponseValidator({ mode: 'off', onViolation: 'throw' });
    const response = validDomain({ objectClass: 'ip network' as 'domain', query: '' });
    const result = validator.validateDomain(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid:true always for IP', () => {
    const validator = new ResponseValidator({ mode: 'off', onViolation: 'throw' });
    const response = validIP({ objectClass: 'domain' as 'ip network' });
    const result = validator.validateIP(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid:true always for ASN', () => {
    const validator = new ResponseValidator({ mode: 'off', onViolation: 'throw' });
    const response = validASN({ objectClass: 'domain' as 'autnum' });
    const result = validator.validateASN(response);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid:true from validate() dispatch', () => {
    const validator = new ResponseValidator({ mode: 'off', onViolation: 'throw' });
    const result = validator.validate(validDomain({ objectClass: 'ip network' as 'domain' }));
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validate() dispatch
// ---------------------------------------------------------------------------

describe('ResponseValidator - validate() dispatch', () => {
  it('dispatches domain objectClass to validateDomain', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const spy = jest.spyOn(validator, 'validateDomain');
    const response = validDomain();
    validator.validate(response);
    expect(spy).toHaveBeenCalledWith(response);
  });

  it('dispatches ip network objectClass to validateIP', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const spy = jest.spyOn(validator, 'validateIP');
    const response = validIP();
    validator.validate(response);
    expect(spy).toHaveBeenCalledWith(response);
  });

  it('dispatches autnum objectClass to validateASN', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const spy = jest.spyOn(validator, 'validateASN');
    const response = validASN();
    validator.validate(response);
    expect(spy).toHaveBeenCalledWith(response);
  });

  it('returns valid result for valid domain via validate()', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validate(validDomain());
    expect(result.valid).toBe(true);
  });

  it('returns valid result for valid IP via validate()', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validate(validIP());
    expect(result.valid).toBe(true);
  });

  it('returns valid result for valid ASN via validate()', () => {
    const validator = new ResponseValidator({ onViolation: 'ignore' });
    const result = validator.validate(validASN());
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getMode()
// ---------------------------------------------------------------------------

describe('ResponseValidator - getMode()', () => {
  it('returns lenient by default', () => {
    const validator = new ResponseValidator();
    expect(validator.getMode()).toBe('lenient');
  });

  it('returns strict when configured', () => {
    const validator = new ResponseValidator({ mode: 'strict' });
    expect(validator.getMode()).toBe('strict');
  });

  it('returns off when configured', () => {
    const validator = new ResponseValidator({ mode: 'off' });
    expect(validator.getMode()).toBe('off');
  });
});
