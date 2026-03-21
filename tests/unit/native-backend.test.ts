/**
 * Unit tests for NativeBackend adapter.
 *
 * Verifies the field-mapping layer between Rust JSON output and TypeScript
 * response interfaces:
 *   meta.source      → metadata.source
 *   meta.queried_at  → metadata.timestamp
 *   meta.cached      → metadata.cached
 *   (none)           → objectClass (added by adapter)
 *
 * The tests mock the rdapify-nd module via jest.mock() so no native binary
 * is required in the test environment.
 */

import { NativeBackend, isNativeAvailable } from '../../src/infrastructure/native/NativeBackend';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal Rust-style meta block (snake_case, field name = queried_at). */
const RUST_META = {
  source: 'https://rdap.verisign.com/com/v1',
  queried_at: '2026-03-21T00:00:00Z',
  cached: false,
};

const RUST_META_CACHED = { ...RUST_META, cached: true };

function rustDomain(overrides: Record<string, unknown> = {}) {
  return {
    query: 'example.com',
    ldhName: 'example.com',
    handle: 'DOM-001',
    status: ['active'],
    nameservers: ['ns1.example.com', 'ns2.example.com'],
    registrar: { name: 'Example Registrar', handle: 'REG-1', url: 'https://example-registrar.com' },
    entities: [],
    events: [],
    links: [],
    remarks: [],
    meta: RUST_META,
    ...overrides,
  };
}

function rustIp(overrides: Record<string, unknown> = {}) {
  return {
    query: '8.8.8.8',
    handle: 'NET-8-8-8-0-1',
    startAddress: '8.8.8.0',
    endAddress: '8.8.8.255',
    ipVersion: 'v4',
    name: 'GOOGLE',
    type: 'DIRECT ALLOCATION',
    country: 'US',
    status: [],
    entities: [],
    events: [],
    links: [],
    remarks: [],
    meta: RUST_META,
    ...overrides,
  };
}

function rustAsn(overrides: Record<string, unknown> = {}) {
  return {
    query: 15169,
    handle: 'AS15169',
    startAutnum: 15169,
    endAutnum: 15169,
    name: 'GOOGLE',
    type: 'DIRECT ALLOCATION',
    country: 'US',
    status: [],
    entities: [],
    events: [],
    links: [],
    remarks: [],
    meta: RUST_META,
    ...overrides,
  };
}

function rustNameserver(overrides: Record<string, unknown> = {}) {
  return {
    query: 'ns1.example.com',
    handle: 'NS-001',
    ldhName: 'ns1.example.com',
    status: [],
    ipAddresses: { v4: ['1.2.3.4'], v6: [] },
    entities: [],
    events: [],
    links: [],
    remarks: [],
    meta: RUST_META,
    ...overrides,
  };
}

function rustEntity(overrides: Record<string, unknown> = {}) {
  return {
    query: 'ARIN-HN-1',
    handle: 'ARIN-HN-1',
    roles: ['registrant'],
    status: [],
    entities: [],
    events: [],
    links: [],
    remarks: [],
    meta: RUST_META,
    ...overrides,
  };
}

// ── Mock rdapify-nd ───────────────────────────────────────────────────────────

