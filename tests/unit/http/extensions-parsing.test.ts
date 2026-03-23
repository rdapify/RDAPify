/**
 * Unit tests for RDAP extensions parsing (Feature 4)
 */

import { Normalizer } from '../../../src/infrastructure/http/Normalizer';

describe('RDAP Extensions Parsing', () => {
  let normalizer: Normalizer;

  beforeEach(() => {
    normalizer = new Normalizer();
  });

  it('extracts non-standard extension fields from domain response', () => {
    const raw = {
      objectClassName: 'domain',
      handle: 'TEST-123',
      ldhName: 'example.com',
      'rdap-x-provider': 'verisign',
      'custom-field': { nested: true },
    };

    const result = normalizer.normalize(raw, 'example.com', 'https://rdap.test', false);
    expect(result.extensions).toEqual({
      'rdap-x-provider': 'verisign',
      'custom-field': { nested: true },
    });
  });

  it('returns undefined extensions when no extension fields present', () => {
    const raw = {
      objectClassName: 'domain',
      handle: 'TEST-123',
      ldhName: 'example.com',
      status: ['active'],
    };

    const result = normalizer.normalize(raw, 'example.com', 'https://rdap.test', false);
    expect(result.extensions).toBeUndefined();
  });

  it('extracts extensions from IP response', () => {
    const raw = {
      objectClassName: 'ip network',
      handle: 'NET-1',
      startAddress: '1.0.0.0',
      endAddress: '1.255.255.255',
      'arin-originas0-originautnums': [15169],
    };

    const result = normalizer.normalize(raw, '1.1.1.1', 'https://rdap.arin.net', false);
    expect(result.extensions).toEqual({ 'arin-originas0-originautnums': [15169] });
  });

  it('does not include standard RFC 7483 fields in extensions', () => {
    const raw = {
      objectClassName: 'domain',
      handle: 'TEST',
      ldhName: 'example.com',
      status: ['active'],
      entities: [],
      events: [],
      links: [],
      remarks: [],
    };

    const result = normalizer.normalize(raw, 'example.com', 'https://rdap.test', false);
    expect(result.extensions).toBeUndefined();
  });
});
