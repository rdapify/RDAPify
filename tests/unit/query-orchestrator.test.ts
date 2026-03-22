/**
 * Direct unit tests for QueryOrchestrator.
 * Covers cache-hit paths, debug-logging paths, middleware-abort paths,
 * and error paths for all five query types.
 */

import { QueryOrchestrator } from '../../src/application/services/QueryOrchestrator';
import { QueryAbortedError } from '../../src/shared/errors';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCache(cachedValue: unknown = null) {
  return {
    get: jest.fn().mockResolvedValue(cachedValue),
    set: jest.fn().mockResolvedValue(undefined),
  };
}

function makeBootstrap() {
  return {
    discoverDomain: jest.fn().mockResolvedValue('https://rdap.verisign.com/com/v1'),
    discoverIPv4: jest.fn().mockResolvedValue('https://rdap.arin.net/registry'),
    discoverIPv6: jest.fn().mockResolvedValue('https://rdap.arin.net/registry'),
    discoverASN: jest.fn().mockResolvedValue('https://rdap.arin.net/registry'),
    discoverNameserver: jest.fn().mockResolvedValue('https://rdap.verisign.com/com/v1'),
  };
}

function makeNormalizer(objectClass: string) {
  return {
    normalize: jest.fn().mockReturnValue({ objectClass, query: 'x', metadata: {} }),
  };
}

function makeRedactor() {
  return { redact: jest.fn().mockImplementation((v: unknown) => v) };
}

function makeMiddleware(abortBeforeQuery = false) {
  return {
    runBeforeQuery: jest.fn().mockResolvedValue(abortBeforeQuery),
    runAfterQuery: jest.fn().mockResolvedValue(undefined),
    runOnCacheHit: jest.fn().mockResolvedValue(undefined),
    runOnCacheMiss: jest.fn().mockResolvedValue(undefined),
    runOnError: jest.fn().mockResolvedValue(undefined),
  };
}

function makeDebugLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function makeConfig(overrides: Partial<Parameters<typeof QueryOrchestrator>[0]> = {}) {
  return {
    cache: makeCache(),
    bootstrap: makeBootstrap(),
    fetcher: { fetch: jest.fn() } as unknown as Parameters<typeof QueryOrchestrator>[0]['fetcher'],
    normalizer: makeNormalizer('domain'),
    piiRedactor: makeRedactor(),
    includeRaw: false,
    fetchWithRetry: jest.fn().mockResolvedValue({ objectClass: 'domain' }),
    debugEnabled: false,
    ...overrides,
  };
}

// ── Domain ────────────────────────────────────────────────────────────────────

