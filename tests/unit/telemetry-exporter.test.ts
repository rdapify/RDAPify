/**
 * Unit tests for TelemetryExporter
 */

import { TelemetryExporter } from '../../src/infrastructure/monitoring/TelemetryExporter';

describe('TelemetryExporter', () => {
  it('is disabled when no endpoint is provided', () => {
    const exporter = new TelemetryExporter({});
    expect(exporter.isEnabled()).toBe(false);
  });

  it('is disabled when enabled: false, even with endpoint', () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces', enabled: false });
    expect(exporter.isEnabled()).toBe(false);
  });

  it('is enabled when endpoint is provided and enabled is not false', () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    expect(exporter.isEnabled()).toBe(true);
  });

  it('startSpan() returns a span with traceId, spanId, and name', () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const span = exporter.startSpan('rdap.domain');

    expect(span.name).toBe('rdap.domain');
    expect(typeof span.traceId).toBe('string');
    expect(span.traceId).toHaveLength(32); // 16 bytes → 32 hex chars
    expect(typeof span.spanId).toBe('string');
    expect(span.spanId).toHaveLength(16); // 8 bytes → 16 hex chars
    expect(span.startTimeUnixNano).toBeTruthy();
    expect(span.endTimeUnixNano).toBe('0');
  });

  it('startSpan() encodes attributes', () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const span = exporter.startSpan('test', { domain: 'example.com', cached: true, duration: 150 });

    const domainAttr = span.attributes?.find(a => a.key === 'domain');
    expect(domainAttr?.value.stringValue).toBe('example.com');

    const cachedAttr = span.attributes?.find(a => a.key === 'cached');
    expect(cachedAttr?.value.boolValue).toBe(true);

    const durationAttr = span.attributes?.find(a => a.key === 'duration');
    expect(durationAttr?.value.intValue).toBe(150);
  });

  it('startSpan() accepts parentSpanId', () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const span = exporter.startSpan('child', {}, 'deadbeef12345678');
    expect(span.parentSpanId).toBe('deadbeef12345678');
  });

  it('exportSpans() does nothing when disabled', async () => {
    const exporter = new TelemetryExporter({});
    // Should not throw even without fetch
    await expect(exporter.exportSpans([])).resolves.toBeUndefined();
  });

  it('exportSpans() silently swallows fetch errors', async () => {
    // Mock globalThis.fetch to throw
    const origFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('connection refused')) as typeof fetch;

    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const span = exporter.startSpan('test');

    await expect(exporter.exportSpans([span])).resolves.toBeUndefined();

    globalThis.fetch = origFetch;
  });

  it('endSpan() sets endTimeUnixNano and status', async () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    // Mock exportSpans to capture what's sent
    const exportSpy = jest.spyOn(exporter, 'exportSpans').mockResolvedValue();

    const span = exporter.startSpan('test');
    expect(span.endTimeUnixNano).toBe('0');

    await exporter.endSpan(span, { code: 0 });

    expect(span.endTimeUnixNano).not.toBe('0');
    expect(span.status?.code).toBe(0);
    expect(exportSpy).toHaveBeenCalledWith([span]);

    exportSpy.mockRestore();
  });

  it('each span gets a unique traceId and spanId', () => {
    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const spans = Array.from({ length: 10 }, () => exporter.startSpan('test'));
    const traceIds = new Set(spans.map(s => s.traceId));
    const spanIds = new Set(spans.map(s => s.spanId));
    // All should be unique (probability of collision with random hex is negligible)
    expect(traceIds.size).toBe(10);
    expect(spanIds.size).toBe(10);
  });

  it('resolves silently when fetch is not available (sendRequest error is swallowed)', async () => {
    // exportSpans catches errors internally so the promise resolves even if sendRequest throws
    const origFetch = globalThis.fetch;
    delete (globalThis as Record<string, unknown>)['fetch'];

    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const span = exporter.startSpan('test');
    // exportSpans must NOT reject — errors from sendRequest are intentionally silenced
    await expect(exporter.exportSpans([span])).resolves.toBeUndefined();

    globalThis.fetch = origFetch;
  });

  it('resolves silently when server returns non-ok response (sendRequest error swallowed)', async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch;

    const exporter = new TelemetryExporter({ endpoint: 'http://localhost:4318/v1/traces' });
    const span = exporter.startSpan('test');
    // Error is caught inside exportSpans — it resolves
    await expect(exporter.exportSpans([span])).resolves.toBeUndefined();

    globalThis.fetch = origFetch;
  });
});
