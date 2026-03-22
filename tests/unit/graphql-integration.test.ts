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

  it('domain resolver extracts expiresAt from events', async () => {
    const mockDomain = jest.fn().mockResolvedValueOnce({
      query: 'example.com',
      status: ['active'],
      events: [
        { type: 'expiration', date: '2027-01-01T00:00:00Z' },
        { type: 'registration', date: '2020-01-01T00:00:00Z' },
        { type: 'last changed', date: '2024-06-15T00:00:00Z' },
      ],
    });
    const schema = createRdapifySchema(makeClient({ domain: mockDomain }));
    const result = (await schema.resolvers.Query.domain(null, { name: 'example.com' })) as Record<string, unknown>;

    expect(result['expiresAt']).toBe('2027-01-01T00:00:00Z');
    expect(result['createdAt']).toBe('2020-01-01T00:00:00Z');
    expect(result['updatedAt']).toBe('2024-06-15T00:00:00Z');
  });

  it('domain resolver returns null dates when events missing', async () => {
    const mockDomain = jest.fn().mockResolvedValueOnce({ query: 'example.com', status: [] });
    const schema = createRdapifySchema(makeClient({ domain: mockDomain }));
    const result = (await schema.resolvers.Query.domain(null, { name: 'example.com' })) as Record<string, unknown>;

    expect(result['expiresAt']).toBeNull();
    expect(result['createdAt']).toBeNull();
    expect(result['updatedAt']).toBeNull();
  });

  it('ip resolver propagates errors', async () => {
    const mockIp = jest.fn().mockRejectedValueOnce(new Error('ip error'));
    const schema = createRdapifySchema(makeClient({ ip: mockIp }));

    await expect(schema.resolvers.Query.ip(null, { address: 'bad' })).rejects.toThrow('ip error');
  });

  it('asn resolver propagates errors', async () => {
    const mockAsn = jest.fn().mockRejectedValueOnce(new Error('asn error'));
    const schema = createRdapifySchema(makeClient({ asn: mockAsn }));

    await expect(schema.resolvers.Query.asn(null, { number: 'AS0' })).rejects.toThrow('asn error');
  });

  it('ip resolver returns null for missing optional fields', async () => {
    const mockIp = jest.fn().mockResolvedValueOnce({ query: '1.2.3.4', status: [] });
    const schema = createRdapifySchema(makeClient({ ip: mockIp }));
    const result = (await schema.resolvers.Query.ip(null, { address: '1.2.3.4' })) as Record<string, unknown>;

    expect(result['country']).toBeNull();
    expect(result['name']).toBeNull();
    expect(result['startAddress']).toBeNull();
    expect(result['endAddress']).toBeNull();
  });

  it('asn resolver converts query to string', async () => {
    const mockAsn = jest.fn().mockResolvedValueOnce({ query: 15169, name: 'GOOGLE', status: [] });
    const schema = createRdapifySchema(makeClient({ asn: mockAsn }));
    const result = (await schema.resolvers.Query.asn(null, { number: 'AS15169' })) as Record<string, unknown>;
    expect(typeof result['query']).toBe('string');
  });
});
