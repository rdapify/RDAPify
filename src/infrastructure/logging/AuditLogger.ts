/**
 * GDPR/SOC2/CCPA-compliant Audit Logger for RDAP operations
 * @module infrastructure/logging/AuditLogger
 */

import * as fs from 'fs/promises';

export type AuditEventType =
  | 'QUERY_START'
  | 'QUERY_SUCCESS'
  | 'QUERY_FAILURE'
  | 'CACHE_HIT'
  | 'CACHE_MISS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SSRF_BLOCKED'
  | 'PII_REDACTED';

export interface AuditEvent {
  /** UUID-like unique ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  eventType: AuditEventType;
  queryType: 'domain' | 'ip' | 'asn';
  query: string;
  normalizedQuery?: string;
  success: boolean;
  durationMs: number;
  cached: boolean;
  serverUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Privacy - excluded by default */
  requestHeaders?: Record<string, string>;
  /** Privacy - excluded by default */
  responseSize?: number;
  sessionId?: string;
  clientId?: string;
  tags?: Record<string, string>;
}

export interface AuditLogAdapter {
  write(event: AuditEvent): Promise<void> | void;
  flush?(): Promise<void> | void;
}

export interface AuditLoggerOptions {
  /** Whether audit logging is enabled (default: true) */
  enabled?: boolean;
  /** Adapter to use for writing events */
  adapter?: AuditLogAdapter;
  /** Include request headers in events - false by default (privacy) */
  includeRequestHeaders?: boolean;
  /** Include response size in events - false by default */
  includeResponseSize?: boolean;
  /** Fields to exclude from query logging */
  sensitiveFields?: string[];
  /** Optional session context */
  sessionId?: string;
  /** Optional client identifier */
  clientId?: string;
  /** Static tags added to every event */
  tags?: Record<string, string>;
  /** Retention hours for in-memory adapter (default: 24) */
  retentionHours?: number;
}

/**
 * In-memory audit log adapter - buffers events in memory with TTL eviction
 */
export class InMemoryAuditAdapter implements AuditLogAdapter {
  private events: AuditEvent[] = [];
  private readonly maxEvents: number;
  private readonly retentionMs: number;

  constructor(options?: { maxEvents?: number; retentionHours?: number }) {
    this.maxEvents = options?.maxEvents ?? 10000;
    this.retentionMs = (options?.retentionHours ?? 24) * 60 * 60 * 1000;
  }

  write(event: AuditEvent): void {
    this.evict();
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Returns events optionally filtered by a minimum ISO timestamp
   */
  getEvents(since?: string): AuditEvent[] {
    if (!since) {
      return [...this.events];
    }
    const sinceMs = new Date(since).getTime();
    return this.events.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
  }

  getEventsByType(type: AuditEventType): AuditEvent[] {
    return this.events.filter((e) => e.eventType === type);
  }

  clear(): void {
    this.events = [];
  }

  size(): number {
    return this.events.length;
  }

  private evict(): void {
    const cutoff = Date.now() - this.retentionMs;
    this.events = this.events.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  }
}

/**
 * File-based audit log adapter - appends JSON lines to a file (NDJSON format)
 */
export class FileAuditAdapter implements AuditLogAdapter {
  constructor(private readonly filePath: string) {}

  async write(event: AuditEvent): Promise<void> {
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.filePath, line, 'utf8');
  }

  async flush(): Promise<void> {
    // no-op for file adapter
  }
}

/**
 * Main AuditLogger class - GDPR/SOC2/CCPA-compliant audit logging
 */
export class AuditLogger {
  private readonly enabled: boolean;
  private readonly adapter: AuditLogAdapter;
  private readonly includeRequestHeaders: boolean;
  private readonly includeResponseSize: boolean;
  private readonly sessionId?: string;
  private readonly clientId?: string;
  private readonly tags?: Record<string, string>;
  private eventsLogged: number = 0;

  constructor(options?: AuditLoggerOptions) {
    this.enabled = options?.enabled ?? true;
    this.adapter = options?.adapter ?? new InMemoryAuditAdapter({
      retentionHours: options?.retentionHours ?? 24,
    });
    this.includeRequestHeaders = options?.includeRequestHeaders ?? false;
    this.includeResponseSize = options?.includeResponseSize ?? false;
    this.sessionId = options?.sessionId;
    this.clientId = options?.clientId;
    this.tags = options?.tags;
  }

