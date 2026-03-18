/**
 * Unit tests for Normalizer — nameserver and entity object classes
 */

import { Normalizer } from '../../src/infrastructure/http/Normalizer';
import { ParseError } from '../../src/shared/errors';

describe('Normalizer — nameserver', () => {
  let normalizer: Normalizer;

  beforeEach(() => {
    normalizer = new Normalizer();
  });

  it('should normalize a nameserver response', () => {
    const raw = {
      objectClassName: 'nameserver',
      handle: 'XXXX',
      ldhName: 'ns1.example.com',
      status: ['active'],
      ipAddresses: {
        v4: ['192.0.2.1'],
        v6: ['2001:db8::1'],
      },
    };

    const result = normalizer.normalize(raw, 'ns1.example.com', 'https://rdap.example.com', false, false);

    expect(result.objectClass).toBe('nameserver');
    expect(result.query).toBe('ns1.example.com');
    if (result.objectClass === 'nameserver') {
      expect(result.ldhName).toBe('ns1.example.com');
      expect(result.handle).toBe('XXXX');
      expect(result.status).toEqual(['active']);
      expect(result.ipAddresses?.v4).toEqual(['192.0.2.1']);
      expect(result.ipAddresses?.v6).toEqual(['2001:db8::1']);
    }
    expect(result.metadata.source).toBe('https://rdap.example.com');
    expect(result.metadata.cached).toBe(false);
  });

  it('should normalize a nameserver without IP addresses', () => {
    const raw = {
      objectClassName: 'nameserver',
      ldhName: 'ns1.example.com',
    };

    const result = normalizer.normalize(raw, 'ns1.example.com', 'https://rdap.example.com', false, false);

    expect(result.objectClass).toBe('nameserver');
    if (result.objectClass === 'nameserver') {
      expect(result.ipAddresses).toBeUndefined();
    }
  });

  it('should include raw when includeRaw is true', () => {
    const raw = {
      objectClassName: 'nameserver',
      ldhName: 'ns1.example.com',
    };

    const result = normalizer.normalize(raw, 'ns1.example.com', 'https://rdap.example.com', false, true);

    expect((result as any).raw).toBeDefined();
  });
});

describe('Normalizer — entity', () => {
  let normalizer: Normalizer;

  beforeEach(() => {
    normalizer = new Normalizer();
  });

  it('should normalize an entity response', () => {
    const raw = {
      objectClassName: 'entity',
      handle: 'ARIN-HN-1',
      roles: ['registrant'],
      status: ['validated'],
      vcardArray: [
        'vcard',
        [
          ['version', {}, 'text', '4.0'],
          ['fn', {}, 'text', 'Example Organization'],
        ],
      ],
    };

    const result = normalizer.normalize(raw, 'ARIN-HN-1', 'https://rdap.arin.net/registry', false, false);

    expect(result.objectClass).toBe('entity');
    expect(result.query).toBe('ARIN-HN-1');
    if (result.objectClass === 'entity') {
      expect(result.handle).toBe('ARIN-HN-1');
      expect(result.roles).toEqual(['registrant']);
      expect(result.status).toEqual(['validated']);
      expect(result.vcardArray).toBeDefined();
    }
  });

  it('should normalize an entity with minimal fields', () => {
    const raw = {
      objectClassName: 'entity',
      handle: 'VRSN-96',
    };

    const result = normalizer.normalize(raw, 'VRSN-96', 'https://rdap.verisign.com/com/v1', false, false);

    expect(result.objectClass).toBe('entity');
    if (result.objectClass === 'entity') {
      expect(result.handle).toBe('VRSN-96');
      expect(result.roles).toEqual([]);
      expect(result.status).toEqual([]);
    }
  });
});

describe('Normalizer — unsupported object class', () => {
  let normalizer: Normalizer;

  beforeEach(() => {
    normalizer = new Normalizer();
  });

  it('should throw ParseError for unknown object class', () => {
    const raw = {
      objectClassName: 'unknown-type',
    };

    expect(() =>
      normalizer.normalize(raw, 'query', 'https://rdap.example.com', false, false)
    ).toThrow(ParseError);
  });
});
