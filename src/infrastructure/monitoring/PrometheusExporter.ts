/**
 * Prometheus metrics exporter for RDAPify.
 *
 * Converts internal `MetricsCollector` data to the Prometheus text-based
 * exposition format (version 0.0.4), suitable for scraping by Prometheus,
 * VictoriaMetrics, or any compatible backend.
 *
 * @example With Node.js HTTP server
 * ```typescript
 * import http from 'http';
 * import { RDAPClient, PrometheusExporter } from 'rdapify';
 *
 * const client = new RDAPClient();
 * const exporter = new PrometheusExporter(client.getMetrics.bind(client));
 *
 * http.createServer((req, res) => {
 *   if (req.url === '/metrics') {
 *     res.setHeader('Content-Type', PrometheusExporter.CONTENT_TYPE);
 *     res.end(exporter.export());
 *   }
 * }).listen(9090);
 * ```
 *
 * @module infrastructure/monitoring/PrometheusExporter
 */

import type { MetricsSummary } from './MetricsCollector';

/** Prometheus text exposition content type */
const CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/**
 * Options for the Prometheus exporter
 */
export interface PrometheusExporterOptions {
  /**
   * Metric name prefix (default: `rdapify`)
   */
  prefix?: string;
  /**
   * Additional constant labels to attach to every metric, e.g.
   * `{ instance: 'my-app', env: 'production' }`.
   */
  labels?: Record<string, string>;
}

/**
 * Exports RDAPify metrics in Prometheus text exposition format.
 */
export class PrometheusExporter {
  static readonly CONTENT_TYPE = CONTENT_TYPE;

  private readonly prefix: string;
  private readonly labels: Record<string, string>;
  private readonly getMetrics: (since?: number) => MetricsSummary;

  /**
   * @param getMetrics  A zero-arg function that returns the current
   *                    `MetricsSummary` — typically `client.getMetrics.bind(client)`.
   * @param options     Optional prefix and constant labels.
   */
  constructor(
    getMetrics: (since?: number) => MetricsSummary,
    options: PrometheusExporterOptions = {}
  ) {
    this.getMetrics = getMetrics;
    this.prefix = options.prefix ?? 'rdapify';
    this.labels = options.labels ?? {};
  }

  /**
   * Returns the current metrics formatted as a Prometheus text payload.
   * Call this on every `/metrics` request — it always reflects the latest state.
   */
  export(): string {
    const m = this.getMetrics();
    const lbl = this.formatLabels(this.labels);
    const p = this.prefix;
    const lines: string[] = [];

    const gauge = (name: string, help: string, value: number, extraLabels: Record<string, string> = {}): void => {
      const fullName = `${p}_${name}`;
      lines.push(`# HELP ${fullName} ${help}`);
      lines.push(`# TYPE ${fullName} gauge`);
      lines.push(`${fullName}${this.formatLabels({ ...this.labels, ...extraLabels })} ${value}`);
    };

    const counter = (name: string, help: string, value: number, extraLabels: Record<string, string> = {}): void => {
      const fullName = `${p}_${name}`;
      lines.push(`# HELP ${fullName} ${help}`);
      lines.push(`# TYPE ${fullName} counter`);
      lines.push(`${fullName}_total${this.formatLabels({ ...this.labels, ...extraLabels })} ${value}`);
    };

    // ---- Counters ----
    counter('queries', 'Total number of RDAP queries executed', m.total);
    counter('queries_successful', 'Total number of successful RDAP queries', m.successful);
    counter('queries_failed', 'Total number of failed RDAP queries', m.failed);

    // Per-type counters
    const types = Object.entries(m.queriesByType) as Array<[string, number]>;
    const fullTypeName = `${p}_queries_by_type_total`;
    lines.push(`# HELP ${fullTypeName} Total RDAP queries broken down by query type`);
    lines.push(`# TYPE ${fullTypeName} counter`);
    for (const [type, count] of types) {
      lines.push(`${fullTypeName}${this.formatLabels({ ...this.labels, type })} ${count}`);
    }

    // ---- Gauges ----
    gauge('success_rate', 'Fraction of successful queries (0–1)', m.successRate);
    gauge('cache_hit_rate', 'Fraction of queries served from cache (0–1)', m.cacheHitRate);
    gauge('response_time_avg_ms', 'Average RDAP query response time in milliseconds', m.avgResponseTime);
    gauge('response_time_min_ms', 'Minimum RDAP query response time in milliseconds', m.minResponseTime);
    gauge('response_time_max_ms', 'Maximum RDAP query response time in milliseconds', m.maxResponseTime);
    gauge('response_time_p50_ms', 'P50 (median) RDAP query response time in milliseconds', m.p50ResponseTime);
    gauge('response_time_p90_ms', 'P90 RDAP query response time in milliseconds', m.p90ResponseTime);
    gauge('response_time_p99_ms', 'P99 RDAP query response time in milliseconds', m.p99ResponseTime);

    // Error breakdown
    const errorEntries = Object.entries(m.errorsByType);
    if (errorEntries.length > 0) {
      const fullErrName = `${p}_errors_by_type_total`;
      lines.push(`# HELP ${fullErrName} Total RDAP errors broken down by error type`);
      lines.push(`# TYPE ${fullErrName} counter`);
      for (const [errorType, count] of errorEntries) {
        lines.push(`${fullErrName}${this.formatLabels({ ...this.labels, error_type: errorType })} ${count}`);
      }
    }

    // Suppress unused variable warning for lbl
    void lbl;

    return lines.join('\n') + '\n';
  }

  /**
   * Returns an HTTP request handler (compatible with Node.js `http.IncomingMessage` /
   * `http.ServerResponse`, Express, and Fastify) that serves the metrics endpoint.
   *
   * @example
   * ```typescript
   * app.get('/metrics', exporter.createHttpHandler());
   * ```
   */
  createHttpHandler(): (req: unknown, res: { setHeader(k: string, v: string): void; end(body: string): void }) => void {
    return (_req, res) => {
      res.setHeader('Content-Type', CONTENT_TYPE);
      res.end(this.export());
    };
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    const pairs = entries.map(([k, v]) => `${k}="${this.escapeLabel(v)}"`).join(',');
    return `{${pairs}}`;
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}
