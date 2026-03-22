/**
 * Tests for MetricsCollector edge cases
 */

import { MetricsCollector } from '../../src/infrastructure/monitoring/MetricsCollector';

describe('MetricsCollector', () => {
  describe('getSummary edge cases', () => {
    let collector: MetricsCollector;

    beforeEach(() => {
      collector = new MetricsCollector({ enabled: true });
    });

    it('should return zero values for empty metrics', () => {
      const summary = collector.getSummary();
      expect(summary.total).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.avgResponseTime).toBe(0);
      expect(summary.minResponseTime).toBe(0);
      expect(summary.maxResponseTime).toBe(0);
      expect(summary.cacheHitRate).toBe(0);
    });

    it('should handle single metric correctly', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
      });

      const summary = collector.getSummary();
      expect(summary.total).toBe(1);
      expect(summary.successRate).toBe(100);
      expect(summary.avgResponseTime).toBe(100);
      expect(summary.minResponseTime).toBe(100);
      expect(summary.maxResponseTime).toBe(100);
    });

    it('should handle time window filtering', () => {
      const now = Date.now();
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: now - 10000, // 10 seconds ago
      });
      collector.record({
        type: 'domain',
        query: 'example2.com',
        success: true,
        duration: 200,
        cached: false,
        timestamp: now, // Now
      });

      // Filter to only recent metrics (last 5 seconds)
      const summary = collector.getSummary(now - 5000);
      expect(summary.total).toBe(1);
      expect(summary.avgResponseTime).toBe(200);
    });

    it('should handle all failed queries', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: false,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
        error: 'NetworkError',
      });

      const summary = collector.getSummary();
      expect(summary.total).toBe(1);
      expect(summary.successRate).toBe(0);
      expect(summary.failed).toBe(1);
    });

    it('should handle mixed success/failure', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
      });
      collector.record({
        type: 'domain',
        query: 'example2.com',
        success: false,
        duration: 50,
        cached: false,
        timestamp: Date.now(),
        error: 'NetworkError',
      });

      const summary = collector.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.successRate).toBe(50);
      expect(summary.successful).toBe(1);
      expect(summary.failed).toBe(1);
    });
  });

  describe('getStats edge cases', () => {
    it('should handle empty metrics', () => {
      const collector = new MetricsCollector({ enabled: true });
      const stats = collector.getStats();
      expect(stats.totalMetrics).toBe(0);
      expect(stats.oldestMetric).toBeUndefined();
      expect(stats.newestMetric).toBeUndefined();
    });
  });
});

describe('MetricsCollector — additional branch coverage', () => {
  const makeMetric = (type: 'domain' | 'ip' = 'domain', success = true) => ({
    type,
    query: 'x.com',
    success,
    duration: 100,
    cached: false,
    timestamp: Date.now(),
  });

  it('getWindow() returns metrics inside time range', () => {
    const collector = new MetricsCollector({ enabled: true });
    const before = Date.now() - 5000;
    collector.record(makeMetric());
    const after = Date.now() + 5000;

    const inside = collector.getWindow(before, after);
    expect(inside.length).toBeGreaterThan(0);

    const outside = collector.getWindow(after, after + 1000);
    expect(outside).toHaveLength(0);
  });

  it('getByType() filters by query type', () => {
    const collector = new MetricsCollector({ enabled: true });
    collector.record(makeMetric('domain'));
    collector.record(makeMetric('ip'));

    expect(collector.getByType('domain')).toHaveLength(1);
    expect(collector.getByType('ip')).toHaveLength(1);
    expect(collector.getByType('asn')).toHaveLength(0);
  });

  it('getFailures() returns only failed metrics', () => {
    const collector = new MetricsCollector({ enabled: true });
    collector.record(makeMetric('domain', true));
    collector.record(makeMetric('domain', false));

    const failures = collector.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]!.success).toBe(false);
  });

  it('import() loads metrics into collector', () => {
    const collector = new MetricsCollector({ enabled: true });
    const batch = [makeMetric(), makeMetric('ip')];
    collector.import(batch);
    expect(collector.export()).toHaveLength(2);
  });
});
