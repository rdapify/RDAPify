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
