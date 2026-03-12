/**
 * Tests for Normalizer edge cases
 */

import { Normalizer } from '../../src/infrastructure/http/Normalizer';

describe('Normalizer', () => {
  let normalizer: Normalizer;

  beforeEach(() => {
    normalizer = new Normalizer();
  });

  describe('extractNameservers edge cases', () => {
    it('should handle null nameservers', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        nameservers: null,
      };
      const result = (normalizer as any).extractNameservers(raw);
      expect(result).toEqual([]);
    });

    it('should handle undefined nameservers', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
      };
      const result = (normalizer as any).extractNameservers(raw);
      expect(result).toEqual([]);
    });

    it('should handle empty nameservers array', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        nameservers: [],
      };
      const result = (normalizer as any).extractNameservers(raw);
      expect(result).toEqual([]);
    });

    it('should handle nameservers with invalid entries', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        nameservers: [null, undefined, {}, { ldhName: 'ns1.example.com' }, 'invalid'],
      };
      const result = (normalizer as any).extractNameservers(raw);
      expect(result).toEqual(['ns1.example.com']);
    });

    it('should handle nameservers with empty strings', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        nameservers: [
          { ldhName: 'ns1.example.com' },
          { ldhName: '' },
          { unicodeName: 'ns2.example.com' },
        ],
      };
      const result = (normalizer as any).extractNameservers(raw);
      expect(result).toEqual(['ns1.example.com', 'ns2.example.com']);
    });
  });

  describe('extractRegistrar edge cases', () => {
    it('should handle null entities', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        entities: null,
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toBeUndefined();
    });

    it('should handle undefined entities', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toBeUndefined();
    });

    it('should handle empty entities array', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        entities: [],
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toBeUndefined();
    });

    it('should handle registrar without vcardArray', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        entities: [
          {
            handle: 'reg1',
            roles: ['registrar'],
          },
        ],
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toEqual({ handle: 'reg1', name: undefined, url: undefined });
    });

    it('should handle vcardArray with insufficient length', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        entities: [
          {
            handle: 'reg1',
            roles: ['registrar'],
            vcardArray: [['version', 'fields']], // Only 2 elements, missing actual fields
          },
        ],
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toEqual({ handle: 'reg1', name: undefined, url: undefined });
    });

    it('should handle fnField with insufficient length', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        entities: [
          {
            handle: 'reg1',
            roles: ['registrar'],
            vcardArray: [
              'version',
              [
                ['fn', {}, 'text'], // Only 3 elements, missing value at index 3
              ],
            ],
          },
        ],
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toEqual({ handle: 'reg1', name: undefined, url: undefined });
    });

    it('should extract registrar with valid vCard', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        entities: [
          {
            handle: 'reg1',
            roles: ['registrar'],
            vcardArray: [
              'version',
              [
                ['fn', {}, 'text', 'Example Registrar'],
                ['email', {}, 'text', 'contact@example.com'],
              ],
            ],
            links: [{ rel: 'self', href: 'https://example.com/registrar' }],
          },
        ],
      };
      const result = (normalizer as any).extractRegistrar(raw);
      expect(result).toEqual({
        handle: 'reg1',
        name: 'Example Registrar',
        url: 'https://example.com/registrar',
      });
    });
  });

  describe('normalizeEvents edge cases', () => {
    it('should handle null events', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        events: null,
      };
      const result = (normalizer as any).normalizeEvents(raw.events);
      expect(result).toEqual([]);
    });

    it('should handle undefined events', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
      };
      const result = (normalizer as any).normalizeEvents(raw.events);
      expect(result).toEqual([]);
    });

    it('should handle empty events array', () => {
      const raw = {
        objectClassName: 'domain',
        handle: 'test',
        events: [],
      };
      const result = (normalizer as any).normalizeEvents(raw.events);
      expect(result).toEqual([]);
    });

    it('should normalize eventAction to type', () => {
      const rawEvents = [
        { eventAction: 'created', eventDate: '2020-01-01T00:00:00Z' },
        { eventAction: 'expiration', eventDate: '2025-01-01T00:00:00Z' },
      ];
      const result = (normalizer as any).normalizeEvents(rawEvents);
      expect(result).toEqual([
        { type: 'created', date: '2020-01-01T00:00:00Z', actor: undefined },
        { type: 'expiration', date: '2025-01-01T00:00:00Z', actor: undefined },
      ]);
    });
  });
});
