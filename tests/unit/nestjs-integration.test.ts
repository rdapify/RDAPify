/**
 * Unit tests for the NestJS integration module
 */

import {
  RdapifyModule,
  InjectRdapClient,
  RDAPIFY_CLIENT_TOKEN,
} from '../../src/integrations/nestjs';
import { RDAPClient } from '../../src/application/client';

describe('RDAPIFY_CLIENT_TOKEN', () => {
  it('is a Symbol', () => {
    expect(typeof RDAPIFY_CLIENT_TOKEN).toBe('symbol');
  });
});

describe('RdapifyModule.forRoot()', () => {
  it('returns a dynamic module with correct shape', () => {
    const mod = RdapifyModule.forRoot();
    expect(mod.module).toBe(RdapifyModule);
    expect(Array.isArray(mod.providers)).toBe(true);
    expect(Array.isArray(mod.exports)).toBe(true);
  });

  it('exports RDAPIFY_CLIENT_TOKEN', () => {
    const mod = RdapifyModule.forRoot();
    expect(mod.exports).toContain(RDAPIFY_CLIENT_TOKEN);
  });

  it('provides a factory for RDAPIFY_CLIENT_TOKEN', () => {
    const mod = RdapifyModule.forRoot();
    const provider = mod.providers.find((p) => p.provide === RDAPIFY_CLIENT_TOKEN);
    expect(provider).toBeDefined();
    expect(typeof provider!.useFactory).toBe('function');
  });

  it('provider factory creates an RDAPClient', () => {
    const mod = RdapifyModule.forRoot();
    const provider = mod.providers.find((p) => p.provide === RDAPIFY_CLIENT_TOKEN)!;
    const client = provider.useFactory();
    expect(client).toBeInstanceOf(RDAPClient);
  });

  it('passes options to RDAPClient', () => {
    const mod = RdapifyModule.forRoot({ cache: false });
    const provider = mod.providers.find((p) => p.provide === RDAPIFY_CLIENT_TOKEN)!;
    const client = provider.useFactory();
    // Client instantiates successfully — options are accepted
    expect(client).toBeInstanceOf(RDAPClient);
  });

  it('can be called multiple times with different options', () => {
    const mod1 = RdapifyModule.forRoot({ cache: true });
    const mod2 = RdapifyModule.forRoot({ cache: false });
    const client1 = mod1.providers[0]!.useFactory();
    const client2 = mod2.providers[0]!.useFactory();
    expect(client1).toBeInstanceOf(RDAPClient);
    expect(client2).toBeInstanceOf(RDAPClient);
    expect(client1).not.toBe(client2);
  });
});

describe('InjectRdapClient()', () => {
  it('returns a ParameterDecorator (function)', () => {
    const decorator = InjectRdapClient();
    expect(typeof decorator).toBe('function');
  });

  it('can be applied to a constructor parameter without throwing', () => {
    const decorator = InjectRdapClient();
    // Simulate applying to a class constructor parameter
    class TestService {
      constructor(_client: RDAPClient) {}
    }
    expect(() => decorator(TestService, undefined, 0)).not.toThrow();
  });

  it('calls Reflect.defineMetadata when available', () => {
    const defineMetadata = jest.fn();
    const originalReflect = (globalThis as Record<string, unknown>)['Reflect'];
    (globalThis as Record<string, unknown>)['Reflect'] = { defineMetadata };

    try {
      const decorator = InjectRdapClient();
      class Svc { constructor(_c: unknown) {} }
      decorator(Svc, undefined, 0);
      expect(defineMetadata).toHaveBeenCalled();
    } finally {
      (globalThis as Record<string, unknown>)['Reflect'] = originalReflect;
    }
  });
});
