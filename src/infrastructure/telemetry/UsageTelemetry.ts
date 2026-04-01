/**
 * Anonymous usage telemetry for RDAPify
 * @module infrastructure/telemetry/UsageTelemetry
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { VERSION } from '../../shared/constants/version.constants';

interface TelemetryConfig {
  installId: string;
  sessionCount: number;
  queryTypesUsed: string[];
  enabled: boolean;
}

/**
 * Collects and reports anonymous usage statistics.
 *
 * Disabled by default (opt-in). All data is anonymous: no query values,
 * no domain names, no IP addresses — only aggregated usage counters and
 * environment metadata (Node.js version, OS platform, rdapify version).
 *
 * Uses a local JSON file (~/.rdapify/telemetry.json) to persist state.
 */
export class UsageTelemetry {
  static readonly CONFIG_PATH = path.join(os.homedir(), '.rdapify', 'telemetry.json');
  private static readonly DEFAULT_ENDPOINT = 'https://telemetry.rdapify.com/v1/ping';
  private static config: TelemetryConfig | null = null;

  /**
   * Returns the anonymous telemetry payload that would be sent on ping.
   */
  static getPayload(): Record<string, unknown> {
    const cfg = UsageTelemetry.loadConfig();
    return {
      installId: cfg.installId,
      rdapifyVersion: VERSION,
      nodeVersion: process.version,
      platform: process.platform,
      queryTypesUsed: cfg.queryTypesUsed,
      sessionCount: cfg.sessionCount,
    };
  }

  /**
   * Records a query type and fires a fire-and-forget ping to the telemetry endpoint.
   * Does nothing when telemetry is disabled (the default).
   *
   * @param queryType - The type of RDAP query performed (e.g. 'domain', 'ip')
   * @param endpoint  - Optional custom endpoint URL; defaults to rdapify.com
   */
  static async ping(queryType: string, endpoint?: string): Promise<void> {
    const cfg = UsageTelemetry.loadConfig();
    if (!cfg.enabled) return;

    if (!cfg.queryTypesUsed.includes(queryType)) {
      cfg.queryTypesUsed.push(queryType);
    }
    UsageTelemetry.saveConfig(cfg);

    // Fire-and-forget — telemetry must never cause errors in the caller
    try {
      const url = endpoint ?? UsageTelemetry.DEFAULT_ENDPOINT;
      const payload = UsageTelemetry.getPayload();
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }).catch(() => { /* ignore network errors */ });
    } catch { /* ignore synchronous errors */ }
  }

  /**
   * Enables telemetry collection and persistence.
   */
  static enable(): void {
    const cfg = UsageTelemetry.loadConfig();
    cfg.enabled = true;
    UsageTelemetry.saveConfig(cfg);
  }

  /**
   * Disables telemetry collection.
   */
  static disable(): void {
    const cfg = UsageTelemetry.loadConfig();
    cfg.enabled = false;
    UsageTelemetry.saveConfig(cfg);
  }

  /**
   * Resets telemetry state by deleting the local config file.
   */
  static reset(): void {
    try { fs.rmSync(UsageTelemetry.CONFIG_PATH, { force: true }); } catch { /* ignore */ }
    UsageTelemetry.config = null;
  }

  private static loadConfig(): TelemetryConfig {
    if (UsageTelemetry.config) return UsageTelemetry.config;
    try {
      const raw = fs.readFileSync(UsageTelemetry.CONFIG_PATH, 'utf-8');
      UsageTelemetry.config = JSON.parse(raw) as TelemetryConfig;
    } catch {
      UsageTelemetry.config = {
        installId: crypto.randomUUID(),
        sessionCount: 0,
        queryTypesUsed: [],
        enabled: false, // disabled by default — explicit opt-in required
      };
      UsageTelemetry.saveConfig(UsageTelemetry.config);
    }
    return UsageTelemetry.config;
  }

  private static saveConfig(cfg: TelemetryConfig): void {
    try {
      const dir = path.dirname(UsageTelemetry.CONFIG_PATH);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(UsageTelemetry.CONFIG_PATH, JSON.stringify(cfg, null, 2));
      UsageTelemetry.config = cfg;
    } catch { /* ignore write errors — telemetry must never block the caller */ }
  }
}
