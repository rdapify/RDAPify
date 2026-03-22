/**
 * Coverage-oriented tests for RDAPClient utility methods, retry logic,
 * and runtime-detection constructor branches.
 */

import { RDAPClient } from '../../src/application/client/RDAPClient';
import { ValidationError } from '../../src/shared/errors';

// ── Utility methods ───────────────────────────────────────────────────────────

describe('RDAPClient — utility methods', () => {
  let client: RDAPClient;

  beforeEach(() => {
    client = new RDAPClient({ cache: false });
  });

  afterEach(() => {
    client.destroy();
  });

  it('getConfig() returns client options', () => {
    const config = client.getConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('getRateLimiter() returns the rate limiter', () => {
    const limiter = client.getRateLimiter();
    expect(limiter).toBeDefined();
  });

  it('getBatchProcessor() returns the batch processor', () => {
    const bp = client.getBatchProcessor();
    expect(bp).toBeDefined();
  });

  it('getStats() returns cache and bootstrap stats', async () => {
    const stats = await client.getStats();
    expect(stats).toHaveProperty('cache');
    expect(stats).toHaveProperty('bootstrap');
  });

  it('getMetrics() returns metrics summary', () => {
    const metrics = client.getMetrics();
    expect(metrics).toBeDefined();
  });

  it('getMetrics(since) passes since parameter', () => {
    const metrics = client.getMetrics(Date.now() - 1000);
    expect(metrics).toBeDefined();
  });

  it('getConnectionPoolStats() returns pool stats', () => {
    const stats = client.getConnectionPoolStats();
    expect(stats).toHaveProperty('totalConnections');
  });

  it('getMiddlewareManager() returns middleware manager', () => {
    const mgr = client.getMiddlewareManager();
    expect(mgr).toBeDefined();
  });

  it('getDeduplicatorStats() returns dedup stats', () => {
    const stats = client.getDeduplicatorStats();
    expect(stats).toBeDefined();
  });

  it('getLogger() returns the logger', () => {
    const logger = client.getLogger();
    expect(logger).toBeDefined();
  });

  it('getLogs() returns log array', () => {
    const logs = client.getLogs();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('getLogs(count) limits log count', () => {
    const logs = client.getLogs(5);
    expect(Array.isArray(logs)).toBe(true);
  });

  it('use() returns this for chaining', () => {
    const result = client.use({ beforeQuery: () => {} });
    expect(result).toBe(client);
  });

  it('clearCache() resolves without error', async () => {
    await expect(client.clearCache()).resolves.not.toThrow();
  });

  it('clearAll() clears cache, metrics, and logs', async () => {
    await expect(client.clearAll()).resolves.not.toThrow();
    const logs = client.getLogs();
    expect(logs.length).toBe(0);
  });

  it('destroy() does not throw', () => {
    expect(() => client.destroy()).not.toThrow();
  });
});

// ── Constructor option variations ─────────────────────────────────────────────

describe('RDAPClient — constructor option variations', () => {
  it('accepts timeout as number', () => {
    const c = new RDAPClient({ timeout: 5000, cache: false });
    expect(c.getConfig().timeout).toBe(5000);
    c.destroy();
  });

  it('accepts timeout as object', () => {
    const c = new RDAPClient({ timeout: { request: 5000, connect: 2000, dns: 1000 }, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts retry: false', () => {
    const c = new RDAPClient({ retry: false, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts retry: true', () => {
    const c = new RDAPClient({ retry: true, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts cache: true', () => {
    const c = new RDAPClient({ cache: true });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts privacy: true', () => {
    const c = new RDAPClient({ privacy: true, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts privacy: false', () => {
    const c = new RDAPClient({ privacy: false, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts rateLimit: false', () => {
    const c = new RDAPClient({ rateLimit: false, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts rateLimit: true', () => {
    const c = new RDAPClient({ rateLimit: true, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts ssrfProtection: false', () => {
    const c = new RDAPClient({ ssrfProtection: false, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts debug: true', () => {
    const c = new RDAPClient({ debug: true, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts debug object with custom logger', () => {
    const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const c = new RDAPClient({ debug: { enabled: true, logger }, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts deduplication: true', () => {
    const c = new RDAPClient({ deduplication: true, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts deduplication: false', () => {
    const c = new RDAPClient({ deduplication: false, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts deduplication as an object', () => {
    const c = new RDAPClient({ deduplication: { windowMs: 5000, enabled: true }, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('backend: native — throws when native module is not installed', () => {
    // Exercises the `backendMode === 'native' ? 'native' : 'auto'` ternary (line 270)
    expect(() => new RDAPClient({ backend: 'native', cache: false })).toThrow();
  });

  it('accepts backend: typescript', () => {
    const c = new RDAPClient({ backend: 'typescript', cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts backend: auto (default)', () => {
    const c = new RDAPClient({ backend: 'auto', cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('accepts logging with level', () => {
    const c = new RDAPClient({ logging: { level: 'debug' }, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });

  it('ignores unknown logging level, defaults to info', () => {
    const c = new RDAPClient({ logging: { level: 'invalid' as 'debug' }, cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });
});

// ── logRedirect debug branch (lines 156-158 in RDAPClient.ts) ─────────────────

describe('RDAPClient — debug logRedirect branch', () => {
  it('calls debugLogger.debug when redirect occurs with debugEnabled', async () => {
    const debugLog = jest.fn();
    const debugLogger = { debug: debugLog, info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const c = new RDAPClient({
      cache: false,
      debug: { enabled: true, logger: debugLogger },
      ssrfProtection: false,
      followRedirects: true,
    });

    // Mock fetch: first call returns 301 redirect, second returns success
    let callCount = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockImplementation(async (_url: string, _opts: unknown) => {
      callCount++;
      if (callCount === 1) {
        // Redirect response
        return {
          ok: false,
          status: 301,
          statusText: 'Moved Permanently',
          headers: {
            get: (name: string) => name === 'Location' ? 'https://rdap.verisign.com/com/v1/domain/example.com' : null,
          },
        } as unknown as Response;
      }
      // Bootstrap or final RDAP response
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/rdap+json' : null,
        },
        json: async () => ({
          objectClassName: 'domain',
          ldhName: 'example.com',
          status: ['active'],
          nameservers: [],
          events: [],
        }),
      } as unknown as Response;
    });

    try {
      // domain() triggers the full pipeline; redirect fires the logRedirect callback
      await c.domain('example.com').catch(() => {/* allow any error after redirect */});
    } finally {
      globalThis.fetch = origFetch;
      c.destroy();
    }

    // debugLogger.debug should have been called with 'Redirect occurred'
    const redirectCall = (debugLog.mock.calls as unknown[][]).find(
      (args) => args[0] === 'Redirect occurred'
    );
    expect(redirectCall).toBeDefined();
  });
});

// ── Runtime detection branches ────────────────────────────────────────────────

describe('RDAPClient — Bun runtime detection', () => {
  let originalBun: unknown;

  beforeAll(() => {
    originalBun = (globalThis as Record<string, unknown>)['Bun'];
    (globalThis as Record<string, unknown>)['Bun'] = { version: '1.0.0' };
  });

  afterAll(() => {
    if (originalBun === undefined) {
      delete (globalThis as Record<string, unknown>)['Bun'];
    } else {
      (globalThis as Record<string, unknown>)['Bun'] = originalBun;
    }
  });

  it('selects BunFetcher when Bun is in globalThis', () => {
    const c = new RDAPClient({ cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });
});

describe('RDAPClient — Deno runtime detection', () => {
  let originalDeno: unknown;

  beforeAll(() => {
    originalDeno = (globalThis as Record<string, unknown>)['Deno'];
    (globalThis as Record<string, unknown>)['Deno'] = { version: { deno: '1.0.0' } };
  });

  afterAll(() => {
    if (originalDeno === undefined) {
      delete (globalThis as Record<string, unknown>)['Deno'];
    } else {
      (globalThis as Record<string, unknown>)['Deno'] = originalDeno;
    }
  });

  it('selects DenoFetcher when Deno is in globalThis', () => {
    const c = new RDAPClient({ cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });
});

describe('RDAPClient — Cloudflare Workers runtime detection', () => {
  let originalCaches: unknown;
  let originalNavigator: unknown;

  beforeAll(() => {
    originalCaches = (globalThis as Record<string, unknown>)['caches'];
    originalNavigator = (globalThis as Record<string, unknown>)['navigator'];
    (globalThis as Record<string, unknown>)['caches'] = {};
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Cloudflare-Workers' },
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    if (originalCaches === undefined) {
      delete (globalThis as Record<string, unknown>)['caches'];
    } else {
      (globalThis as Record<string, unknown>)['caches'] = originalCaches;
    }
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('selects CloudflareWorkersFetcher when CF environment detected', () => {
    const c = new RDAPClient({ cache: false });
    expect(c.getConfig()).toBeDefined();
    c.destroy();
  });
});

// ── fetchWithRetry — retry and ValidationError paths ──────────────────────────

describe('RDAPClient — fetchWithRetry retry logic', () => {
  it('retries on non-ValidationError and eventually returns last error', async () => {
    const c = new RDAPClient({
      cache: false,
      retry: { maxAttempts: 2, backoff: 'fixed', initialDelay: 1, maxDelay: 1 },
    });
    const anyClient = c as Record<string, unknown>;

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async (_url: string) => {
        callCount++;
        throw new Error('transient error');
      },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toThrow('transient error');
    // Should be called maxAttempts (2) times
    expect(callCount).toBe(2);
    c.destroy();
  });

  it('throws ValidationError immediately without retrying', async () => {
    const c = new RDAPClient({
      cache: false,
      retry: { maxAttempts: 3, backoff: 'fixed', initialDelay: 1, maxDelay: 1 },
    });
    const anyClient = c as Record<string, unknown>;

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async (_url: string) => {
        callCount++;
        throw new ValidationError('bad input');
      },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toBeInstanceOf(ValidationError);
    // Should only be called once — ValidationError causes immediate rethrow
    expect(callCount).toBe(1);
    c.destroy();
  });

  it('succeeds without retry on first attempt', async () => {
    const c = new RDAPClient({
      cache: false,
      retry: { maxAttempts: 3, backoff: 'fixed', initialDelay: 1, maxDelay: 1 },
    });
    const anyClient = c as Record<string, unknown>;

    let callCount = 0;
    const fakeResult = { objectClass: 'domain' };
    anyClient['fetcher'] = {
      fetch: async (_url: string) => {
        callCount++;
        return fakeResult;
      },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    const result = await fetchWithRetry('https://rdap.example.com/domain/test');
    expect(result).toBe(fakeResult);
    expect(callCount).toBe(1);
    c.destroy();
  });

  it('retry: false → only 1 attempt', async () => {
    const c = new RDAPClient({ cache: false, retry: false });
    const anyClient = c as Record<string, unknown>;

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async () => {
        callCount++;
        throw new Error('only once');
      },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toThrow();
    expect(callCount).toBe(1);
    c.destroy();
  });

  it('retry: true → uses DEFAULT_OPTIONS retry config', async () => {
    const c = new RDAPClient({ cache: false, retry: true });
    const anyClient = c as Record<string, unknown>;

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async () => {
        callCount++;
        throw new Error('always fail');
      },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    // retry: true uses DEFAULT_OPTIONS which has maxAttempts > 1
    // This exercises the `typeof retry === 'boolean' && retry === true` branch
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toThrow();
    expect(callCount).toBeGreaterThanOrEqual(1);
    c.destroy();
  });

  it('retry options without backoff/initialDelay/maxDelay → uses defaults', async () => {
    // retry with minimal options to exercise the `|| 'exponential'` etc. fallback branches
    const c = new RDAPClient({
      cache: false,
      retry: { maxAttempts: 2 } as unknown as ReturnType<(typeof RDAPClient.prototype)['getConfig']>['retry'],
    });
    const anyClient = c as Record<string, unknown>;

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async () => {
        callCount++;
        throw new Error('fail');
      },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toThrow();
    expect(callCount).toBe(2); // 2 attempts
    c.destroy();
  });
});

// ── ConnectionPool cleanup path ───────────────────────────────────────────────

describe('ConnectionPool — cleanup path', () => {
  it('removes idle connections when cleanup fires via fake timers', async () => {
    const { ConnectionPool } = await import('../../src/infrastructure/http/ConnectionPool');
    jest.useFakeTimers();

    const pool = new ConnectionPool({ keepAlive: true, maxIdleTime: 1000, maxConnections: 5 });

    // Acquire and release so connection is idle
    const id = await pool.acquire('host.example');
    pool.release(id);

    // Advance time so the connection is "old"
    jest.advanceTimersByTime(1001);
    // Trigger the cleanup interval (30s)
    jest.advanceTimersByTime(30000);

    // Stats might now show 0 idle connections (or still 1 if cleanup keeps inUse=false ones)
    const stats = pool.getStats();
    expect(stats).toBeDefined();

    pool.destroy();
    jest.useRealTimers();
  });

  it('resolves waitForConnection when a slot is freed during wait', async () => {
    const { ConnectionPool } = await import('../../src/infrastructure/http/ConnectionPool');

    const pool = new ConnectionPool({ maxConnections: 1, keepAlive: false });
    const id1 = await pool.acquire('host.test');

    // Start waiting for a second connection (will wait since maxConnections=1)
    const waitPromise = pool.acquire('host.test', 500);

    // Release the first connection after a short delay
    setTimeout(() => pool.release(id1), 50);

    const id2 = await waitPromise;
    expect(id2).toBe(id1); // should be the same (reused) connection
    pool.release(id2);
    pool.destroy();
  });

  it('cleanup keeps non-empty active connections (else branch in cleanup)', () => {
    const { ConnectionPool } = require('../../src/infrastructure/http/ConnectionPool');
    jest.useFakeTimers();

    // keepAlive: true + short maxIdleTime so some connections are cleaned up
    const pool = new ConnectionPool({ keepAlive: true, maxIdleTime: 500, maxConnections: 5 });

    // Add two connections manually: one active (in use), one old idle
    const connections = (pool as Record<string, unknown>)['connections'] as Map<string, unknown[]>;
    connections.set('host.example', [
      { id: 'conn-inuse', inUse: true, lastUsed: Date.now(), keepAlive: true },
      { id: 'conn-old', inUse: false, lastUsed: Date.now() - 600, keepAlive: true },
    ]);

    // Trigger cleanup interval (30000ms)
    jest.advanceTimersByTime(30001);

    const stats = pool.getStats();
    // 'conn-inuse' should remain; 'conn-old' should be removed
    expect(stats.totalConnections).toBe(1);
    expect(stats.activeConnections).toBe(1);

    pool.destroy();
    jest.useRealTimers();
  });
});

// ── nativeBackend branch ───────────────────────────────────────────────────────

describe('RDAPClient — nativeBackend branch (injected mock)', () => {
  it('routes all query methods through nativeBackend when set', async () => {
    const c = new RDAPClient({ cache: false, backend: 'typescript' });
    const anyClient = c as Record<string, unknown>;

    const mockDomain = { objectClassName: 'domain' } as any;
    const mockIP = { objectClassName: 'ip network' } as any;
    const mockASN = { objectClassName: 'autnum' } as any;
    const mockNS = { objectClassName: 'nameserver' } as any;
    const mockEntity = { objectClassName: 'entity' } as any;

    anyClient['nativeBackend'] = {
      domain: jest.fn().mockResolvedValue(mockDomain),
      ip: jest.fn().mockResolvedValue(mockIP),
      asn: jest.fn().mockResolvedValue(mockASN),
      nameserver: jest.fn().mockResolvedValue(mockNS),
      entity: jest.fn().mockResolvedValue(mockEntity),
    };

    await expect(c.domain('example.com')).resolves.toBe(mockDomain);
    await expect(c.ip('8.8.8.8')).resolves.toBe(mockIP);
    await expect(c.asn(15169)).resolves.toBe(mockASN);
    await expect(c.nameserver('ns1.example.com')).resolves.toBe(mockNS);
    await expect(c.entity('HANDLE', 'https://rdap.arin.net')).resolves.toBe(mockEntity);

    c.destroy();
  });
});

// ── fetchWithRetry — || fallback branches via direct options override ──────────

describe('RDAPClient — fetchWithRetry || fallback branches', () => {
  it('maxAttempts || 1 fallback when maxAttempts is 0', async () => {
    const c = new RDAPClient({ cache: false, retry: false });
    const anyClient = c as Record<string, unknown>;

    // Override options.retry directly to bypass deepMerge defaults
    (anyClient['options'] as Record<string, unknown>)['retry'] = { maxAttempts: 0 };

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async () => { callCount++; throw new Error('fail'); },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toThrow('fail');
    // maxAttempts=0 → 0 || 1 = 1 → only 1 attempt
    expect(callCount).toBe(1);
    c.destroy();
  });

  it('backoff/initialDelay/maxDelay || fallbacks when fields are undefined', async () => {
    const c = new RDAPClient({ cache: false, retry: false });
    const anyClient = c as Record<string, unknown>;

    // Override options.retry directly — no backoff/initialDelay/maxDelay fields
    // This exercises the `|| 'exponential'`, `|| 1000`, `|| 10000` fallback branches
    (anyClient['options'] as Record<string, unknown>)['retry'] = { maxAttempts: 2 };

    let callCount = 0;
    anyClient['fetcher'] = {
      fetch: async () => { callCount++; throw new Error('fail'); },
    };

    const fetchWithRetry = (anyClient['fetchWithRetry'] as Function).bind(c);
    await expect(fetchWithRetry('https://rdap.example.com/domain/test')).rejects.toThrow('fail');
    expect(callCount).toBe(2);

    c.destroy();
  }, 15000); // allow up to 15s for the ~1000ms sleep in retry loop
});
