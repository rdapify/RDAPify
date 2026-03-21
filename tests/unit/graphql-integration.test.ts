/**
 * Unit tests for the GraphQL integration
 */

import { createRdapifySchema, RDAPIFY_TYPE_DEFS } from '../../src/integrations/graphql';
import type { RDAPClient } from '../../src/application/client';

function makeClient(overrides: Partial<{
  domain: jest.Mock;
  ip: jest.Mock;
  asn: jest.Mock;
}> = {}): RDAPClient {
  return {
    domain: overrides.domain ?? jest.fn(),
    ip: overrides.ip ?? jest.fn(),
    asn: overrides.asn ?? jest.fn(),
  } as unknown as RDAPClient;
}

describe('createRdapifySchema()', () => {
  it('returns typeDefs and resolvers', () => {
    const client = makeClient();
    const schema = createRdapifySchema(client);
    expect(typeof schema.typeDefs).toBe('string');
    expect(schema.resolvers.Query).toBeDefined();
  });

  it('typeDefs contains domain, ip, asn Query fields', () => {
    const schema = createRdapifySchema(makeClient());
    expect(schema.typeDefs).toContain('domain(name: String!)');
    expect(schema.typeDefs).toContain('ip(address: String!)');
    expect(schema.typeDefs).toContain('asn(number: String!)');
  });

  it('RDAPIFY_TYPE_DEFS constant matches the returned typeDefs', () => {
    const schema = createRdapifySchema(makeClient());
    expect(schema.typeDefs).toBe(RDAPIFY_TYPE_DEFS);
  });

  it('domain resolver calls client.domain() with the name arg', async () => {
    const mockDomain = jest.fn().mockResolvedValueOnce({
      query: 'example.com',
      ldhName: 'example.com',
      registrar: { name: 'ExReg Inc' },
      status: ['active'],
      expiresAt: new Date('2027-01-01'),
      createdAt: new Date('2020-01-01'),
      updatedAt: null,
    });
    const schema = createRdapifySchema(makeClient({ domain: mockDomain }));

    const result = await schema.resolvers.Query.domain(null, { name: 'example.com' });
    expect(mockDomain).toHaveBeenCalledWith('example.com');
    expect((result as Record<string, unknown>)['query']).toBe('example.com');
    expect((result as Record<string, unknown>)['registrar']).toBe('ExReg Inc');
  });

  it('domain resolver returns null registrar when none present', async () => {
    const mockDomain = jest.fn().mockResolvedValueOnce({
      query: 'example.com',
      status: [],
    });
    const schema = createRdapifySchema(makeClient({ domain: mockDomain }));

    const result = (await schema.resolvers.Query.domain(null, { name: 'example.com' })) as Record<string, unknown>;
    expect(result['registrar']).toBeNull();
  });

  it('ip resolver calls client.ip() with the address arg', async () => {
    const mockIp = jest.fn().mockResolvedValueOnce({
      query: '8.8.8.8',
      country: 'US',
      name: 'GOOGLE',
      status: ['active'],
    });
    const schema = createRdapifySchema(makeClient({ ip: mockIp }));

    const result = await schema.resolvers.Query.ip(null, { address: '8.8.8.8' });
    expect(mockIp).toHaveBeenCalledWith('8.8.8.8');
    expect((result as Record<string, unknown>)['country']).toBe('US');
  });

  it('asn resolver calls client.asn() with the number arg', async () => {
    const mockAsn = jest.fn().mockResolvedValueOnce({
      query: 15169,
      name: 'GOOGLE',
      status: ['active'],
      startAutnum: 15169,
      endAutnum: 15169,
    });
    const schema = createRdapifySchema(makeClient({ asn: mockAsn }));

    const result = await schema.resolvers.Query.asn(null, { number: 'AS15169' });
    expect(mockAsn).toHaveBeenCalledWith('AS15169');
    expect((result as Record<string, unknown>)['name']).toBe('GOOGLE');
  });

  it('domain resolver propagates errors', async () => {
    const mockDomain = jest.fn().mockRejectedValueOnce(new Error('network error'));
    const schema = createRdapifySchema(makeClient({ domain: mockDomain }));

    await expect(schema.resolvers.Query.domain(null, { name: 'bad.com' })).rejects.toThrow('network error');
  });
});
