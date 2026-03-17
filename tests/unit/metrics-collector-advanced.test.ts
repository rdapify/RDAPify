/**
 * Advanced tests for new MetricsCollector enterprise analytics features
 */

import { MetricsCollector, QueryMetric } from '../../src/infrastructure/monitoring/MetricsCollector';

/** Helper to create a basic query metric with overrides */
function makeMetric(overrides: Partial<QueryMetric> = {}): QueryMetric {
  return {
    type: 'domain',
    query: 'example.com',
    success: true,
    duration: 100,
    cached: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('MetricsCollector — advanced analytics', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({ enabled: true, maxMetrics: 10000 });
  });

  afterEach(() => {
    collector.clear();
  });

  // ---------------------------------------------------------------------------
  // getPercentiles
  // ---------------------------------------------------------------------------
  describe('getPercentiles()', () => {
    it('should return all zeros for an empty collector', () => {
      const p = collector.getPercentiles();
      expect(p.p50).toBe(0);
      expect(p.p75).toBe(0);
      expect(p.p90).toBe(0);
      expect(p.p95).toBe(0);
      expect(p.p99).toBe(0);
      expect(p.p999).toBe(0);
    });

    it('should return the single value for all percentiles when there is one metric', () => {
      collector.record(makeMetric({ duration: 200 }));
      const p = collector.getPercentiles();
      expect(p.p50).toBe(200);
      expect(p.p90).toBe(200);
      expect(p.p99).toBe(200);
      expect(p.p999).toBe(200);
    });

    it('should compute correct median for an odd number of values', () => {
      // Sorted: 100, 200, 300 — median = 200
      [100, 300, 200].forEach((duration) => collector.record(makeMetric({ duration })));
      const p = collector.getPercentiles();
      expect(p.p50).toBe(200);
    });

    it('should compute correct median for an even number of values', () => {
      // Sorted: 100, 200, 300, 400 — p50 via linear interpolation = 250
      [100, 200, 300, 400].forEach((duration) => collector.record(makeMetric({ duration })));
      const p = collector.getPercentiles();
      expect(p.p50).toBe(250);
    });

    it('should compute p90 correctly for a larger data set', () => {
      // 10 values 1..10 — p90 index = 0.9 * 9 = 8.1 → interpolate between 9 and 10
      for (let i = 1; i <= 10; i++) {
        collector.record(makeMetric({ duration: i * 10 }));
      }
      const p = collector.getPercentiles();
      // Sorted: 10,20,30,40,50,60,70,80,90,100
      // index = 0.9 * 9 = 8.1 → 90 * 0.9 + 100 * 0.1 = 91
      expect(p.p90).toBeCloseTo(91, 5);
    });

    it('should respect the since filter', () => {
      const now = Date.now();
      collector.record(makeMetric({ duration: 1000, timestamp: now - 10000 }));
      collector.record(makeMetric({ duration: 50, timestamp: now }));

      const p = collector.getPercentiles(now - 5000);
      // Only the second metric should be included
      expect(p.p50).toBe(50);
    });

    it('should have p50 <= p75 <= p90 <= p95 <= p99 <= p999', () => {
      for (let i = 1; i <= 100; i++) {
        collector.record(makeMetric({ duration: i }));
      }
      const p = collector.getPercentiles();
      expect(p.p50).toBeLessThanOrEqual(p.p75);
      expect(p.p75).toBeLessThanOrEqual(p.p90);
      expect(p.p90).toBeLessThanOrEqual(p.p95);
      expect(p.p95).toBeLessThanOrEqual(p.p99);
      expect(p.p99).toBeLessThanOrEqual(p.p999);
    });
  });

  // ---------------------------------------------------------------------------
  // getRegistryStats
  // ---------------------------------------------------------------------------
  describe('getRegistryStats()', () => {
    it('should return an empty object when no metrics are recorded', () => {
      expect(collector.getRegistryStats()).toEqual({});
    });

    it('should group metrics without a serverUrl under "unknown"', () => {
      collector.record(makeMetric({ serverUrl: undefined }));
      const stats = collector.getRegistryStats();
      expect(stats['unknown']).toBeDefined();
      expect(stats['unknown'].total).toBe(1);
    });

    it('should group metrics by serverUrl', () => {
      collector.record(makeMetric({ serverUrl: 'https://rdap.verisign.com', duration: 100 }));
      collector.record(makeMetric({ serverUrl: 'https://rdap.verisign.com', duration: 200 }));
      collector.record(makeMetric({ serverUrl: 'https://rdap.arin.net', duration: 50, type: 'ip' }));

      const stats = collector.getRegistryStats();
      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats['https://rdap.verisign.com'].total).toBe(2);
      expect(stats['https://rdap.arin.net'].total).toBe(1);
    });

    it('should correctly calculate avgDuration per server', () => {
      collector.record(makeMetric({ serverUrl: 'https://rdap.example.com', duration: 100 }));
      collector.record(makeMetric({ serverUrl: 'https://rdap.example.com', duration: 300 }));

      const stats = collector.getRegistryStats();
      expect(stats['https://rdap.example.com'].avgDuration).toBe(200);
    });

    it('should correctly count successful and failed queries per server', () => {
      collector.record(makeMetric({ serverUrl: 'https://rdap.example.com', success: true }));
      collector.record(
        makeMetric({ serverUrl: 'https://rdap.example.com', success: false, error: 'NetworkError' })
      );

      const stats = collector.getRegistryStats();
      const s = stats['https://rdap.example.com'];
      expect(s.successful).toBe(1);
      expect(s.failed).toBe(1);
    });

    it('should correctly calculate cacheHitRate per server', () => {
      collector.record(makeMetric({ serverUrl: 'https://rdap.example.com', cached: true }));
      collector.record(makeMetric({ serverUrl: 'https://rdap.example.com', cached: false }));

      const stats = collector.getRegistryStats();
      expect(stats['https://rdap.example.com'].cacheHitRate).toBe(50);
    });

    it('should include the server name in each registry entry', () => {
      const url = 'https://rdap.verisign.com';
      collector.record(makeMetric({ serverUrl: url }));
      const stats = collector.getRegistryStats();
      expect(stats[url].server).toBe(url);
    });

    it('should compute p90Duration per server', () => {
      const url = 'https://rdap.example.com';
      for (let i = 1; i <= 10; i++) {
        collector.record(makeMetric({ serverUrl: url, duration: i * 10 }));
      }
      const stats = collector.getRegistryStats();
      // p90 for 10,20,...,100 ≈ 91
      expect(stats[url].p90Duration).toBeCloseTo(91, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // getTopQueries
  // ---------------------------------------------------------------------------
  describe('getTopQueries()', () => {
    it('should return an empty array when there are no metrics', () => {
      expect(collector.getTopQueries()).toEqual([]);
    });

    it('should return queries sorted by count descending', () => {
      collector.record(makeMetric({ query: 'a.com', duration: 100 }));
      collector.record(makeMetric({ query: 'b.com', duration: 100 }));
      collector.record(makeMetric({ query: 'b.com', duration: 150 }));
      collector.record(makeMetric({ query: 'c.com', duration: 100 }));
      collector.record(makeMetric({ query: 'c.com', duration: 120 }));
      collector.record(makeMetric({ query: 'c.com', duration: 80 }));

      const top = collector.getTopQueries();
      expect(top[0].query).toBe('c.com');
      expect(top[0].count).toBe(3);
      expect(top[1].query).toBe('b.com');
      expect(top[1].count).toBe(2);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 20; i++) {
        collector.record(makeMetric({ query: `domain${i}.com` }));
      }
      const top = collector.getTopQueries(5);
      expect(top).toHaveLength(5);
    });

    it('should use default limit of 10', () => {
      for (let i = 0; i < 15; i++) {
        collector.record(makeMetric({ query: `domain${i}.com` }));
      }
      const top = collector.getTopQueries();
      expect(top.length).toBeLessThanOrEqual(10);
    });

    it('should calculate avgDuration correctly', () => {
      collector.record(makeMetric({ query: 'a.com', duration: 100 }));
      collector.record(makeMetric({ query: 'a.com', duration: 200 }));

      const top = collector.getTopQueries();
      const entry = top.find((t) => t.query === 'a.com');
      expect(entry?.avgDuration).toBe(150);
    });

    it('should calculate errorRate correctly', () => {
      collector.record(makeMetric({ query: 'a.com', success: true }));
      collector.record(makeMetric({ query: 'a.com', success: false, error: 'NetworkError' }));

      const top = collector.getTopQueries();
      const entry = top.find((t) => t.query === 'a.com');
      expect(entry?.errorRate).toBe(50);
    });

    it('should respect the since filter', () => {
      const now = Date.now();
      collector.record(makeMetric({ query: 'old.com', timestamp: now - 10000 }));
      collector.record(makeMetric({ query: 'new.com', timestamp: now }));

      const top = collector.getTopQueries(10, now - 5000);
      expect(top).toHaveLength(1);
      expect(top[0].query).toBe('new.com');
    });

    it('should include the type of each query', () => {
      collector.record(makeMetric({ query: '8.8.8.8', type: 'ip' }));
      const top = collector.getTopQueries();
      expect(top[0].type).toBe('ip');
    });
  });

  // ---------------------------------------------------------------------------
  // getErrorHistogram
  // ---------------------------------------------------------------------------
  describe('getErrorHistogram()', () => {
    it('should return an empty array when there are no errors', () => {
      collector.record(makeMetric({ success: true }));
      expect(collector.getErrorHistogram()).toEqual([]);
    });

    it('should return an empty array when there are no metrics', () => {
      expect(collector.getErrorHistogram()).toEqual([]);
    });

    it('should group errors by error type', () => {
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'a.com' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'b.com' }));
      collector.record(makeMetric({ success: false, error: 'TimeoutError', query: 'c.com' }));

      const histogram = collector.getErrorHistogram();
      expect(histogram).toHaveLength(2);
      const networkEntry = histogram.find((h) => h.errorType === 'NetworkError');
      expect(networkEntry?.count).toBe(2);
    });

    it('should sort errors by count descending', () => {
      collector.record(makeMetric({ success: false, error: 'RareError', query: 'a.com' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'b.com' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'c.com' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'd.com' }));

      const histogram = collector.getErrorHistogram();
      expect(histogram[0].errorType).toBe('NetworkError');
    });

    it('should calculate percentage relative to total errors', () => {
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'a.com' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'b.com' }));
      collector.record(makeMetric({ success: false, error: 'TimeoutError', query: 'c.com' }));
      collector.record(makeMetric({ success: false, error: 'TimeoutError', query: 'd.com' }));

      const histogram = collector.getErrorHistogram();
      histogram.forEach((h) => expect(h.percentage).toBe(50));
    });

    it('should include affected queries in each entry', () => {
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'a.com' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError', query: 'b.com' }));

      const histogram = collector.getErrorHistogram();
      const entry = histogram.find((h) => h.errorType === 'NetworkError');
      expect(entry?.affectedQueries).toContain('a.com');
      expect(entry?.affectedQueries).toContain('b.com');
    });

    it('should respect the since filter', () => {
      const now = Date.now();
      collector.record(
        makeMetric({ success: false, error: 'OldError', query: 'old.com', timestamp: now - 10000 })
      );
      collector.record(
        makeMetric({ success: false, error: 'NewError', query: 'new.com', timestamp: now })
      );

      const histogram = collector.getErrorHistogram(now - 5000);
      expect(histogram).toHaveLength(1);
      expect(histogram[0].errorType).toBe('NewError');
    });
  });

  // ---------------------------------------------------------------------------
  // exportPrometheus
  // ---------------------------------------------------------------------------
  describe('exportPrometheus()', () => {
    it('should return a string', () => {
      expect(typeof collector.exportPrometheus()).toBe('string');
    });

    it('should include the default prefix "rdapify"', () => {
      const output = collector.exportPrometheus();
      expect(output).toContain('rdapify_queries_total');
    });

    it('should use a custom prefix when provided', () => {
      const output = collector.exportPrometheus('myapp');
      expect(output).toContain('myapp_queries_total');
      expect(output).not.toContain('rdapify_queries_total');
    });

    it('should include HELP and TYPE lines for queries_total', () => {
      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP rdapify_queries_total');
      expect(output).toContain('# TYPE rdapify_queries_total counter');
    });

    it('should include query counts by type with correct labels', () => {
      collector.record(makeMetric({ type: 'domain' }));
      collector.record(makeMetric({ type: 'domain' }));
      collector.record(makeMetric({ type: 'ip' }));

      const output = collector.exportPrometheus();
      expect(output).toContain('rdapify_queries_total{type="domain"} 2');
      expect(output).toContain('rdapify_queries_total{type="ip"} 1');
      expect(output).toContain('rdapify_queries_total{type="asn"} 0');
    });

    it('should include the duration summary section', () => {
      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP rdapify_query_duration_seconds');
      expect(output).toContain('# TYPE rdapify_query_duration_seconds summary');
      expect(output).toContain('rdapify_query_duration_seconds{quantile="0.5"}');
      expect(output).toContain('rdapify_query_duration_seconds{quantile="0.9"}');
      expect(output).toContain('rdapify_query_duration_seconds{quantile="0.99"}');
    });

    it('should express durations in seconds (divided by 1000)', () => {
      collector.record(makeMetric({ duration: 500 })); // 500ms = 0.500s
      const output = collector.exportPrometheus();
      expect(output).toContain('rdapify_query_duration_seconds{quantile="0.5"} 0.500');
    });

    it('should include cache hits counter', () => {
      collector.record(makeMetric({ cached: true }));
      collector.record(makeMetric({ cached: true }));
      collector.record(makeMetric({ cached: false }));

      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP rdapify_cache_hits_total');
      expect(output).toContain('# TYPE rdapify_cache_hits_total counter');
      expect(output).toContain('rdapify_cache_hits_total 2');
    });

    it('should include errors_total counter with type labels', () => {
      collector.record(makeMetric({ success: false, error: 'NetworkError' }));
      collector.record(makeMetric({ success: false, error: 'NetworkError' }));
      collector.record(makeMetric({ success: false, error: 'TimeoutError' }));

      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP rdapify_errors_total');
      expect(output).toContain('# TYPE rdapify_errors_total counter');
      expect(output).toContain('rdapify_errors_total{type="NetworkError"} 2');
      expect(output).toContain('rdapify_errors_total{type="TimeoutError"} 1');
    });
  });

  // ---------------------------------------------------------------------------
  // exportCSV
  // ---------------------------------------------------------------------------
  describe('exportCSV()', () => {
    it('should return only the header row when there are no metrics', () => {
      const csv = collector.exportCSV();
      const lines = csv.split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('timestamp,type,query,success,duration,cached,serverUrl,error');
    });

    it('should include a header row with the correct columns', () => {
      const csv = collector.exportCSV();
      expect(csv.startsWith('timestamp,type,query,success,duration,cached,serverUrl,error')).toBe(
        true
      );
    });

    it('should produce one data row per metric', () => {
      collector.record(makeMetric({ query: 'a.com' }));
      collector.record(makeMetric({ query: 'b.com' }));
      const lines = collector.exportCSV().split('\n');
      // header + 2 data rows
      expect(lines).toHaveLength(3);
    });

    it('should include correct values in each column', () => {
      const now = 1700000000000;
      collector.record(
        makeMetric({
          timestamp: now,
          type: 'ip',
          query: '8.8.8.8',
          success: false,
          duration: 250,
          cached: true,
          serverUrl: 'https://rdap.arin.net',
          error: 'NetworkError',
        })
      );

      const lines = collector.exportCSV().split('\n');
      const row = lines[1];
      expect(row).toContain(`${now}`);
      expect(row).toContain('ip');
      expect(row).toContain('8.8.8.8');
      expect(row).toContain('false');
      expect(row).toContain('250');
      expect(row).toContain('true');
      expect(row).toContain('https://rdap.arin.net');
      expect(row).toContain('NetworkError');
    });

    it('should leave serverUrl and error columns empty when not present', () => {
      collector.record(makeMetric({ query: 'a.com', success: true }));
      const lines = collector.exportCSV().split('\n');
      const row = lines[1];
      // ends with two commas for missing serverUrl and error
      expect(row.endsWith(',,')).toBe(true);
    });

    it('should properly quote queries containing commas', () => {
      // query with a comma should still be properly contained in the CSV row
      collector.record(makeMetric({ query: 'tricky,query' }));
      const lines = collector.exportCSV().split('\n');
      expect(lines[1]).toContain('"tricky,query"');
    });

    it('should escape double quotes inside field values', () => {
      collector.record(makeMetric({ query: 'say "hello"' }));
      const lines = collector.exportCSV().split('\n');
      // RFC 4180: a double-quote is escaped by doubling it
      expect(lines[1]).toContain('"say ""hello"""');
    });
  });

  // ---------------------------------------------------------------------------
  // getSummary — new percentile fields
  // ---------------------------------------------------------------------------
  describe('getSummary() — p50/p90/p99 fields', () => {
    it('should include p50ResponseTime, p90ResponseTime, p99ResponseTime', () => {
      collector.record(makeMetric({ duration: 100 }));
      const summary = collector.getSummary();
      expect(summary).toHaveProperty('p50ResponseTime');
      expect(summary).toHaveProperty('p90ResponseTime');
      expect(summary).toHaveProperty('p99ResponseTime');
    });

    it('should return zeros for all percentile fields on empty metrics', () => {
      const summary = collector.getSummary();
      expect(summary.p50ResponseTime).toBe(0);
      expect(summary.p90ResponseTime).toBe(0);
      expect(summary.p99ResponseTime).toBe(0);
    });

    it('should return the single value for all percentile fields with one metric', () => {
      collector.record(makeMetric({ duration: 300 }));
      const summary = collector.getSummary();
      expect(summary.p50ResponseTime).toBe(300);
      expect(summary.p90ResponseTime).toBe(300);
      expect(summary.p99ResponseTime).toBe(300);
    });

    it('should have p50 <= p90 <= p99 with multiple metrics', () => {
      for (let i = 1; i <= 100; i++) {
        collector.record(makeMetric({ duration: i * 10 }));
      }
      const summary = collector.getSummary();
      expect(summary.p50ResponseTime).toBeLessThanOrEqual(summary.p90ResponseTime);
      expect(summary.p90ResponseTime).toBeLessThanOrEqual(summary.p99ResponseTime);
    });

    it('should respect the since filter for percentile fields', () => {
      const now = Date.now();
      collector.record(makeMetric({ duration: 9999, timestamp: now - 60000 }));
      collector.record(makeMetric({ duration: 50, timestamp: now }));

      const summary = collector.getSummary(now - 5000);
      expect(summary.p50ResponseTime).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // serverUrl field on QueryMetric
  // ---------------------------------------------------------------------------
  describe('QueryMetric.serverUrl optional field', () => {
    it('should accept a metric with serverUrl', () => {
      expect(() =>
        collector.record(
          makeMetric({ serverUrl: 'https://rdap.verisign.com' })
        )
      ).not.toThrow();
    });

    it('should preserve serverUrl in exported metrics', () => {
      const url = 'https://rdap.arin.net';
      collector.record(makeMetric({ serverUrl: url }));
      const exported = collector.export();
      expect(exported[0].serverUrl).toBe(url);
    });

    it('should accept a metric without serverUrl', () => {
      expect(() => collector.record(makeMetric())).not.toThrow();
      const exported = collector.export();
      expect(exported[0].serverUrl).toBeUndefined();
    });
  });
});
