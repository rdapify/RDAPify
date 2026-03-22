/**
 * Unit tests for streamBatch (Streaming API)
 */

import { BatchProcessor } from '../../src/application/services/BatchProcessor';
import type { BatchQueryRequest } from '../../src/application/services/BatchProcessor';
import type { RDAPClient } from '../../src/application/client';

function makeClient(overrides: {
  domain?: jest.Mock;
  ip?: jest.Mock;
  asn?: jest.Mock;
  nameserver?: jest.Mock;
} = {}): RDAPClient {
  return {
    domain: overrides.domain ?? jest.fn().mockResolvedValue({ query: 'test', objectClass: 'domain', metadata: { source: 'test', timestamp: '', cached: false } }),
    ip: overrides.ip ?? jest.fn().mockResolvedValue({ query: 'test', objectClass: 'ip network', metadata: { source: 'test', timestamp: '', cached: false } }),
    asn: overrides.asn ?? jest.fn().mockResolvedValue({ query: 'test', objectClass: 'autnum', metadata: { source: 'test', timestamp: '', cached: false } }),
    nameserver: overrides.nameserver ?? jest.fn().mockResolvedValue({ query: 'test', objectClass: 'nameserver', metadata: { source: 'test', timestamp: '', cached: false } }),
    entity: jest.fn().mockResolvedValue({ query: 'test', objectClass: 'entity', metadata: { source: 'test', timestamp: '', cached: false } }),
  } as unknown as RDAPClient;
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

describe('BatchProcessor.streamBatch()', () => {
  it('yields one result per request', async () => {
    const mockDomain = jest.fn().mockResolvedValue({ query: 'example.com', objectClass: 'domain', status: [], metadata: { source: 'test', timestamp: '', cached: false } });
    const processor = new BatchProcessor(makeClient({ domain: mockDomain }));

    const requests: BatchQueryRequest[] = [
      { type: 'domain', query: 'example.com' },
      { type: 'domain', query: 'google.com' },
      { type: 'domain', query: 'github.com' },
    ];

    const results = await collect(processor.streamBatch(requests));
    expect(results).toHaveLength(3);
    expect(mockDomain).toHaveBeenCalledTimes(3);
  });

  it('yields results in order of chunk completion', async () => {
    const processor = new BatchProcessor(makeClient());
    const requests: BatchQueryRequest[] = Array.from({ length: 10 }, (_, i) => ({
      type: 'domain' as const,
      query: `domain${i}.com`,
    }));

    const results = await collect(processor.streamBatch(requests, { concurrency: 3 }));
    expect(results).toHaveLength(10);
  });

  it('handles 100 queries without overflow (back-pressure test)', async () => {
    const mockDomain = jest.fn().mockResolvedValue({ query: 'x', objectClass: 'domain', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const processor = new BatchProcessor(makeClient({ domain: mockDomain }));

    const requests: BatchQueryRequest[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'domain' as const,
      query: `domain${i}.com`,
    }));

    const results = await collect(processor.streamBatch(requests, { concurrency: 5 }));
    expect(results).toHaveLength(100);
    expect(mockDomain).toHaveBeenCalledTimes(100);
  });

  it('captures errors per-item when continueOnError: true (default)', async () => {
    const mockDomain = jest.fn()
      .mockResolvedValueOnce({ query: 'ok.com', objectClass: 'domain', status: [], metadata: { source: 't', timestamp: '', cached: false } })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ query: 'ok2.com', objectClass: 'domain', status: [], metadata: { source: 't', timestamp: '', cached: false } });

    const processor = new BatchProcessor(makeClient({ domain: mockDomain }));
    const requests: BatchQueryRequest[] = [
      { type: 'domain', query: 'ok.com' },
      { type: 'domain', query: 'bad.com' },
      { type: 'domain', query: 'ok2.com' },
    ];

    const results = await collect(processor.streamBatch(requests));
    expect(results).toHaveLength(3);

    const errResult = results.find(r => r.query === 'bad.com');
    expect(errResult?.error?.message).toBe('network error');

    const okResult = results.find(r => r.query === 'ok.com');
    expect(okResult?.error).toBeUndefined();
    expect(okResult?.result).toBeDefined();
  });

  it('throws on first error when continueOnError: false', async () => {
    const mockDomain = jest.fn()
      .mockRejectedValueOnce(new Error('fail'));

    const processor = new BatchProcessor(makeClient({ domain: mockDomain }));
    const requests: BatchQueryRequest[] = [{ type: 'domain', query: 'bad.com' }];

    await expect(
      collect(processor.streamBatch(requests, { continueOnError: false }))
    ).rejects.toThrow('fail');
  });

  it('each result has a duration property', async () => {
    const processor = new BatchProcessor(makeClient());
    const requests: BatchQueryRequest[] = [{ type: 'domain', query: 'example.com' }];

    const results = await collect(processor.streamBatch(requests));
    expect(typeof results[0]?.duration).toBe('number');
    expect(results[0]?.duration).toBeGreaterThanOrEqual(0);
  });

  it('routes ip, asn, nameserver queries correctly', async () => {
    const mockIp = jest.fn().mockResolvedValue({ query: '8.8.8.8', objectClass: 'ip network', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const mockAsn = jest.fn().mockResolvedValue({ query: 'AS15169', objectClass: 'autnum', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const mockNs = jest.fn().mockResolvedValue({ query: 'ns1.example.com', objectClass: 'nameserver', status: [], metadata: { source: 't', timestamp: '', cached: false } });

    const processor = new BatchProcessor(makeClient({ ip: mockIp, asn: mockAsn, nameserver: mockNs }));
    const requests: BatchQueryRequest[] = [
      { type: 'ip', query: '8.8.8.8' },
      { type: 'asn', query: 'AS15169' },
      { type: 'nameserver', query: 'ns1.example.com' },
    ];

    const results = await collect(processor.streamBatch(requests));
    expect(results).toHaveLength(3);
    expect(mockIp).toHaveBeenCalledWith('8.8.8.8');
    expect(mockAsn).toHaveBeenCalledWith('AS15169');
    expect(mockNs).toHaveBeenCalledWith('ns1.example.com');
  });

  it('throws for entity query without serverUrl', async () => {
    const processor = new BatchProcessor(makeClient());
    const requests: BatchQueryRequest[] = [{ type: 'entity', query: 'HANDLE-1' }];

    await expect(
      collect(processor.streamBatch(requests, { continueOnError: false }))
    ).rejects.toThrow('serverUrl');
  });

  it('empty request list yields no results', async () => {
    const processor = new BatchProcessor(makeClient());
    const results = await collect(processor.streamBatch([]));
    expect(results).toHaveLength(0);
  });
});

describe('RDAPClient.streamBatch()', () => {
  it('delegates to BatchProcessor.streamBatch and returns AsyncGenerator', async () => {
    const { RDAPClient } = await import('../../src/application/client');
    const client = new RDAPClient();

    const gen = client.streamBatch([{ type: 'domain', query: 'example.com' }]);
    expect(typeof gen[Symbol.asyncIterator]).toBe('function');
  });
});
