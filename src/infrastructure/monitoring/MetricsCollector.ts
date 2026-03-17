/**
 * Metrics collector for monitoring RDAP queries
 * @module infrastructure/monitoring/MetricsCollector
 */

export interface QueryMetric {
  type: 'domain' | 'ip' | 'asn';
  query: string;
  success: boolean;
  duration: number;
  cached: boolean;
  timestamp: number;
  error?: string;
  /** RDAP registry server URL that handled this query */
  serverUrl?: string;
}

export interface MetricsSummary {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  totalDuration: number;
  queriesByType: {
    domain: number;
    ip: number;
    asn: number;
  };
  errorsByType: Record<string, number>;
}

/**
 * Collects and analyzes metrics for RDAP queries
 */
export class MetricsCollector {
  private metrics: QueryMetric[] = [];
  private readonly maxMetrics: number;
  private readonly enabled: boolean;

  constructor(options: { enabled?: boolean; maxMetrics?: number } = {}) {
    this.enabled = options.enabled ?? true;
    this.maxMetrics = options.maxMetrics || 10000;
  }

  /**
   * Records a query metric
   */
  record(metric: QueryMetric): void {
    if (!this.enabled) return;

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Calculates a percentile value from a sorted array using linear interpolation.
   * @param sorted - Array sorted in ascending order
   * @param p - Percentile in [0, 1]
   */
  private calculatePercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]!;

    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;

