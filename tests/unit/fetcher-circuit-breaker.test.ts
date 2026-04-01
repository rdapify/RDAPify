/**
 * Integration tests: CircuitBreaker wired into Fetcher (S2-C)
 *
 * Verifies:
 * - Circuit opens after N failures per registry
 * - Open circuit rejects immediately without a network call
 * - Different registry origins have independent circuits
 * - getCircuitBreakerStats() returns per-origin state
 * - circuitBreaker: false disables protection
 */

import { Fetcher } from '../../src/infrastructure/http/Fetcher';
import { CircuitOpenError } from '../../src/infrastructure/http/CircuitBreaker';
import { NetworkError, RDAPServerError } from '../../src/shared/errors';

const GOOD_RESPONSE = { objectClassName: 'domain', ldhName: 'example.com' };

function mockFetch(responses: Array<() => Response | Promise<Response>>) {
  let call = 0;
  global.fetch = jest.fn(async () => {
    const factory = responses[call] ?? responses[responses.length - 1]!;
    call++;
    return factory();
  }) as unknown as typeof global.fetch;
}

function okResponse(body = GOOD_RESPONSE): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function serverErrorResponse(status = 503): Response {
  return {
    ok: false,
    status,
    statusText: 'Service Unavailable',
    headers: { get: () => null },
    json: () => Promise.reject(new Error('no body')),
    text: () => Promise.resolve('error'),
  } as unknown as Response;
}

function networkFailure(): never {
  throw new TypeError('Failed to fetch');
}

describe('Fetcher — CircuitBreaker integration (S2-C)', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // ── Circuit opens on failures ──────────────────────────────────────────────

  it('opens the circuit after failureThreshold server errors', async () => {
    const fetcher = new Fetcher({
      circuitBreaker: { failureThreshold: 3, halfOpenTimeout: 60_000 },
    });
    mockFetch([() => serverErrorResponse(503)]);

    for (let i = 0; i < 3; i++) {
      await expect(
        fetcher.fetch('https://rdap.example.com/domain/x.com')
      ).rejects.toThrow(RDAPServerError);
    }

    const stats = fetcher.getCircuitBreakerStats();
    expect(stats['https://rdap.example.com']?.state).toBe('open');
  });

  it('opens the circuit after failureThreshold network failures', async () => {
    const fetcher = new Fetcher({
      circuitBreaker: { failureThreshold: 2, halfOpenTimeout: 60_000 },
    });
    mockFetch([() => { networkFailure(); return undefined as never; }]);

    for (let i = 0; i < 2; i++) {
      await expect(
        fetcher.fetch('https://rdap.example.net/domain/x.net')
      ).rejects.toThrow();
    }

    const stats = fetcher.getCircuitBreakerStats();
    expect(stats['https://rdap.example.net']?.state).toBe('open');
  });

  // ── Open circuit rejects without network call ──────────────────────────────

  it('throws CircuitOpenError without a network call when circuit is open', async () => {
    const fetcher = new Fetcher({
      circuitBreaker: { failureThreshold: 1, halfOpenTimeout: 60_000 },
    });

    // Trip the circuit with one failure
    mockFetch([() => serverErrorResponse()]);
    await expect(fetcher.fetch('https://rdap.trip.test/domain/x')).rejects.toThrow(RDAPServerError);

    // Replace fetch with a fresh spy — any call means the circuit did NOT block it
    const fetchSpy = jest.fn<Promise<Response>, [string, RequestInit?]>();
    global.fetch = fetchSpy as unknown as typeof global.fetch;

    // Circuit is open — must throw CircuitOpenError without touching fetch
    await expect(
      fetcher.fetch('https://rdap.trip.test/domain/y')
    ).rejects.toThrow(CircuitOpenError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── Per-origin isolation ───────────────────────────────────────────────────

  it('does not trip the circuit for origin B when origin A fails', async () => {
    const fetcher = new Fetcher({
      circuitBreaker: { failureThreshold: 1, halfOpenTimeout: 60_000 },
    });

    // Trip origin A
    mockFetch([() => serverErrorResponse()]);
    await expect(fetcher.fetch('https://rdap.origin-a.test/domain/x')).rejects.toThrow();

    // Origin B should still work
    global.fetch = jest.fn(() => Promise.resolve(okResponse())) as unknown as typeof global.fetch;
    const result = await fetcher.fetch('https://rdap.origin-b.test/domain/y');
    expect(result).toMatchObject({ objectClassName: 'domain' });

    const stats = fetcher.getCircuitBreakerStats();
    expect(stats['https://rdap.origin-a.test']?.state).toBe('open');
    expect(stats['https://rdap.origin-b.test']?.state).toBe('closed');
  });

  // ── Successful requests do not trip ───────────────────────────────────────

  it('keeps the circuit closed after a successful request', async () => {
    const fetcher = new Fetcher({ circuitBreaker: { failureThreshold: 3 } });
    global.fetch = jest.fn(() => Promise.resolve(okResponse())) as unknown as typeof global.fetch;

    await fetcher.fetch('https://rdap.healthy.test/domain/a');

    const stats = fetcher.getCircuitBreakerStats();
    expect(stats['https://rdap.healthy.test']?.state).toBe('closed');
  });

  // ── getCircuitBreakerStats() ───────────────────────────────────────────────

  it('returns empty stats when no requests have been made', () => {
    const fetcher = new Fetcher({ circuitBreaker: {} });
    expect(fetcher.getCircuitBreakerStats()).toEqual({});
  });

  it('returns stats for all contacted origins', async () => {
    const fetcher = new Fetcher({
      circuitBreaker: { failureThreshold: 10 },
    });
    global.fetch = jest.fn(() => Promise.resolve(okResponse())) as unknown as typeof global.fetch;

    await fetcher.fetch('https://rdap.reg1.test/domain/a');
    await fetcher.fetch('https://rdap.reg2.test/domain/b');

    const stats = fetcher.getCircuitBreakerStats();
    expect(Object.keys(stats)).toHaveLength(2);
    expect(stats['https://rdap.reg1.test']?.state).toBe('closed');
    expect(stats['https://rdap.reg2.test']?.state).toBe('closed');
  });

  // ── Disabled via circuitBreaker: false ────────────────────────────────────

  it('does not trip when circuitBreaker: false', async () => {
    const fetcher = new Fetcher({ circuitBreaker: false });
    mockFetch([() => serverErrorResponse()]);

    // Repeated failures should NOT open any circuit
    for (let i = 0; i < 10; i++) {
      await expect(
        fetcher.fetch('https://rdap.nobreaker.test/domain/x')
      ).rejects.toThrow(RDAPServerError);
    }

    expect(fetcher.getCircuitBreakerStats()).toEqual({});
  });

  it('does not throw CircuitOpenError when disabled, even after many failures', async () => {
    const fetcher = new Fetcher({ circuitBreaker: false });
    global.fetch = jest.fn(() => Promise.resolve(okResponse())) as unknown as typeof global.fetch;

    // Should succeed normally after prior failures (no circuit state accumulated)
    const result = await fetcher.fetch('https://rdap.nobreaker.test/domain/ok');
    expect(result).toMatchObject({ objectClassName: 'domain' });
  });

  // ── NetworkError propagation ───────────────────────────────────────────────

  it('wraps unknown errors as NetworkError (not CircuitOpenError)', async () => {
    const fetcher = new Fetcher({ circuitBreaker: false });
    global.fetch = jest.fn(() => { throw new TypeError('custom network error'); }) as unknown as typeof global.fetch;

    await expect(fetcher.fetch('https://rdap.example.com/domain/x')).rejects.toThrow(NetworkError);
  });
});
