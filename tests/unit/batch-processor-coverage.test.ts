/**
 * Additional coverage tests for BatchProcessor
 */

import { BatchProcessor } from '../../src/application/services/BatchProcessor';
import type { RDAPClient } from '../../src/application/client';

function makeClient(overrides: {
  domain?: jest.Mock;
  ip?: jest.Mock;
  asn?: jest.Mock;
  nameserver?: jest.Mock;
  entity?: jest.Mock;
} = {}): RDAPClient {
  const makeResp = (type: string) => ({ query: 'test', objectClass: type, status: [], metadata: { source: 't', timestamp: '', cached: false } });
  return {
    domain: overrides.domain ?? jest.fn().mockResolvedValue(makeResp('domain')),
    ip: overrides.ip ?? jest.fn().mockResolvedValue(makeResp('ip network')),
    asn: overrides.asn ?? jest.fn().mockResolvedValue(makeResp('autnum')),
    nameserver: overrides.nameserver ?? jest.fn().mockResolvedValue(makeResp('nameserver')),
    entity: overrides.entity ?? jest.fn().mockResolvedValue(makeResp('entity')),
  } as unknown as RDAPClient;
}

describe('BatchProcessor.processBatch() — additional branches', () => {
  it('processes domain, ip, asn, nameserver query types', async () => {
    const mockDomain = jest.fn().mockResolvedValue({ query: 'a', objectClass: 'domain', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const mockIp = jest.fn().mockResolvedValue({ query: 'b', objectClass: 'ip network', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const mockAsn = jest.fn().mockResolvedValue({ query: 'c', objectClass: 'autnum', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const mockNs = jest.fn().mockResolvedValue({ query: 'd', objectClass: 'nameserver', status: [], metadata: { source: 't', timestamp: '', cached: false } });

    const processor = new BatchProcessor(makeClient({ domain: mockDomain, ip: mockIp, asn: mockAsn, nameserver: mockNs }));
    const results = await processor.processBatch([
      { type: 'domain', query: 'example.com' },
      { type: 'ip', query: '8.8.8.8' },
      { type: 'asn', query: 'AS15169' },
      { type: 'nameserver', query: 'ns1.example.com' },
    ]);

    expect(results).toHaveLength(4);
    expect(mockDomain).toHaveBeenCalledWith('example.com');
    expect(mockIp).toHaveBeenCalledWith('8.8.8.8');
    expect(mockAsn).toHaveBeenCalledWith('AS15169');
    expect(mockNs).toHaveBeenCalledWith('ns1.example.com');
  });

  it('processes entity query with serverUrl', async () => {
    const mockEntity = jest.fn().mockResolvedValue({ query: 'e', objectClass: 'entity', status: [], metadata: { source: 't', timestamp: '', cached: false } });
    const processor = new BatchProcessor(makeClient({ entity: mockEntity }));

    const results = await processor.processBatch([
      { type: 'entity', query: 'HANDLE-1', serverUrl: 'https://rdap.example.com' },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.error).toBeUndefined();
    expect(mockEntity).toHaveBeenCalledWith('HANDLE-1', 'https://rdap.example.com');
  });

  it('entity query without serverUrl captures error (continueOnError:true)', async () => {
    const processor = new BatchProcessor(makeClient());
    const results = await processor.processBatch([
      { type: 'entity', query: 'HANDLE-1' },
    ]);
    expect(results[0]?.error?.message).toContain('serverUrl');
  });

  it('stops on first error when continueOnError: false', async () => {
    const mockDomain = jest.fn().mockRejectedValue(new Error('always fails'));
    const processor = new BatchProcessor(makeClient({ domain: mockDomain }));

    await expect(
      processor.processBatch([
        { type: 'domain', query: 'bad.com' },
      ], { continueOnError: false })
    ).rejects.toThrow('always fails');
  });

  it('processes with concurrency=1 (sequential)', async () => {
    const order: number[] = [];
    const mockDomain = jest.fn().mockImplementation(async (_: string, idx: number) => {
      order.push(idx);
      return { query: 'x', objectClass: 'domain', status: [], metadata: { source: 't', timestamp: '', cached: false } };
    });
    // index tracking not available on domain call, just test basic correctness
    const processor = new BatchProcessor(makeClient({ domain: jest.fn().mockResolvedValue({ query: 'x', objectClass: 'domain', status: [], metadata: { source: 't', timestamp: '', cached: false } }) }));
    const results = await processor.processBatch(
      Array.from({ length: 5 }, (_, i) => ({ type: 'domain' as const, query: `d${i}.com` })),
      { concurrency: 1 }
    );
    expect(results).toHaveLength(5);
    void mockDomain; void order;
  });

  it('returns empty array for empty requests', async () => {
    const processor = new BatchProcessor(makeClient());
    const results = await processor.processBatch([]);
    expect(results).toHaveLength(0);
  });

  it('processBatchWithTimeout() resolves within time limit', async () => {
    const processor = new BatchProcessor(makeClient());
    const results = await processor.processBatchWithTimeout(
      [{ type: 'domain', query: 'example.com' }],
      5000
    );
    expect(results).toHaveLength(1);
  });

  it('processBatchWithTimeout() rejects when timeout expires', async () => {
    const slowClient = {
      ...makeClient(),
      domain: jest.fn().mockImplementation(() => new Promise(() => {})), // never resolves
    } as unknown as RDAPClient;

    const processor = new BatchProcessor(slowClient);
    await expect(
      processor.processBatchWithTimeout([{ type: 'domain', query: 'example.com' }], 50)
    ).rejects.toThrow('timeout');
  });

  it('analyzeBatchResults() handles mix of successes and failures', async () => {
    const processor = new BatchProcessor(makeClient());
    const results = [
      { type: 'domain' as const, query: 'a.com', result: {} as any, duration: 100 },
      { type: 'domain' as const, query: 'b.com', error: new Error('fail'), duration: 200 },
      { type: 'domain' as const, query: 'c.com', result: {} as any, duration: 300 },
    ];

    const stats = processor.analyzeBatchResults(results);
    expect(stats.total).toBe(3);
    expect(stats.successful).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.successRate).toBeCloseTo(66.67, 1);
    expect(stats.averageDuration).toBeCloseTo(200);
    expect(stats.totalDuration).toBe(600);
  });

  it('analyzeBatchResults() returns 0 successRate for empty array', () => {
    const processor = new BatchProcessor(makeClient());
    const stats = processor.analyzeBatchResults([]);
    expect(stats.total).toBe(0);
    expect(stats.successRate).toBe(0);
  });
});