    const lowerVal = sorted[lower] ?? 0;
    const upperVal = sorted[upper] ?? 0;
    return lowerVal + fraction * (upperVal - lowerVal);
  }

  /**
   * Gets metrics summary
   */
  getSummary(since?: number): MetricsSummary {
    const relevantMetrics = since
      ? this.metrics.filter((m) => m.timestamp >= since)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return this.getEmptySummary();
    }

    const successful = relevantMetrics.filter((m) => m.success).length;
    const failed = relevantMetrics.length - successful;
    const cached = relevantMetrics.filter((m) => m.cached).length;

    const durations = relevantMetrics.map((m) => m.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const avgResponseTime = durations.length > 0 ? totalDuration / durations.length : 0;
    const minResponseTime = durations.length > 0 ? Math.min(...durations) : 0;
    const maxResponseTime = durations.length > 0 ? Math.max(...durations) : 0;

    const sorted = [...durations].sort((a, b) => a - b);
    const p50ResponseTime = this.calculatePercentile(sorted, 0.5);
    const p90ResponseTime = this.calculatePercentile(sorted, 0.9);
    const p99ResponseTime = this.calculatePercentile(sorted, 0.99);

    const queriesByType = {
      domain: relevantMetrics.filter((m) => m.type === 'domain').length,
      ip: relevantMetrics.filter((m) => m.type === 'ip').length,
      asn: relevantMetrics.filter((m) => m.type === 'asn').length,
    };

    const errorsByType: Record<string, number> = {};
    relevantMetrics
      .filter((m) => !m.success && m.error)
      .forEach((m) => {
        const errorType = m.error!;
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
      });

    return {
      total: relevantMetrics.length,
      successful,
      failed,
      successRate: relevantMetrics.length > 0 ? (successful / relevantMetrics.length) * 100 : 0,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      p50ResponseTime,
      p90ResponseTime,
      p99ResponseTime,
      cacheHitRate: relevantMetrics.length > 0 ? (cached / relevantMetrics.length) * 100 : 0,
      totalDuration,
      queriesByType,
      errorsByType,
    };
  }

  /**
   * Returns latency percentiles (p50, p75, p90, p95, p99, p999)
   */
  getPercentiles(since?: number): {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
  } {
    const relevantMetrics = since
      ? this.metrics.filter((m) => m.timestamp >= since)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, p999: 0 };
    }

    const sorted = relevantMetrics.map((m) => m.duration).sort((a, b) => a - b);
    return {
      p50: this.calculatePercentile(sorted, 0.5),
      p75: this.calculatePercentile(sorted, 0.75),
      p90: this.calculatePercentile(sorted, 0.9),
      p95: this.calculatePercentile(sorted, 0.95),
      p99: this.calculatePercentile(sorted, 0.99),
      p999: this.calculatePercentile(sorted, 0.999),
    };
  }

  /**
   * Returns per-registry performance statistics grouped by serverUrl.
   */
  getRegistryStats(): Record<
    string,
    {
      server: string;
      total: number;
      successful: number;
      failed: number;
      avgDuration: number;
      p90Duration: number;
      cacheHitRate: number;
    }
  > {
    const groups = new Map<string, QueryMetric[]>();

    for (const m of this.metrics) {
      const key = m.serverUrl ?? 'unknown';
      const group = groups.get(key);
      if (group) {
        group.push(m);
      } else {
        groups.set(key, [m]);
      }
    }

    const result: Record<string, ReturnType<MetricsCollector['getRegistryStats']>[string]> = {};

    for (const [key, group] of groups) {
      const successful = group.filter((m) => m.success).length;
      const cached = group.filter((m) => m.cached).length;
      const durations = group.map((m) => m.duration);
      const totalDuration = durations.reduce((a, b) => a + b, 0);
      const sorted = [...durations].sort((a, b) => a - b);

      result[key] = {
        server: key,
        total: group.length,
        successful,
        failed: group.length - successful,
        avgDuration: group.length > 0 ? totalDuration / group.length : 0,
        p90Duration: this.calculatePercentile(sorted, 0.9),
        cacheHitRate: group.length > 0 ? (cached / group.length) * 100 : 0,
      };
    }

    return result;
  }

  /**
   * Returns the most-queried values sorted by count descending.
   */
  getTopQueries(
    limit: number = 10,
    since?: number
  ): Array<{
    query: string;
    type: 'domain' | 'ip' | 'asn';
    count: number;
    avgDuration: number;
    errorRate: number;
  }> {
    const relevantMetrics = since
      ? this.metrics.filter((m) => m.timestamp >= since)
      : this.metrics;

    const groups = new Map<string, QueryMetric[]>();
    for (const m of relevantMetrics) {
      const group = groups.get(m.query);
      if (group) {
        group.push(m);
      } else {
        groups.set(m.query, [m]);
      }
    }

    return Array.from(groups.entries())
      .map(([query, group]) => {
        const totalDuration = group.reduce((a, m) => a + m.duration, 0);
        const failed = group.filter((m) => !m.success).length;
        return {
          query,
          type: group[0]!.type,
          count: group.length,
          avgDuration: totalDuration / group.length,
          errorRate: (failed / group.length) * 100,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Returns errors grouped by type, sorted by frequency descending.
   */
  getErrorHistogram(since?: number): Array<{
    errorType: string;
    count: number;
    percentage: number;
    affectedQueries: string[];
  }> {
    const relevantMetrics = since
      ? this.metrics.filter((m) => m.timestamp >= since)
      : this.metrics;

    const failures = relevantMetrics.filter((m) => !m.success && m.error);
    if (failures.length === 0) return [];

    const groups = new Map<string, QueryMetric[]>();
    for (const m of failures) {
      const key = m.error!;
      const group = groups.get(key);
      if (group) {
        group.push(m);
      } else {
        groups.set(key, [m]);
      }
    }

    return Array.from(groups.entries())
      .map(([errorType, group]) => ({
        errorType,
        count: group.length,
        percentage: (group.length / failures.length) * 100,
        affectedQueries: [...new Set(group.map((m) => m.query))],
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Exports metrics in Prometheus text exposition format.
   * @param prefix - Metric name prefix (default: 'rdapify')
   */
  exportPrometheus(prefix: string = 'rdapify'): string {
    const summary = this.getSummary();
    const percentiles = this.getPercentiles();
    const errorHistogram = this.getErrorHistogram();
    const cached = this.metrics.filter((m) => m.cached).length;

    const lines: string[] = [];

    // queries_total
    lines.push(`# HELP ${prefix}_queries_total Total number of RDAP queries`);
    lines.push(`# TYPE ${prefix}_queries_total counter`);
    lines.push(`${prefix}_queries_total{type="domain"} ${summary.queriesByType.domain}`);
    lines.push(`${prefix}_queries_total{type="ip"} ${summary.queriesByType.ip}`);
    lines.push(`${prefix}_queries_total{type="asn"} ${summary.queriesByType.asn}`);
    lines.push('');

    // query_duration_seconds (summary)
    lines.push(`# HELP ${prefix}_query_duration_seconds Query duration in seconds`);
    lines.push(`# TYPE ${prefix}_query_duration_seconds summary`);
    lines.push(
      `${prefix}_query_duration_seconds{quantile="0.5"} ${(percentiles.p50 / 1000).toFixed(3)}`
    );
    lines.push(
      `${prefix}_query_duration_seconds{quantile="0.9"} ${(percentiles.p90 / 1000).toFixed(3)}`
    );
    lines.push(
      `${prefix}_query_duration_seconds{quantile="0.99"} ${(percentiles.p99 / 1000).toFixed(3)}`
    );
    lines.push('');

    // cache_hits_total
    lines.push(`# HELP ${prefix}_cache_hits_total Total cache hits`);
    lines.push(`# TYPE ${prefix}_cache_hits_total counter`);
    lines.push(`${prefix}_cache_hits_total ${cached}`);
    lines.push('');

    // errors_total
    lines.push(`# HELP ${prefix}_errors_total Total errors by type`);
    lines.push(`# TYPE ${prefix}_errors_total counter`);
    for (const entry of errorHistogram) {
      lines.push(`${prefix}_errors_total{type="${entry.errorType}"} ${entry.count}`);
    }

    return lines.join('\n');
  }

  /**
   * Exports metrics as a CSV string (NDJSON-compatible column order).
   */
  exportCSV(): string {
    const header = 'timestamp,type,query,success,duration,cached,serverUrl,error';

    const escapeCSV = (val: string): string => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const rows = this.metrics.map((m) => {
      const fields = [
        String(m.timestamp),
        m.type,
        escapeCSV(m.query),
        String(m.success),
        String(m.duration),
        String(m.cached),
        m.serverUrl ?? '',
        m.error ?? '',
      ];
      return fields.join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Gets recent metrics
   */
  getRecent(count: number = 10): QueryMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Gets metrics for a specific time window
   */
  getWindow(startTime: number, endTime: number): QueryMetric[] {
    return this.metrics.filter((m) => m.timestamp >= startTime && m.timestamp <= endTime);
  }

  /**
   * Gets metrics by type
   */
  getByType(type: 'domain' | 'ip' | 'asn'): QueryMetric[] {
    return this.metrics.filter((m) => m.type === type);
  }

  /**
   * Gets failed queries
   */
  getFailures(): QueryMetric[] {
    return this.metrics.filter((m) => !m.success);
  }

  /**
   * Clears all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Gets empty summary
   */
  private getEmptySummary(): MetricsSummary {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
      avgResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      p50ResponseTime: 0,
      p90ResponseTime: 0,
      p99ResponseTime: 0,
      cacheHitRate: 0,
      totalDuration: 0,
      queriesByType: {
        domain: 0,
        ip: 0,
        asn: 0,
      },
      errorsByType: {},
    };
  }

  /**
   * Exports metrics as JSON array
   */
  export(): QueryMetric[] {
    return [...this.metrics];
  }

  /**
   * Imports metrics from JSON array
   */
  import(metrics: QueryMetric[]): void {
    this.metrics = metrics.slice(-this.maxMetrics);
  }

  /**
   * Gets collector statistics
   */
  getStats(): {
    enabled: boolean;
    totalMetrics: number;
    maxMetrics: number;
    oldestMetric?: number;
    newestMetric?: number;
  } {
    return {
      enabled: this.enabled,
      totalMetrics: this.metrics.length,
      maxMetrics: this.maxMetrics,
      oldestMetric: this.metrics[0]?.timestamp,
      newestMetric: this.metrics[this.metrics.length - 1]?.timestamp,
    };
  }
}
