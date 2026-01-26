/**
 * Tests for MetricsCollector
 */

import { MetricsCollector } from '../../src/infrastructure/monitoring/MetricsCollector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      enabled: true,
      maxMetrics: 100,
    });
  });

  afterEach(() => {
    collector.clear();
  });

  describe('record', () => {
    it('should record a successful query', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 150,
        cached: false,
        timestamp: Date.now(),
      });

      const summary = collector.getSummary();
      expect(summary.total).toBe(1);
      expect(summary.successful).toBe(1);
      expect(summary.failed).toBe(0);
    });

    it('should record a failed query', () => {
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
      expect(summary.successful).toBe(0);
      expect(summary.failed).toBe(1);
    });

    it('should track cache hits', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 10,
        cached: true,
        timestamp: Date.now(),
      });

      const summary = collector.getSummary();
      expect(summary.cacheHitRate).toBeGreaterThan(99);
    });

    it('should track cache misses', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 150,
        cached: false,
        timestamp: Date.now(),
      });

      const summary = collector.getSummary();
      expect(summary.cacheHitRate).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should calculate average duration', () => {
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
        query: 'test.com',
        success: true,
        duration: 200,
        cached: false,
        timestamp: Date.now(),
      });

      const summary = collector.getSummary();
      expect(summary.avgResponseTime).toBe(150);
    });

    it('should track queries by type', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
      });

      collector.record({
        type: 'ip',
        query: '8.8.8.8',
        success: true,
        duration: 120,
        cached: false,
        timestamp: Date.now(),
      });

      const summary = collector.getSummary();
      expect(summary.queriesByType.domain).toBe(1);
      expect(summary.queriesByType.ip).toBe(1);
      expect(summary.queriesByType.asn).toBe(0);
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      collector.record({
        type: 'domain',
        query: 'old.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: oneHourAgo,
      });

      collector.record({
        type: 'domain',
        query: 'new.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: now,
      });

      const summary = collector.getSummary(now - 1800000); // Last 30 minutes
      expect(summary.total).toBe(1);
    });
  });

  describe('getRecent', () => {
    it('should return recent metrics', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
      });

      const metrics = collector.getRecent(10);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].query).toBe('example.com');
    });

    it('should limit returned metrics', () => {
      for (let i = 0; i < 10; i++) {
        collector.record({
          type: 'domain',
          query: `example${i}.com`,
          success: true,
          duration: 100,
          cached: false,
          timestamp: Date.now(),
        });
      }

      const metrics = collector.getRecent(5);
      expect(metrics).toHaveLength(5);
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
      });

      collector.clear();

      const summary = collector.getSummary();
      expect(summary.total).toBe(0);
    });
  });

  describe('export', () => {
    it('should export metrics as JSON', () => {
      collector.record({
        type: 'domain',
        query: 'example.com',
        success: true,
        duration: 100,
        cached: false,
        timestamp: Date.now(),
      });

      const exported = collector.export();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported).toHaveLength(1);
      expect(exported[0].query).toBe('example.com');
    });
  });
});
