/**
 * Tests for AuditLogger, InMemoryAuditAdapter, and FileAuditAdapter
 */

// Must be declared before any imports so Jest hoists it
jest.mock('fs/promises', () => ({
  appendFile: jest.fn().mockResolvedValue(undefined),
}));

import {
  AuditLogger,
  InMemoryAuditAdapter,
  FileAuditAdapter,
} from '../../src/infrastructure/logging/AuditLogger';
import type { AuditEvent, AuditEventType, AuditLogAdapter } from '../../src/infrastructure/logging/AuditLogger';
import * as fsMod from 'fs/promises';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(): InMemoryAuditAdapter {
  return new InMemoryAuditAdapter({ maxEvents: 100, retentionHours: 1 });
}

function makeLogger(
  adapter: InMemoryAuditAdapter,
  overrides?: ConstructorParameters<typeof AuditLogger>[0]
): AuditLogger {
  return new AuditLogger({ enabled: true, adapter, ...overrides });
}

// ---------------------------------------------------------------------------
// AuditLogger — enabled / disabled
// ---------------------------------------------------------------------------

describe('AuditLogger', () => {
  describe('enabled/disabled', () => {
    it('should be enabled by default', () => {
      const adapter = makeAdapter();
      const logger = new AuditLogger({ adapter });
      expect(logger.isEnabled()).toBe(true);
    });

    it('should respect the enabled:false option', () => {
      const adapter = makeAdapter();
      const logger = new AuditLogger({ enabled: false, adapter });
      expect(logger.isEnabled()).toBe(false);
    });

    it('should not write events when disabled', () => {
      const adapter = makeAdapter();
      const logger = new AuditLogger({ enabled: false, adapter });
      logger.logQueryStart({ queryType: 'domain', query: 'example.com' });
      expect(adapter.size()).toBe(0);
    });

    it('should write events when enabled', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQueryStart({ queryType: 'domain', query: 'example.com' });
      expect(adapter.size()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // logQueryStart
  // -------------------------------------------------------------------------

  describe('logQueryStart', () => {
    it('should emit a QUERY_START event', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQueryStart({ queryType: 'domain', query: 'example.com' });

      const events = adapter.getEvents();
      expect(events).toHaveLength(1);
      const event = events[0] as AuditEvent;
      expect(event.eventType).toBe('QUERY_START');
      expect(event.queryType).toBe('domain');
      expect(event.query).toBe('example.com');
      expect(event.success).toBe(false);
      expect(event.durationMs).toBe(0);
      expect(event.cached).toBe(false);
    });

    it('should include sessionId and clientId when provided', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQueryStart({
        queryType: 'ip',
        query: '1.2.3.4',
        sessionId: 'sess-abc',
        clientId: 'client-xyz',
      });
      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.sessionId).toBe('sess-abc');
      expect(event.clientId).toBe('client-xyz');
    });

    it('should fall back to logger-level sessionId when not provided on call', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter, { sessionId: 'global-session' });
      logger.logQueryStart({ queryType: 'asn', query: 'AS15169' });
      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.sessionId).toBe('global-session');
    });
  });

  // -------------------------------------------------------------------------
  // logQuerySuccess
  // -------------------------------------------------------------------------

  describe('logQuerySuccess', () => {
    it('should emit a QUERY_SUCCESS event', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQuerySuccess({
        queryType: 'domain',
        query: 'example.com',
        normalizedQuery: 'example.com',
        durationMs: 123,
        cached: false,
        serverUrl: 'https://rdap.verisign.com',
      });

      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.eventType).toBe('QUERY_SUCCESS');
      expect(event.success).toBe(true);
      expect(event.durationMs).toBe(123);
      expect(event.cached).toBe(false);
      expect(event.normalizedQuery).toBe('example.com');
      expect(event.serverUrl).toBe('https://rdap.verisign.com');
    });

    it('should not include responseSize when includeResponseSize is false (default)', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQuerySuccess({
        queryType: 'domain',
        query: 'example.com',
        normalizedQuery: 'example.com',
        durationMs: 50,
        cached: true,
        responseSize: 4096,
      });
      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.responseSize).toBeUndefined();
    });

    it('should include responseSize when includeResponseSize is true', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter, { includeResponseSize: true });
      logger.logQuerySuccess({
        queryType: 'domain',
        query: 'example.com',
        normalizedQuery: 'example.com',
        durationMs: 50,
        cached: false,
        responseSize: 2048,
      });
      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.responseSize).toBe(2048);
    });
  });

  // -------------------------------------------------------------------------
  // logQueryFailure
  // -------------------------------------------------------------------------

  describe('logQueryFailure', () => {
    it('should emit a QUERY_FAILURE event with error details', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQueryFailure({
        queryType: 'domain',
        query: 'bad-domain.invalid',
        durationMs: 200,
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Connection refused',
      });

      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.eventType).toBe('QUERY_FAILURE');
      expect(event.success).toBe(false);
      expect(event.durationMs).toBe(200);
      expect(event.errorCode).toBe('NETWORK_ERROR');
      expect(event.errorMessage).toBe('Connection refused');
      expect(event.cached).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // logSSRFBlocked
  // -------------------------------------------------------------------------

  describe('logSSRFBlocked', () => {
    it('should emit an SSRF_BLOCKED event', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logSSRFBlocked({ url: 'http://169.254.169.254/metadata' });

      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.eventType).toBe('SSRF_BLOCKED');
      expect(event.query).toBe('http://169.254.169.254/metadata');
      expect(event.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // logRateLimitExceeded
  // -------------------------------------------------------------------------

  describe('logRateLimitExceeded', () => {
    it('should emit a RATE_LIMIT_EXCEEDED event', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logRateLimitExceeded({ queryType: 'domain', query: 'example.com' });

      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.eventType).toBe('RATE_LIMIT_EXCEEDED');
      expect(event.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // logPIIRedacted
  // -------------------------------------------------------------------------

  describe('logPIIRedacted', () => {
    it('should emit a PII_REDACTED event with fieldsRedacted in tags', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logPIIRedacted({ queryType: 'domain', query: 'example.com', fieldsRedacted: 3 });

      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.eventType).toBe('PII_REDACTED');
      expect(event.tags?.['fieldsRedacted']).toBe('3');
    });
  });

  // -------------------------------------------------------------------------
  // Event ID uniqueness and timestamp format
  // -------------------------------------------------------------------------

  describe('event metadata', () => {
    it('should generate unique IDs for each event', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      for (let i = 0; i < 20; i++) {
        logger.logQueryStart({ queryType: 'domain', query: `domain-${i}.com` });
      }
      const events = adapter.getEvents();
      const ids = events.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });

    it('should produce ISO 8601 timestamps', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQueryStart({ queryType: 'domain', query: 'example.com' });

      const event = adapter.getEvents()[0] as AuditEvent;
      // ISO 8601 basic pattern: YYYY-MM-DDTHH:mm:ss.sssZ or offset
      expect(event.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
      );
    });

    it('should merge static tags from logger options into every event', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter, { tags: { env: 'test', service: 'rdap' } });
      logger.logQueryStart({ queryType: 'domain', query: 'example.com' });

      const event = adapter.getEvents()[0] as AuditEvent;
      expect(event.tags?.['env']).toBe('test');
      expect(event.tags?.['service']).toBe('rdap');
    });
  });

  // -------------------------------------------------------------------------
  // getStats
  // -------------------------------------------------------------------------

  describe('getStats', () => {
    it('should return correct eventsLogged count', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      logger.logQueryStart({ queryType: 'domain', query: 'a.com' });
      logger.logQueryStart({ queryType: 'ip', query: '1.1.1.1' });
      expect(logger.getStats().eventsLogged).toBe(2);
    });

    it('should report enabled status', () => {
      const adapter = makeAdapter();
      const logger = makeLogger(adapter);
      expect(logger.getStats().enabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // flush
  // -------------------------------------------------------------------------

  describe('flush', () => {
    it('should resolve without error when adapter has no flush', async () => {
      const noFlushAdapter: import('../../src/infrastructure/logging/AuditLogger').AuditLogAdapter =
        { write: () => undefined };
      const logger = new AuditLogger({ adapter: noFlushAdapter });
      await expect(logger.flush()).resolves.toBeUndefined();
    });

    it('should call adapter flush when flush method exists on adapter', async () => {
      let flushed = false;
      const flushableAdapter: import('../../src/infrastructure/logging/AuditLogger').AuditLogAdapter =
        {
          write: () => undefined,
          flush: async () => {
            flushed = true;
          },
        };
      const logger = new AuditLogger({ adapter: flushableAdapter });
      await logger.flush();
      expect(flushed).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// InMemoryAuditAdapter
// ---------------------------------------------------------------------------

describe('InMemoryAuditAdapter', () => {
  function makeEvent(overrides?: Partial<AuditEvent>): AuditEvent {
    return {
      id: 'test-id',
      timestamp: new Date().toISOString(),
      eventType: 'QUERY_SUCCESS',
      queryType: 'domain',
      query: 'example.com',
      success: true,
      durationMs: 100,
      cached: false,
      ...overrides,
    };
  }

  it('should store written events', () => {
    const adapter = new InMemoryAuditAdapter();
    adapter.write(makeEvent({ id: 'e1' }));
    adapter.write(makeEvent({ id: 'e2' }));
    expect(adapter.size()).toBe(2);
  });

  it('should clear all events', () => {
    const adapter = new InMemoryAuditAdapter();
    adapter.write(makeEvent());
    adapter.clear();
    expect(adapter.size()).toBe(0);
  });

  it('getEvents() should return all events when no filter', () => {
    const adapter = new InMemoryAuditAdapter();
    adapter.write(makeEvent({ id: 'a' }));
    adapter.write(makeEvent({ id: 'b' }));
    expect(adapter.getEvents()).toHaveLength(2);
  });

  it('getEvents(since) should filter by ISO timestamp', () => {
    const adapter = new InMemoryAuditAdapter();
    const pastTs = new Date(Date.now() - 5000).toISOString();
    const recentTs = new Date(Date.now() + 1000).toISOString();

    adapter.write(makeEvent({ id: 'old', timestamp: pastTs }));
    adapter.write(makeEvent({ id: 'new', timestamp: recentTs }));

    // Only events at or after recentTs
    const filtered = adapter.getEvents(recentTs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('new');
  });

  it('getEventsByType() should filter by event type', () => {
    const adapter = new InMemoryAuditAdapter();
    adapter.write(makeEvent({ id: '1', eventType: 'QUERY_SUCCESS' }));
    adapter.write(makeEvent({ id: '2', eventType: 'CACHE_HIT' }));
    adapter.write(makeEvent({ id: '3', eventType: 'QUERY_SUCCESS' }));

    const successes = adapter.getEventsByType('QUERY_SUCCESS');
    expect(successes).toHaveLength(2);

    const cacheHits = adapter.getEventsByType('CACHE_HIT');
    expect(cacheHits).toHaveLength(1);
  });

  it('should cap events at maxEvents limit', () => {
    const adapter = new InMemoryAuditAdapter({ maxEvents: 5 });
    for (let i = 0; i < 10; i++) {
      adapter.write(makeEvent({ id: `e${i}` }));
    }
    expect(adapter.size()).toBe(5);
  });

  it('should return event type counts correctly', () => {
    const adapter = new InMemoryAuditAdapter();
    const types: AuditEventType[] = [
      'QUERY_START',
      'QUERY_SUCCESS',
      'QUERY_FAILURE',
      'CACHE_HIT',
      'CACHE_MISS',
      'RATE_LIMIT_EXCEEDED',
      'SSRF_BLOCKED',
      'PII_REDACTED',
    ];
    types.forEach((t, i) => adapter.write(makeEvent({ id: `e${i}`, eventType: t })));

    types.forEach((t) => {
      expect(adapter.getEventsByType(t)).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// FileAuditAdapter
// ---------------------------------------------------------------------------

describe('FileAuditAdapter', () => {
  const mockAppendFile = fsMod.appendFile as jest.MockedFunction<typeof fsMod.appendFile>;

  beforeEach(() => {
    mockAppendFile.mockClear();
    mockAppendFile.mockResolvedValue(undefined);
  });

  it('should call fs.appendFile with the correct file path and NDJSON line', async () => {
    const adapter = new FileAuditAdapter('/tmp/test-audit.log');
    const event: AuditEvent = {
      id: 'file-test-id',
      timestamp: '2026-03-17T00:00:00.000Z',
      eventType: 'QUERY_SUCCESS',
      queryType: 'domain',
      query: 'example.com',
      success: true,
      durationMs: 50,
      cached: false,
    };

    await adapter.write(event);

    expect(mockAppendFile).toHaveBeenCalledWith(
      '/tmp/test-audit.log',
      JSON.stringify(event) + '\n',
      'utf8'
    );
  });

  it('should produce valid NDJSON (JSON + newline)', async () => {
    const written: string[] = [];
    mockAppendFile.mockImplementation((_path, data) => {
      written.push(data as string);
      return Promise.resolve();
    });

    const adapter = new FileAuditAdapter('/tmp/audit2.log');
    const event: AuditEvent = {
      id: 'ndjson-test',
      timestamp: '2026-03-17T00:00:00.000Z',
      eventType: 'CACHE_HIT',
      queryType: 'ip',
      query: '8.8.8.8',
      success: true,
      durationMs: 0,
      cached: true,
    };

    await adapter.write(event);

    expect(written).toHaveLength(1);
    const line = written[0] as string;
    expect(line.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(line.trim()) as AuditEvent;
    expect(parsed.id).toBe('ndjson-test');
    expect(parsed.eventType).toBe('CACHE_HIT');
  });

  it('flush() should resolve without error', async () => {
    const adapter = new FileAuditAdapter('/tmp/audit-flush.log');
    await expect(adapter.flush()).resolves.toBeUndefined();
  });
});

describe('AuditLogger — logCacheHit()', () => {
  it('logs a CACHE_HIT event via logCacheHit()', () => {
    const written: AuditEvent[] = [];
    const mockAdapter: AuditLogAdapter = {
      write: jest.fn().mockImplementation(async (e: AuditEvent) => { written.push(e); }),
      flush: jest.fn().mockResolvedValue(undefined),
    };

    const logger = new AuditLogger({ adapter: mockAdapter });
    logger.logCacheHit({ queryType: 'domain', query: 'example.com' });

    expect(mockAdapter.write).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'CACHE_HIT', queryType: 'domain', query: 'example.com' })
    );
  });
});