jest.mock(
  'rdapify-nd',
  () => ({
    domain: jest.fn(),
    ip: jest.fn(),
    asn: jest.fn(),
    nameserver: jest.fn(),
    entity: jest.fn(),
  }),
  { virtual: true }
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockCore = require('rdapify-nd') as {
  domain: jest.Mock;
  ip: jest.Mock;
  asn: jest.Mock;
  nameserver: jest.Mock;
  entity: jest.Mock;
};

// ── isNativeAvailable ─────────────────────────────────────────────────────────

describe('isNativeAvailable', () => {
  it('returns true when rdapify-nd is loadable', () => {
    expect(isNativeAvailable()).toBe(true);
  });
});

// ── NativeBackend.create ──────────────────────────────────────────────────────

describe('NativeBackend.create', () => {
  it('returns a NativeBackend instance in auto mode', () => {
    const backend = NativeBackend.create('auto');
    expect(backend).toBeInstanceOf(NativeBackend);
  });

  it('returns a NativeBackend instance in native mode', () => {
    const backend = NativeBackend.create('native');
    expect(backend).toBeInstanceOf(NativeBackend);
  });
});

// ── domain() ─────────────────────────────────────────────────────────────────

describe('NativeBackend.domain', () => {
  let backend: NativeBackend;

  beforeEach(() => {
    backend = NativeBackend.create('auto')!;
    mockCore.domain.mockResolvedValue(rustDomain());
  });

  it('adds objectClass: domain', async () => {
    const res = await backend.domain('example.com');
    expect(res.objectClass).toBe('domain');
  });

  it('maps meta → metadata', async () => {
    const res = await backend.domain('example.com');
    expect(res.metadata).toEqual({
      source: RUST_META.source,
      timestamp: RUST_META.queried_at,
      cached: false,
    });
  });

  it('does not expose meta field', async () => {
    const res = await backend.domain('example.com') as any;
    expect(res.meta).toBeUndefined();
  });

  it('preserves all other fields', async () => {
    const res = await backend.domain('example.com');
    expect(res.query).toBe('example.com');
    expect(res.ldhName).toBe('example.com');
    expect(res.handle).toBe('DOM-001');
    expect(res.nameservers).toEqual(['ns1.example.com', 'ns2.example.com']);
    expect(res.registrar?.name).toBe('Example Registrar');
  });

  it('reflects cached: true from meta', async () => {
    mockCore.domain.mockResolvedValue(rustDomain({ meta: RUST_META_CACHED }));
    const res = await backend.domain('example.com');
    expect(res.metadata.cached).toBe(true);
  });

  it('forwards the query string to the native module', async () => {
    await backend.domain('example.com');
    expect(mockCore.domain).toHaveBeenCalledWith('example.com');
  });
});

// ── ip() ──────────────────────────────────────────────────────────────────────

describe('NativeBackend.ip', () => {
  let backend: NativeBackend;

  beforeEach(() => {
    backend = NativeBackend.create('auto')!;
    mockCore.ip.mockResolvedValue(rustIp());
  });

  it('adds objectClass: ip network', async () => {
    const res = await backend.ip('8.8.8.8');
    expect(res.objectClass).toBe('ip network');
  });

  it('maps meta → metadata correctly', async () => {
    const res = await backend.ip('8.8.8.8');
    expect(res.metadata.timestamp).toBe(RUST_META.queried_at);
    expect(res.metadata.source).toBe(RUST_META.source);
  });

  it('does not expose meta field', async () => {
    const res = await backend.ip('8.8.8.8') as any;
    expect(res.meta).toBeUndefined();
  });

  it('preserves IP-specific fields', async () => {
    const res = await backend.ip('8.8.8.8');
    expect(res.startAddress).toBe('8.8.8.0');
    expect(res.endAddress).toBe('8.8.8.255');
    expect(res.country).toBe('US');
    expect(res.name).toBe('GOOGLE');
  });
});

// ── asn() ─────────────────────────────────────────────────────────────────────

describe('NativeBackend.asn', () => {
  let backend: NativeBackend;

  beforeEach(() => {
    backend = NativeBackend.create('auto')!;
    mockCore.asn.mockResolvedValue(rustAsn());
  });

  it('adds objectClass: autnum', async () => {
    const res = await backend.asn('AS15169');
    expect(res.objectClass).toBe('autnum');
  });

  it('coerces numeric query to string', async () => {
    // Rust serialises query as u32; adapter must coerce to string
    mockCore.asn.mockResolvedValue(rustAsn({ query: 15169 }));
    const res = await backend.asn(15169);
    expect(typeof res.query).toBe('string');
    expect(res.query).toBe('15169');
  });

  it('maps meta → metadata', async () => {
    const res = await backend.asn('AS15169');
    expect(res.metadata.timestamp).toBe(RUST_META.queried_at);
  });

  it('forwards string ASN to native module', async () => {
    await backend.asn('AS15169');
    expect(mockCore.asn).toHaveBeenCalledWith('AS15169');
  });

  it('forwards numeric ASN as string to native module', async () => {
    await backend.asn(15169);
    expect(mockCore.asn).toHaveBeenCalledWith('15169');
  });
});

// ── nameserver() ──────────────────────────────────────────────────────────────

describe('NativeBackend.nameserver', () => {
  let backend: NativeBackend;

  beforeEach(() => {
    backend = NativeBackend.create('auto')!;
    mockCore.nameserver.mockResolvedValue(rustNameserver());
  });

  it('adds objectClass: nameserver', async () => {
    const res = await backend.nameserver('ns1.example.com');
    expect(res.objectClass).toBe('nameserver');
  });

  it('maps meta → metadata', async () => {
    const res = await backend.nameserver('ns1.example.com');
    expect(res.metadata.timestamp).toBe(RUST_META.queried_at);
  });

  it('preserves ipAddresses', async () => {
    const res = await backend.nameserver('ns1.example.com');
    expect((res as any).ipAddresses?.v4).toEqual(['1.2.3.4']);
  });
});

// ── entity() ─────────────────────────────────────────────────────────────────

describe('NativeBackend.entity', () => {
  let backend: NativeBackend;

  beforeEach(() => {
    backend = NativeBackend.create('auto')!;
    mockCore.entity.mockResolvedValue(rustEntity());
  });

  it('adds objectClass: entity', async () => {
    const res = await backend.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
    expect(res.objectClass).toBe('entity');
  });

  it('maps meta → metadata', async () => {
    const res = await backend.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
    expect(res.metadata.timestamp).toBe(RUST_META.queried_at);
  });

  it('forwards handle and serverUrl to native module', async () => {
    await backend.entity('ARIN-HN-1', 'https://rdap.arin.net/registry');
    expect(mockCore.entity).toHaveBeenCalledWith('ARIN-HN-1', 'https://rdap.arin.net/registry');
  });
});
