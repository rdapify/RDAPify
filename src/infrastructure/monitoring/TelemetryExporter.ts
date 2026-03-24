/**
 * OpenTelemetry OTLP trace exporter for RDAPify.
 *
 * Sends spans to any OTLP-compatible backend (Jaeger, Grafana Tempo,
 * Honeycomb, Lightstep, etc.) using the OTLP/HTTP JSON transport.
 *
 * This is a lightweight, zero-dependency implementation.  It does **not**
 * import `@opentelemetry/sdk-node` — it constructs and ships OTLP payloads
 * directly over `fetch` / `http`, keeping the bundle size minimal.
 *
 * @example With RDAPClient
 * ```typescript
 * import { RDAPClient } from 'rdapify';
 *
 * const client = new RDAPClient({
 *   telemetry: {
 *     endpoint: 'http://localhost:4318/v1/traces',
 *     serviceName: 'my-app',
 *   },
 * });
 * ```
 *
 * @module infrastructure/monitoring/TelemetryExporter
 */

import { join } from 'path';
import type { TelemetryOptions } from '../../shared/types/options';

// Read version from the nearest package.json up the directory tree.
// Works from both src/ (dev) and dist/cjs/ (published) layouts.
function findPackageVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require(join(dir, 'package.json')) as { version: string };
      if (pkg.version) return pkg.version;
    } catch { /* keep climbing */ }
    dir = join(dir, '..');
  }
  return '0.0.0';
}

const RDAPIFY_VERSION = findPackageVersion();

/** A minimal OTLP span representation */
export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: number; boolValue?: boolean } }>;
  status?: { code: 0 | 1 | 2; message?: string };
}

/**
 * Exports RDAP query spans as OTLP/HTTP JSON traces.
 */
export class TelemetryExporter {
  private readonly endpoint: string;
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly resourceAttributes: Record<string, string>;
  private readonly enabled: boolean;

  constructor(options: TelemetryOptions) {
    this.endpoint = options.endpoint ?? '';
    this.serviceName = options.serviceName ?? 'rdapify';
    this.serviceVersion = options.serviceVersion ?? RDAPIFY_VERSION;
    this.resourceAttributes = options.resourceAttributes ?? {};
    this.enabled = options.enabled !== false && Boolean(this.endpoint);
  }

  /**
   * Returns `true` if telemetry export is active (endpoint configured and enabled).
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Exports a batch of spans to the OTLP endpoint.
   * Errors are silently swallowed to avoid disrupting the caller's query path.
   */
  async exportSpans(spans: SpanData[]): Promise<void> {
    if (!this.enabled || spans.length === 0) return;

    const payload = this.buildOtlpPayload(spans);

    try {
      const body = JSON.stringify(payload);
      await this.sendRequest(body);
    } catch {
      // Telemetry errors must never propagate to the caller
    }
  }

  /**
   * Creates a new span data object.  Call `endSpan()` when the operation is complete.
   */
  startSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>,
    parentSpanId?: string
  ): SpanData {
    const span: SpanData = {
      traceId: this.generateId(16),
      spanId: this.generateId(8),
      parentSpanId,
      name,
      startTimeUnixNano: this.nowNano(),
      endTimeUnixNano: '0',
      attributes: attributes ? this.encodeAttributes(attributes) : [],
    };
    return span;
  }

  /**
   * Ends a span by setting its end time, then exports it immediately.
   */
  async endSpan(
    span: SpanData,
    status: { code: 0 | 1 | 2; message?: string } = { code: 0 }
  ): Promise<void> {
    span.endTimeUnixNano = this.nowNano();
    span.status = status;
    await this.exportSpans([span]);
  }

  private buildOtlpPayload(spans: SpanData[]): object {
    const resourceAttrs = this.encodeAttributes({
      'service.name': this.serviceName,
      'service.version': this.serviceVersion,
      'telemetry.sdk.name': 'rdapify',
      'telemetry.sdk.language': 'javascript',
      ...this.resourceAttributes,
    });

    return {
      resourceSpans: [
        {
          resource: { attributes: resourceAttrs },
          scopeSpans: [
            {
              scope: { name: 'rdapify', version: this.serviceVersion },
              spans: spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                parentSpanId: s.parentSpanId,
                name: s.name,
                kind: 3, // CLIENT
                startTimeUnixNano: s.startTimeUnixNano,
                endTimeUnixNano: s.endTimeUnixNano,
                attributes: s.attributes ?? [],
                status: s.status ?? { code: 0 },
              })),
            },
          ],
        },
      ],
    };
  }

  private encodeAttributes(
    attrs: Record<string, string | number | boolean>
  ): Array<{ key: string; value: { stringValue?: string; intValue?: number; boolValue?: boolean } }> {
    return Object.entries(attrs).map(([key, value]) => {
      if (typeof value === 'boolean') {
        return { key, value: { boolValue: value } };
      } else if (typeof value === 'number') {
        return { key, value: { intValue: value } };
      } else {
        return { key, value: { stringValue: String(value) } };
      }
    });
  }

  private async sendRequest(body: string): Promise<void> {
    const fetchFn: typeof fetch =
      typeof globalThis !== 'undefined' && typeof (globalThis as Record<string, unknown>)['fetch'] === 'function'
        ? (globalThis as Record<string, unknown>)['fetch'] as typeof fetch
        : (() => { throw new Error('No fetch available'); })();

    const response = await fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`OTLP export failed: ${response.status} ${response.statusText}`);
    }
  }

  private generateId(bytes: number): string {
    const hex: string[] = [];
    for (let i = 0; i < bytes * 2; i++) {
      hex.push(Math.floor(Math.random() * 16).toString(16));
    }
    return hex.join('');
  }

  private nowNano(): string {
    return (BigInt(Date.now()) * BigInt(1_000_000)).toString();
  }
}