describe('QueryOrchestrator — queryDomain()', () => {
  it('returns cached domain result on cache hit', async () => {
    const cached = { objectClass: 'domain', query: 'example.com', metadata: {} };
    const config = makeConfig({ cache: makeCache(cached) });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryDomain('example.com');
    expect(result).toBe(cached);
    expect(config.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('fetches and caches on cache miss', async () => {
    const config = makeConfig({
      normalizer: makeNormalizer('domain'),
    });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryDomain('example.com');
    expect(config.fetchWithRetry).toHaveBeenCalled();
    expect((result as { objectClass: string }).objectClass).toBe('domain');
  });

  it('runs all middleware hooks on cache miss', async () => {
    const middleware = makeMiddleware();
    const config = makeConfig({ middleware });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(middleware.runBeforeQuery).toHaveBeenCalled();
    expect(middleware.runOnCacheMiss).toHaveBeenCalled();
    expect(middleware.runAfterQuery).toHaveBeenCalled();
  });

  it('runs cache-hit middleware hooks on cache hit', async () => {
    const cached = { objectClass: 'domain', query: 'example.com', metadata: {} };
    const middleware = makeMiddleware();
    const config = makeConfig({ cache: makeCache(cached), middleware });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(middleware.runOnCacheHit).toHaveBeenCalled();
    expect(middleware.runAfterQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fromCache: true })
    );
  });

  it('throws QueryAbortedError when beforeQuery aborts', async () => {
    const middleware = makeMiddleware(true);
    const config = makeConfig({ middleware });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryDomain('example.com')).rejects.toBeInstanceOf(QueryAbortedError);
  });

  it('logs debug messages when debugEnabled is true', async () => {
    const debugLogger = makeDebugLogger();
    const config = makeConfig({ debugEnabled: true, debugLogger });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(debugLogger.debug).toHaveBeenCalledWith('Cache miss', expect.any(Object));
    expect(debugLogger.debug).toHaveBeenCalledWith('RDAP server discovered', expect.any(Object));
    expect(debugLogger.debug).toHaveBeenCalledWith('Request completed', expect.any(Object));
  });

  it('logs debug cache-hit message when debugEnabled is true', async () => {
    const cached = { objectClass: 'domain', query: 'example.com', metadata: {} };
    const debugLogger = makeDebugLogger();
    const config = makeConfig({ cache: makeCache(cached), debugEnabled: true, debugLogger });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(debugLogger.debug).toHaveBeenCalledWith('Cache hit', expect.any(Object));
  });

  it('records failure metrics and rethrows on fetch error', async () => {
    const metrics = { record: jest.fn() };
    const middleware = makeMiddleware();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('network')),
      metricsCollector: metrics as unknown as Parameters<typeof QueryOrchestrator>[0]['metricsCollector'],
      middleware,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryDomain('example.com')).rejects.toThrow('network');
    expect(metrics.record).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(middleware.runOnError).toHaveBeenCalled();
  });

  it('logs debug error when debugEnabled and fetch fails', async () => {
    const debugLogger = makeDebugLogger();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('oops')),
      debugEnabled: true,
      debugLogger,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryDomain('example.com')).rejects.toThrow('oops');
    expect(debugLogger.error).toHaveBeenCalledWith('Request failed', expect.any(Object));
  });

  it('uses deduplicator when provided', async () => {
    const deduplicator = {
      deduplicate: jest.fn().mockImplementation((_key: string, fn: () => Promise<unknown>) => fn()),
    };
    const config = makeConfig({
      deduplicator: deduplicator as unknown as Parameters<typeof QueryOrchestrator>[0]['deduplicator'],
    });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(deduplicator.deduplicate).toHaveBeenCalled();
  });

  it('records success metrics', async () => {
    const metrics = { record: jest.fn() };
    const config = makeConfig({
      metricsCollector: metrics as unknown as Parameters<typeof QueryOrchestrator>[0]['metricsCollector'],
    });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(metrics.record).toHaveBeenCalledWith(expect.objectContaining({ success: true, type: 'domain' }));
  });

  it('uses rateLimiter when provided', async () => {
    const rateLimiter = { checkLimit: jest.fn().mockResolvedValue(undefined) };
    const config = makeConfig({
      rateLimiter: rateLimiter as unknown as Parameters<typeof QueryOrchestrator>[0]['rateLimiter'],
    });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(rateLimiter.checkLimit).toHaveBeenCalled();
  });

  it('uses logger when provided', async () => {
    const logger = {
      logRequest: jest.fn(),
      logResponse: jest.fn(),
      logCache: jest.fn(),
      debug: jest.fn(),
    };
    const config = makeConfig({ logger: logger as unknown as Parameters<typeof QueryOrchestrator>[0]['logger'] });
    const orch = new QueryOrchestrator(config);
    await orch.queryDomain('example.com');
    expect(logger.logRequest).toHaveBeenCalledWith('domain', 'example.com');
  });
});

// ── IP ────────────────────────────────────────────────────────────────────────

