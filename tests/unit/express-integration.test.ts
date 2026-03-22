/**
 * Unit tests for the Express.js integration
 */

import { rdapifyExpress, MinimalRouter } from '../../src/integrations/express';
import type { RequestLike, ResponseLike } from '../../src/integrations/express';
import type { RDAPClient } from '../../src/application/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeReq(params: Record<string, string>): RequestLike {
  return { params };
}

function makeRes(): ResponseLike & { body: unknown; statusCode: number } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(data: unknown) { this.body = data; return this; },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rdapifyExpress()', () => {
  it('returns a MinimalRouter when no router is provided', () => {
    const client = makeClient();
    const router = rdapifyExpress(client);
    expect(router).toBeInstanceOf(MinimalRouter);
  });

  it('registers /domain/:name, /ip/:address, /asn/:number routes', () => {
    const client = makeClient();
    const router = rdapifyExpress(client) as MinimalRouter;
    const paths = router.routes.map((r) => r.path);
    expect(paths).toContain('/domain/:name');
    expect(paths).toContain('/ip/:address');
    expect(paths).toContain('/asn/:number');
  });

  it('domain route calls client.domain() and returns result', async () => {
    const payload = { query: 'example.com', ldhName: 'example.com', status: [] };
    const mockDomain = jest.fn().mockResolvedValueOnce(payload);
    const router = rdapifyExpress(makeClient({ domain: mockDomain })) as MinimalRouter;
    const domainRoute = router.routes.find((r) => r.path === '/domain/:name')!;

    const req = makeReq({ name: 'example.com' });
    const res = makeRes();

    await (domainRoute.handler as Function)(req, res);
    expect(mockDomain).toHaveBeenCalledWith('example.com');
    expect(res.body).toEqual(payload);
    expect(res.statusCode).toBe(200);
  });

  it('domain route returns 500 on client error', async () => {
    const mockDomain = jest.fn().mockRejectedValueOnce(new Error('network error'));
    const router = rdapifyExpress(makeClient({ domain: mockDomain })) as MinimalRouter;
    const domainRoute = router.routes.find((r) => r.path === '/domain/:name')!;

    const req = makeReq({ name: 'bad.com' });
    const res = makeRes();

    await (domainRoute.handler as Function)(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>)['error']).toBe('network error');
  });

  it('ip route calls client.ip()', async () => {
    const payload = { query: '8.8.8.8', country: 'US', status: [] };
    const mockIp = jest.fn().mockResolvedValueOnce(payload);
    const router = rdapifyExpress(makeClient({ ip: mockIp })) as MinimalRouter;
    const ipRoute = router.routes.find((r) => r.path === '/ip/:address')!;

    const req = makeReq({ address: '8.8.8.8' });
    const res = makeRes();

    await (ipRoute.handler as Function)(req, res);
    expect(mockIp).toHaveBeenCalledWith('8.8.8.8');
    expect(res.body).toEqual(payload);
  });

  it('asn route calls client.asn()', async () => {
    const payload = { query: 15169, name: 'GOOGLE', status: [] };
    const mockAsn = jest.fn().mockResolvedValueOnce(payload);
    const router = rdapifyExpress(makeClient({ asn: mockAsn })) as MinimalRouter;
    const asnRoute = router.routes.find((r) => r.path === '/asn/:number')!;

    const req = makeReq({ number: 'AS15169' });
    const res = makeRes();

    await (asnRoute.handler as Function)(req, res);
    expect(mockAsn).toHaveBeenCalledWith('AS15169');
    expect(res.body).toEqual(payload);
  });

  it('attaches routes to a provided router without replacing it', () => {
    const externalRouter = new MinimalRouter();
    const returnedRouter = rdapifyExpress(makeClient(), externalRouter);
    expect(returnedRouter).toBe(externalRouter);
    expect(externalRouter.routes.length).toBe(3);
  });

  it('ip route returns 500 on client error', async () => {
    const mockIp = jest.fn().mockRejectedValueOnce(new Error('ip network error'));
    const router = rdapifyExpress(makeClient({ ip: mockIp })) as MinimalRouter;
    const ipRoute = router.routes.find((r) => r.path === '/ip/:address')!;

    const req = makeReq({ address: '1.2.3.4' });
    const res = makeRes();

    await (ipRoute.handler as Function)(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>)['error']).toBe('ip network error');
  });

  it('asn route returns 500 on client error', async () => {
    const mockAsn = jest.fn().mockRejectedValueOnce(new Error('asn not found'));
    const router = rdapifyExpress(makeClient({ asn: mockAsn })) as MinimalRouter;
    const asnRoute = router.routes.find((r) => r.path === '/asn/:number')!;

    const req = makeReq({ number: 'AS99999' });
    const res = makeRes();

    await (asnRoute.handler as Function)(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>)['error']).toBe('asn not found');
  });

  it('non-Error thrown objects are stringified in error response', async () => {
    const mockDomain = jest.fn().mockRejectedValueOnce('plain string error');
    const router = rdapifyExpress(makeClient({ domain: mockDomain })) as MinimalRouter;
    const domainRoute = router.routes.find((r) => r.path === '/domain/:name')!;

    const req = makeReq({ name: 'example.com' });
    const res = makeRes();

    await (domainRoute.handler as Function)(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>)['error']).toBe('plain string error');
  });

  it('missing param falls back to empty string', async () => {
    const mockDomain = jest.fn().mockResolvedValueOnce({ query: '', status: [] });
    const router = rdapifyExpress(makeClient({ domain: mockDomain })) as MinimalRouter;
    const domainRoute = router.routes.find((r) => r.path === '/domain/:name')!;

    const req = makeReq({}); // no 'name' param
    const res = makeRes();

    await (domainRoute.handler as Function)(req, res);
    expect(mockDomain).toHaveBeenCalledWith('');
  });

  it('ip route: non-Error thrown objects are stringified', async () => {
    const mockIp = jest.fn().mockRejectedValueOnce('plain ip error');
    const router = rdapifyExpress(makeClient({ ip: mockIp })) as MinimalRouter;
    const ipRoute = router.routes.find((r) => r.path === '/ip/:address')!;

    const req = makeReq({ address: '1.2.3.4' });
    const res = makeRes();

    await (ipRoute.handler as Function)(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>)['error']).toBe('plain ip error');
  });

  it('asn route: non-Error thrown objects are stringified', async () => {
    const mockAsn = jest.fn().mockRejectedValueOnce('plain asn error');
    const router = rdapifyExpress(makeClient({ asn: mockAsn })) as MinimalRouter;
    const asnRoute = router.routes.find((r) => r.path === '/asn/:number')!;

    const req = makeReq({ number: 'AS1' });
    const res = makeRes();

    await (asnRoute.handler as Function)(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as Record<string, unknown>)['error']).toBe('plain asn error');
  });

  it('ip route: missing param falls back to empty string', async () => {
    const mockIp = jest.fn().mockResolvedValueOnce({ query: '', status: [] });
    const router = rdapifyExpress(makeClient({ ip: mockIp })) as MinimalRouter;
    const ipRoute = router.routes.find((r) => r.path === '/ip/:address')!;

    await (ipRoute.handler as Function)(makeReq({}), makeRes());
    expect(mockIp).toHaveBeenCalledWith('');
  });

  it('asn route: missing param falls back to empty string', async () => {
    const mockAsn = jest.fn().mockResolvedValueOnce({ query: '', status: [] });
    const router = rdapifyExpress(makeClient({ asn: mockAsn })) as MinimalRouter;
    const asnRoute = router.routes.find((r) => r.path === '/asn/:number')!;

    await (asnRoute.handler as Function)(makeReq({}), makeRes());
    expect(mockAsn).toHaveBeenCalledWith('');
  });
});
