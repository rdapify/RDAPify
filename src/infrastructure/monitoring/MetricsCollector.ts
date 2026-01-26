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
}

export interface MetricsSummary {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
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
    const avgResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minResponseTime = Math.min(...durations);
    const maxResponseTime = Math.max(...durations);

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
      successRate: (successful / relevantMetrics.length) * 100,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      cacheHitRate: (cached / relevantMetrics.length) * 100,
      totalDuration: durations.reduce((a, b) => a + b, 0),
      queriesByType,
      errorsByType,
    };
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
   * Exports metrics as JSON
   */
  export(): QueryMetric[] {
    return [...this.metrics];
  }

  /**
   * Imports metrics from JSON
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