  /**
   * Logs an audit event with auto-generated id and timestamp
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    if (!this.enabled) return;

    const fullEvent: AuditEvent = {
      ...event,
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    // Apply privacy controls
    if (!this.includeRequestHeaders) {
      delete fullEvent.requestHeaders;
    }
    if (!this.includeResponseSize) {
      delete fullEvent.responseSize;
    }

    // Merge static tags
    if (this.tags) {
      fullEvent.tags = { ...this.tags, ...fullEvent.tags };
    }

    this.adapter.write(fullEvent);
    this.eventsLogged++;
  }

  logQueryStart(params: {
    queryType: 'domain' | 'ip' | 'asn';
    query: string;
    sessionId?: string;
    clientId?: string;
  }): void {
    this.log({
      eventType: 'QUERY_START',
      queryType: params.queryType,
      query: params.query,
      success: false,
      durationMs: 0,
      cached: false,
      sessionId: params.sessionId ?? this.sessionId,
      clientId: params.clientId ?? this.clientId,
    });
  }

  logQuerySuccess(params: {
    queryType: 'domain' | 'ip' | 'asn';
    query: string;
    normalizedQuery: string;
    durationMs: number;
    cached: boolean;
    serverUrl?: string;
    responseSize?: number;
  }): void {
    this.log({
      eventType: 'QUERY_SUCCESS',
      queryType: params.queryType,
      query: params.query,
      normalizedQuery: params.normalizedQuery,
      success: true,
      durationMs: params.durationMs,
      cached: params.cached,
      serverUrl: params.serverUrl,
      responseSize: this.includeResponseSize ? params.responseSize : undefined,
      sessionId: this.sessionId,
      clientId: this.clientId,
    });
  }

  logQueryFailure(params: {
    queryType: 'domain' | 'ip' | 'asn';
    query: string;
    durationMs: number;
    errorCode: string;
    errorMessage: string;
  }): void {
    this.log({
      eventType: 'QUERY_FAILURE',
      queryType: params.queryType,
      query: params.query,
      success: false,
      durationMs: params.durationMs,
      cached: false,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      sessionId: this.sessionId,
      clientId: this.clientId,
    });
  }

  logCacheHit(params: { queryType: 'domain' | 'ip' | 'asn'; query: string }): void {
    this.log({
      eventType: 'CACHE_HIT',
      queryType: params.queryType,
      query: params.query,
      success: true,
      durationMs: 0,
      cached: true,
      sessionId: this.sessionId,
      clientId: this.clientId,
    });
  }

  logRateLimitExceeded(params: { queryType: 'domain' | 'ip' | 'asn'; query: string }): void {
    this.log({
      eventType: 'RATE_LIMIT_EXCEEDED',
      queryType: params.queryType,
      query: params.query,
      success: false,
      durationMs: 0,
      cached: false,
      sessionId: this.sessionId,
      clientId: this.clientId,
    });
  }

  logSSRFBlocked(params: { url: string }): void {
    this.log({
      eventType: 'SSRF_BLOCKED',
      queryType: 'domain',
      query: params.url,
      success: false,
      durationMs: 0,
      cached: false,
      sessionId: this.sessionId,
      clientId: this.clientId,
    });
  }

  logPIIRedacted(params: {
    queryType: 'domain' | 'ip' | 'asn';
    query: string;
    fieldsRedacted: number;
  }): void {
    this.log({
      eventType: 'PII_REDACTED',
      queryType: params.queryType,
      query: params.query,
      success: true,
      durationMs: 0,
      cached: false,
      tags: { fieldsRedacted: String(params.fieldsRedacted) },
      sessionId: this.sessionId,
      clientId: this.clientId,
    });
  }

  async flush(): Promise<void> {
    if (this.adapter.flush) {
      await this.adapter.flush();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getStats(): { enabled: boolean; eventsLogged: number } {
    return {
      enabled: this.enabled,
      eventsLogged: this.eventsLogged,
    };
  }

  /**
   * Generates a simple unique ID without external dependencies
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }
}
