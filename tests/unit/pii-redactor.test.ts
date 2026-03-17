/**
 * Tests for PIIRedactor
 */

import { PIIRedactor } from '../../src/infrastructure/security/PIIRedactor';
import type { DomainResponse, RDAPEntity } from '../../src/shared/types';

describe('PIIRedactor', () => {
  describe('constructor', () => {
    it('should create with default options', () => {
      const redactor = new PIIRedactor();
      const config = redactor.getConfig();

      expect(config.redactPII).toBe(true);
      expect(config.redactFields).toEqual(['email', 'phone', 'fax']);
      expect(config.redactionText).toBe('[REDACTED]');
    });

    it('should create with custom options', () => {
      const redactor = new PIIRedactor({
        redactPII: false,
        redactFields: ['email'],
        redactionText: '***',
      });
      const config = redactor.getConfig();

      expect(config.redactPII).toBe(false);
      expect(config.redactFields).toEqual(['email']);
      expect(config.redactionText).toBe('***');
    });
  });

  describe('redact', () => {
    it('should not redact when disabled', () => {
      const redactor = new PIIRedactor({ redactPII: false });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['email', {}, 'text', 'test@example.com'],
              ],
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('test@example.com');
    });

    it('should redact email addresses', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['email', {}, 'text', 'test@example.com'],
              ],
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact phone numbers', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['tel', {}, 'text', '+1-555-1234'],
              ],
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact fax numbers', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['fax', {}, 'text', '+1-555-5678'],
              ],
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact addresses', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['adr', {}, 'text', '123 Main St'],
              ],
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should handle nested entities', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['email', {}, 'text', 'parent@example.com'],
              ],
            ],
            entities: [
              {
                handle: 'TEST-2',
                roles: ['technical'],
                vcardArray: [
                  'vcard',
                  [
                    ['version', {}, 'text', '4.0'],
                    ['email', {}, 'text', 'child@example.com'],
                  ],
                ],
              },
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
      expect(redacted.entities?.[0]?.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should handle responses without entities', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted).toEqual(response);
    });

    it('should handle malformed vCard arrays', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: ['vcard'] as any, // Malformed
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray).toEqual(['vcard']);
    });

    it('should use custom redaction text', () => {
      const redactor = new PIIRedactor({
        redactPII: true,
        redactionText: '***HIDDEN***',
      });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['email', {}, 'text', 'test@example.com'],
              ],
            ],
          },
        ],
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };

      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('***HIDDEN***');
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      expect(redactor.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const redactor = new PIIRedactor({ redactPII: false });
      expect(redactor.isEnabled()).toBe(false);
    });
  });

  describe('PII pattern matching', () => {
    const makeResponse = (fieldName: string): DomainResponse => ({
      query: 'example.com',
      objectClass: 'domain',
      entities: [
        {
          handle: 'TEST-1',
          roles: ['registrant'],
          vcardArray: [
            'vcard',
            [
              ['version', {}, 'text', '4.0'],
              [fieldName, {}, 'text', 'sensitive-data'],
            ],
          ],
        },
      ],
      metadata: { source: 'test', timestamp: new Date().toISOString(), cached: false },
    });

    it('should redact url fields', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('url'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact geo fields', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('geo'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact key fields', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('key'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact photo fields', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('photo'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact sound fields', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('sound'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact uid fields', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('uid'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should redact fields matching via includes (e.g. work-email)', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('work-email'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('[REDACTED]');
    });

    it('should not redact non-PII fields like fn or org', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const redacted = redactor.redact(makeResponse('fn'));
      expect(redacted.entities?.[0]?.vcardArray?.[1]?.[1]?.[3]).toBe('sensitive-data');
    });

    it('should not redact fields with insufficient vCard entry length', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [
          {
            handle: 'TEST-1',
            roles: ['registrant'],
            vcardArray: [
              'vcard',
              [
                ['version', {}, 'text', '4.0'],
                ['email', {}] as any, // entry with fewer than 4 elements
              ],
            ],
          },
        ],
        metadata: { source: 'test', timestamp: new Date().toISOString(), cached: false },
      };
      // Should not throw - short entries are returned as-is
      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.vcardArray).toBeDefined();
    });

    it('should handle entity without vcardArray', () => {
      const redactor = new PIIRedactor({ redactPII: true });
      const response: DomainResponse = {
        query: 'example.com',
        objectClass: 'domain',
        entities: [{ handle: 'TEST-1', roles: ['registrar'] }],
        metadata: { source: 'test', timestamp: new Date().toISOString(), cached: false },
      };
      const redacted = redactor.redact(response);
      expect(redacted.entities?.[0]?.handle).toBe('TEST-1');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const options = { redactPII: true, redactFields: ['email'], redactionText: '[X]' };
      const redactor = new PIIRedactor(options);
      const config = redactor.getConfig();

      expect(config).toEqual({ redactPII: true, redactFields: ['email'], redactionText: '[X]' });
      // Ensure it's a copy, not the same reference
      config.redactFields.push('phone');
      expect(redactor.getConfig().redactFields).toEqual(['email']);
    });
  });
});
