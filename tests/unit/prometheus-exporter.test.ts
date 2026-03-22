/**
 * Unit tests for PrometheusExporter
 */

import { PrometheusExporter } from '../../src/infrastructure/monitoring/PrometheusExporter';
import type { MetricsSummary } from '../../src/infrastructure/monitoring/MetricsCollector';

function makeSummary(overrides: Partial<MetricsSummary> = {}): MetricsSummary {
  return {
    total: 100,
    successful: 95,
    failed: 5,
    successRate: 0.95,
    avgResponseTime: 250,
    minResponseTime: 50,
    maxResponseTime: 1200,
    p50ResponseTime: 220,
    p90ResponseTime: 500,
    p99ResponseTime: 1100,
    cacheHitRate: 0.65,
    totalDuration: 25000,
    queriesByType: { domain: 80, ip: 15, asn: 5 },
    errorsByType: { NetworkError: 3, TimeoutError: 2 },
    ...overrides,
  };
}

describe('PrometheusExporter', () => {
  it('exports Prometheus text format with correct content type', () => {
    expect(PrometheusExporter.CONTENT_TYPE).toContain('text/plain');
    expect(PrometheusExporter.CONTENT_TYPE).toContain('0.0.4');
  });

  it('includes # HELP and # TYPE for each metric', () => {
    const exporter = new PrometheusExporter(() => makeSummary());
    const output = exporter.export();

    expect(output).toContain('# HELP rdapify_queries');
    expect(output).toContain('# TYPE rdapify_queries counter');
    expect(output).toContain('# HELP rdapify_success_rate');
    expect(output).toContain('# TYPE rdapify_success_rate gauge');
  });

  it('outputs correct metric values', () => {
    const exporter = new PrometheusExporter(() => makeSummary());
    const output = exporter.export();

    expect(output).toContain('rdapify_queries_total 100');
    expect(output).toContain('rdapify_queries_successful_total 95');
    expect(output).toContain('rdapify_queries_failed_total 5');
    expect(output).toContain('rdapify_success_rate 0.95');
    expect(output).toContain('rdapify_cache_hit_rate 0.65');
    expect(output).toContain('rdapify_response_time_avg_ms 250');
    expect(output).toContain('rdapify_response_time_p50_ms 220');
    expect(output).toContain('rdapify_response_time_p99_ms 1100');
  });

  it('includes per-type query counters with type label', () => {
    const exporter = new PrometheusExporter(() => makeSummary());
    const output = exporter.export();

    expect(output).toContain('type="domain"');
    expect(output).toContain('type="ip"');
    expect(output).toContain('type="asn"');
  });

  it('includes error type breakdown', () => {
    const exporter = new PrometheusExporter(() => makeSummary());
    const output = exporter.export();

    expect(output).toContain('error_type="NetworkError"');
    expect(output).toContain('error_type="TimeoutError"');
  });

  it('omits error section when no errors', () => {
    const exporter = new PrometheusExporter(() => makeSummary({ errorsByType: {} }));
    const output = exporter.export();

    expect(output).not.toContain('errors_by_type');
  });

  it('applies custom prefix', () => {
    const exporter = new PrometheusExporter(() => makeSummary(), { prefix: 'myapp_rdap' });
    const output = exporter.export();

    expect(output).toContain('myapp_rdap_queries_total');
    expect(output).not.toContain('rdapify_queries_total');
  });

  it('attaches constant labels to metrics', () => {
    const exporter = new PrometheusExporter(() => makeSummary(), { labels: { instance: 'server1', env: 'prod' } });
    const output = exporter.export();

    expect(output).toContain('instance="server1"');
    expect(output).toContain('env="prod"');
  });

  it('ends with a trailing newline', () => {
    const exporter = new PrometheusExporter(() => makeSummary());
    expect(exporter.export()).toMatch(/\n$/);
  });

  it('createHttpHandler() sets Content-Type and calls res.end()', () => {
    const exporter = new PrometheusExporter(() => makeSummary());
    const handler = exporter.createHttpHandler();

    const res = { setHeader: jest.fn(), end: jest.fn() };
    handler({}, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', PrometheusExporter.CONTENT_TYPE);
    expect(res.end).toHaveBeenCalledWith(exporter.export());
  });
});