describe('QueryOrchestrator — queryIP()', () => {
  it('returns cached IPv4 result on cache hit', async () => {
    const cached = { objectClass: 'ip network', query: '8.8.8.8', metadata: {} };
    const config = makeConfig({ cache: makeCache(cached) });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryIP('8.8.8.8');
    expect(result).toBe(cached);
    expect(config.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('returns cached IPv6 result on cache hit', async () => {
    const cached = { objectClass: 'ip network', query: '2001:db8::1', metadata: {} };
    const config = makeConfig({ cache: makeCache(cached) });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryIP('2001:db8::1');
    expect(result).toBe(cached);
    expect(config.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('fetches for IPv4 on cache miss', async () => {
    const config = makeConfig({ normalizer: makeNormalizer('ip network') });
    const orch = new QueryOrchestrator(config);
    await orch.queryIP('1.1.1.1');
    expect(config.bootstrap.discoverIPv4).toHaveBeenCalled();
    expect(config.fetchWithRetry).toHaveBeenCalled();
  });

  it('fetches for IPv6 on cache miss', async () => {
    const config = makeConfig({ normalizer: makeNormalizer('ip network') });
    const orch = new QueryOrchestrator(config);
    await orch.queryIP('2001:db8::1');
    expect(config.bootstrap.discoverIPv6).toHaveBeenCalled();
  });

  it('throws QueryAbortedError when beforeQuery aborts', async () => {
    const config = makeConfig({ middleware: makeMiddleware(true) });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryIP('1.2.3.4')).rejects.toBeInstanceOf(QueryAbortedError);
  });

  it('logs debug messages when debugEnabled', async () => {
    const debugLogger = makeDebugLogger();
    const config = makeConfig({
      normalizer: makeNormalizer('ip network'),
      debugEnabled: true,
      debugLogger,
    });
    const orch = new QueryOrchestrator(config);
    await orch.queryIP('1.1.1.1');
    expect(debugLogger.debug).toHaveBeenCalledWith('Cache miss', expect.any(Object));
  });

  it('logs debug cache-hit when debugEnabled', async () => {
    const cached = { objectClass: 'ip network', query: '1.1.1.1', metadata: {} };
    const debugLogger = makeDebugLogger();
    const config = makeConfig({ cache: makeCache(cached), debugEnabled: true, debugLogger });
    const orch = new QueryOrchestrator(config);
    await orch.queryIP('1.1.1.1');
    expect(debugLogger.debug).toHaveBeenCalledWith('Cache hit', expect.any(Object));
  });

  it('records failure metrics and runs error hook on fetch error', async () => {
    const metrics = { record: jest.fn() };
    const middleware = makeMiddleware();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('timeout')),
      metricsCollector: metrics as unknown as Parameters<typeof QueryOrchestrator>[0]['metricsCollector'],
      middleware,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryIP('1.2.3.4')).rejects.toThrow('timeout');
    expect(metrics.record).toHaveBeenCalledWith(expect.objectContaining({ success: false, type: 'ip' }));
    expect(middleware.runOnError).toHaveBeenCalled();
  });

  it('logs debug error when debugEnabled and fetch fails', async () => {
    const debugLogger = makeDebugLogger();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('fail')),
      debugEnabled: true,
      debugLogger,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryIP('1.2.3.4')).rejects.toThrow('fail');
    expect(debugLogger.error).toHaveBeenCalledWith('Request failed', expect.any(Object));
  });
});

// ── ASN ───────────────────────────────────────────────────────────────────────

describe('QueryOrchestrator — queryASN()', () => {
  it('returns cached ASN result on cache hit', async () => {
    const cached = { objectClass: 'autnum', query: 'AS15169', metadata: {} };
    const config = makeConfig({ cache: makeCache(cached) });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryASN('AS15169');
    expect(result).toBe(cached);
    expect(config.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('fetches on cache miss with string ASN', async () => {
    const config = makeConfig({ normalizer: makeNormalizer('autnum') });
    const orch = new QueryOrchestrator(config);
    await orch.queryASN('AS15169');
    expect(config.bootstrap.discoverASN).toHaveBeenCalled();
    expect(config.fetchWithRetry).toHaveBeenCalled();
  });

  it('accepts numeric ASN', async () => {
    const config = makeConfig({ normalizer: makeNormalizer('autnum') });
    const orch = new QueryOrchestrator(config);
    await orch.queryASN(15169);
    expect(config.fetchWithRetry).toHaveBeenCalled();
  });

  it('throws QueryAbortedError when beforeQuery aborts', async () => {
    const config = makeConfig({ middleware: makeMiddleware(true) });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryASN('AS15169')).rejects.toBeInstanceOf(QueryAbortedError);
  });

  it('logs debug messages when debugEnabled', async () => {
    const debugLogger = makeDebugLogger();
    const config = makeConfig({
      normalizer: makeNormalizer('autnum'),
      debugEnabled: true,
      debugLogger,
    });
    const orch = new QueryOrchestrator(config);
    await orch.queryASN('AS15169');
    expect(debugLogger.debug).toHaveBeenCalledWith('Cache miss', expect.any(Object));
    expect(debugLogger.debug).toHaveBeenCalledWith('RDAP server discovered', expect.any(Object));
    expect(debugLogger.debug).toHaveBeenCalledWith('Request completed', expect.any(Object));
  });

  it('logs debug cache-hit when debugEnabled', async () => {
    const cached = { objectClass: 'autnum', query: 'AS15169', metadata: {} };
    const debugLogger = makeDebugLogger();
    const config = makeConfig({ cache: makeCache(cached), debugEnabled: true, debugLogger });
    const orch = new QueryOrchestrator(config);
    await orch.queryASN('AS15169');
    expect(debugLogger.debug).toHaveBeenCalledWith('Cache hit', expect.any(Object));
  });

  it('records failure metrics on fetch error', async () => {
    const metrics = { record: jest.fn() };
    const middleware = makeMiddleware();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('boom')),
      metricsCollector: metrics as unknown as Parameters<typeof QueryOrchestrator>[0]['metricsCollector'],
      middleware,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryASN('AS15169')).rejects.toThrow('boom');
    expect(metrics.record).toHaveBeenCalledWith(expect.objectContaining({ success: false, type: 'asn' }));
    expect(middleware.runOnError).toHaveBeenCalled();
  });

  it('logs debug error when debugEnabled and fetch fails', async () => {
    const debugLogger = makeDebugLogger();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('err')),
      debugEnabled: true,
      debugLogger,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryASN('AS15169')).rejects.toThrow('err');
    expect(debugLogger.error).toHaveBeenCalled();
  });
});

