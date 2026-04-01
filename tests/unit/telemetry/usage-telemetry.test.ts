/**
 * Unit tests for UsageTelemetry (Feature 8)
 */

import * as fs from 'fs';
import { UsageTelemetry } from '../../../src/infrastructure/telemetry/UsageTelemetry';

describe('UsageTelemetry', () => {
  beforeEach(() => {
    // Reset in-memory state and remove config file before each test
    UsageTelemetry.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    UsageTelemetry.reset();
  });

  it('is disabled by default', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    await UsageTelemetry.ping('domain');

    // Fire-and-forget is microtask — wait for it
    await new Promise(resolve => setImmediate(resolve));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends ping when enabled', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    UsageTelemetry.enable();
    await UsageTelemetry.ping('domain', 'https://telemetry.example.com/v1/ping');

    // Fire-and-forget — wait for microtasks
    await new Promise(resolve => setImmediate(resolve));

    expect(mockFetch).toHaveBeenCalledWith(
      'https://telemetry.example.com/v1/ping',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reset() removes the config file', () => {
    UsageTelemetry.enable();
    UsageTelemetry.reset();

    expect(fs.existsSync(UsageTelemetry.CONFIG_PATH)).toBe(false);
  });

  it('getPayload() returns anonymous data without PII', () => {
    const payload = UsageTelemetry.getPayload();
    expect(payload).toHaveProperty('installId');
    expect(payload).toHaveProperty('rdapifyVersion', expect.any(String));
    expect(payload).toHaveProperty('platform');
    expect(payload).toHaveProperty('nodeVersion');
    expect(payload).not.toHaveProperty('query');
    expect(payload).not.toHaveProperty('domain');
  });

  it('disable() stops sending pings', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    UsageTelemetry.enable();
    UsageTelemetry.disable();
    await UsageTelemetry.ping('ip');

    await new Promise(resolve => setImmediate(resolve));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ping() never throws even when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network down'));
    UsageTelemetry.enable();

    await expect(UsageTelemetry.ping('domain')).resolves.not.toThrow();
  });
});