// ── Nameserver ────────────────────────────────────────────────────────────────

describe('QueryOrchestrator — queryNameserver()', () => {
  it('returns cached nameserver result on cache hit', async () => {
    const cached = { objectClass: 'nameserver', query: 'ns1.example.com', metadata: {} };
    const config = makeConfig({ cache: makeCache(cached) });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryNameserver('ns1.example.com');
    expect(result).toBe(cached);
    expect(config.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('fetches on cache miss', async () => {
    const config = makeConfig({ normalizer: makeNormalizer('nameserver') });
    const orch = new QueryOrchestrator(config);
    await orch.queryNameserver('ns1.example.com');
    expect(config.bootstrap.discoverNameserver).toHaveBeenCalled();
    expect(config.fetchWithRetry).toHaveBeenCalled();
  });

  it('throws QueryAbortedError when beforeQuery aborts', async () => {
    const config = makeConfig({ middleware: makeMiddleware(true) });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryNameserver('ns1.example.com')).rejects.toBeInstanceOf(QueryAbortedError);
  });

  it('records failure metrics on fetch error', async () => {
    const metrics = { record: jest.fn() };
    const middleware = makeMiddleware();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('ns-err')),
      metricsCollector: metrics as unknown as Parameters<typeof QueryOrchestrator>[0]['metricsCollector'],
      middleware,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryNameserver('ns1.example.com')).rejects.toThrow('ns-err');
    expect(metrics.record).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, type: 'nameserver' })
    );
    expect(middleware.runOnError).toHaveBeenCalled();
  });
});

// ── Entity ────────────────────────────────────────────────────────────────────

describe('QueryOrchestrator — queryEntity()', () => {
  const SERVER = 'https://rdap.arin.net/registry';

  it('returns cached entity result on cache hit', async () => {
    const cached = { objectClass: 'entity', query: 'GOGL', metadata: {} };
    const config = makeConfig({ cache: makeCache(cached) });
    const orch = new QueryOrchestrator(config);
    const result = await orch.queryEntity('GOGL', SERVER);
    expect(result).toBe(cached);
    expect(config.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('fetches on cache miss', async () => {
    const config = makeConfig({ normalizer: makeNormalizer('entity') });
    const orch = new QueryOrchestrator(config);
    await orch.queryEntity('GOGL', SERVER);
    expect(config.fetchWithRetry).toHaveBeenCalledWith(expect.stringContaining('/entity/GOGL'));
  });

  it('throws QueryAbortedError when beforeQuery aborts', async () => {
    const config = makeConfig({ middleware: makeMiddleware(true) });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryEntity('GOGL', SERVER)).rejects.toBeInstanceOf(QueryAbortedError);
  });

  it('records failure metrics on fetch error', async () => {
    const metrics = { record: jest.fn() };
    const middleware = makeMiddleware();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue(new Error('entity-err')),
      metricsCollector: metrics as unknown as Parameters<typeof QueryOrchestrator>[0]['metricsCollector'],
      middleware,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryEntity('GOGL', SERVER)).rejects.toThrow('entity-err');
    expect(metrics.record).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, type: 'entity' })
    );
    expect(middleware.runOnError).toHaveBeenCalled();
  });

  it('uses deduplicator for entity', async () => {
    const deduplicator = {
      deduplicate: jest.fn().mockImplementation((_k: string, fn: () => Promise<unknown>) => fn()),
    };
    const config = makeConfig({
      normalizer: makeNormalizer('entity'),
      deduplicator: deduplicator as unknown as Parameters<typeof QueryOrchestrator>[0]['deduplicator'],
    });
    const orch = new QueryOrchestrator(config);
    await orch.queryEntity('GOGL', SERVER);
    expect(deduplicator.deduplicate).toHaveBeenCalled();
  });
});

// ── Non-Error rethrow ─────────────────────────────────────────────────────────

describe('QueryOrchestrator — non-Error rethrow', () => {
  it('wraps non-Error thrown object for onError hook', async () => {
    const middleware = makeMiddleware();
    const config = makeConfig({
      fetchWithRetry: jest.fn().mockRejectedValue('string-error'),
      middleware,
    });
    const orch = new QueryOrchestrator(config);
    await expect(orch.queryDomain('example.com')).rejects.toBe('string-error');
    expect(middleware.runOnError).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
