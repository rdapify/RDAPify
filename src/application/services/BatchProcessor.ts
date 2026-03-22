/**
 * Batch processor for efficient multiple RDAP queries
 * @module application/services/BatchProcessor
 */

import type { RDAPClient } from '../client/RDAPClient';
import type { QueryTypeLiteral, QueryResult, BatchQueryResult } from '../../shared/types/generics';

/**
 * Batch query request
 */
export interface BatchQueryRequest<T extends QueryTypeLiteral = QueryTypeLiteral> {
  type: T;
  query: string;
  id?: string;
  /** Required when type is 'entity' — RDAP server base URL */
  serverUrl?: string;
}

/**
 * Batch processing options
 */
export interface BatchOptions {
  /** Maximum concurrent requests */
  concurrency?: number;
  /** Continue on error or stop */
  continueOnError?: boolean;
  /** Timeout for entire batch (ms) */
  timeout?: number;
}

/**
 * Options for the streaming batch processor
 */
export interface StreamBatchOptions {
  /** Maximum concurrent requests per chunk (default: 5) */
  concurrency?: number;
  /** Continue yielding on per-query errors (default: true) */
  continueOnError?: boolean;
}

/**
 * Batch processor for efficient multiple queries.
 *
 * @remarks Direct import of `BatchProcessor` is **evolving** — prefer using
 * `client.streamBatch()` (streaming) or `client.getBatchProcessor().processBatch()`
 * (collect-all) from the `RDAPClient` instance.  In v1.0.0 `processBatch` will
 * be a first-class method on `RDAPClient` and this class may be internalized.
 */
export class BatchProcessor {
  private readonly client: RDAPClient;

  constructor(client: RDAPClient) {
    this.client = client;
  }

  /**
   * Processes multiple queries in parallel with concurrency control
   */
  async processBatch<T extends QueryTypeLiteral>(
    requests: BatchQueryRequest<T>[],
    options: BatchOptions = {}
  ): Promise<BatchQueryResult<T>[]> {
    const {
      concurrency = 5,
      continueOnError = true,
    } = options;

    const results: BatchQueryResult<T>[] = [];
    const queue = [...requests];
    const inProgress: Promise<void>[] = [];

    const processOne = async (request: BatchQueryRequest<T>): Promise<void> => {
      const startTime = Date.now();
      
      try {
        let result: QueryResult<T>;
        
        switch (request.type) {
          case 'domain':
            result = await this.client.domain(request.query) as QueryResult<T>;
            break;
          case 'ip':
            result = await this.client.ip(request.query) as QueryResult<T>;
            break;
          case 'asn':
            result = await this.client.asn(request.query) as QueryResult<T>;
            break;
          case 'nameserver':
            result = await this.client.nameserver(request.query) as QueryResult<T>;
            break;
          case 'entity':
            if (!request.serverUrl) {
              throw new Error(`Entity queries require a serverUrl. Set { type: 'entity', query: '${request.query}', serverUrl: 'https://...' }`);
            }
            result = await this.client.entity(request.query, request.serverUrl) as QueryResult<T>;
            break;
          default:
            throw new Error(`Unknown query type: ${request.type}`);
        }

        results.push({
          type: request.type,
          query: request.query,
          result,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          type: request.type,
          query: request.query,
          error: error as Error,
          duration: Date.now() - startTime,
        });

        if (!continueOnError) {
          throw error;
        }
      }
    };

    // Process with concurrency control
    while (queue.length > 0 || inProgress.length > 0) {
      // Fill up to concurrency limit
      while (inProgress.length < concurrency && queue.length > 0) {
        const request = queue.shift()!;
        const promise = processOne(request);
        inProgress.push(promise);

        // Remove from inProgress when done (use then/catch to avoid dangling rejected promise)
        const cleanup = () => {
          const index = inProgress.indexOf(promise);
          if (index > -1) {
            inProgress.splice(index, 1);
          }
        };
        promise.then(cleanup, cleanup);
      }

      // Wait for at least one to complete
      if (inProgress.length > 0) {
        await Promise.race(inProgress);
      }
    }

    return results;
  }

  /**
   * Processes queries with timeout
   */
  async processBatchWithTimeout<T extends QueryTypeLiteral>(
    requests: BatchQueryRequest<T>[],
    timeoutMs: number,
    options: Omit<BatchOptions, 'timeout'> = {}
  ): Promise<BatchQueryResult<T>[]> {
    return Promise.race([
      this.processBatch(requests, options),
      new Promise<BatchQueryResult<T>[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Batch processing timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Executes a single query request and returns the result.
   * Shared by processBatch and streamBatch.
   */
  private async executeOne<T extends QueryTypeLiteral>(
    request: BatchQueryRequest<T>
  ): Promise<QueryResult<T>> {
    switch (request.type) {
      case 'domain':
        return this.client.domain(request.query) as Promise<QueryResult<T>>;
      case 'ip':
        return this.client.ip(request.query) as Promise<QueryResult<T>>;
      case 'asn':
        return this.client.asn(request.query) as Promise<QueryResult<T>>;
      case 'nameserver':
        return this.client.nameserver(request.query) as Promise<QueryResult<T>>;
      case 'entity':
        if (!request.serverUrl) {
          throw new Error(
            `Entity queries require a serverUrl. Set { type: 'entity', query: '${request.query}', serverUrl: 'https://...' }`
          );
        }
        return this.client.entity(request.query, request.serverUrl) as Promise<QueryResult<T>>;
      default:
        throw new Error(`Unknown query type: ${(request as BatchQueryRequest).type}`);
    }
  }

  /**
   * Streams query results as they complete, yielding one result at a time.
   *
   * Unlike `processBatch`, which collects all results before returning,
   * `streamBatch` is an async generator that yields each result immediately
   * after it resolves.  This makes it suitable for large request sets
   * (1000+ queries) because at most `concurrency` queries are ever in-flight
   * simultaneously — the rest remain in the queue until the consumer is ready.
   *
   * @param requests - Queries to execute
   * @param options  - Concurrency and error-handling options
   *
   * @example
   * ```typescript
   * for await (const result of client.streamBatch(requests)) {
   *   if (result.error) console.error(result.query, result.error.message);
   *   else console.log(result.query, result.result);
   * }
   * ```
   */
  async *streamBatch<T extends QueryTypeLiteral>(
    requests: BatchQueryRequest<T>[],
    options: StreamBatchOptions = {}
  ): AsyncGenerator<BatchQueryResult<T>, void, unknown> {
    const { concurrency = 5, continueOnError = true } = options;
    const queue = [...requests];

    while (queue.length > 0) {
      // Take the next chunk (up to concurrency)
      const chunk = queue.splice(0, concurrency);

      // Run all requests in the chunk concurrently
      const results = await Promise.all(
        chunk.map(async (request): Promise<BatchQueryResult<T>> => {
          const t0 = Date.now();
          try {
            const result = await this.executeOne(request);
            return {
              type: request.type,
              query: request.query,
              result,
              duration: Date.now() - t0,
            } as BatchQueryResult<T>;
          } catch (error) {
            if (!continueOnError) throw error;
            return {
              type: request.type,
              query: request.query,
              error: error as Error,
              duration: Date.now() - t0,
            } as BatchQueryResult<T>;
          }
        })
      );

      // Yield each result — the consumer's `for await` provides back-pressure
      for (const result of results) {
        yield result;
      }
    }
  }

  /**
   * Gets batch processing statistics
   */
  analyzeBatchResults<T extends QueryTypeLiteral>(
    results: BatchQueryResult<T>[]
  ): {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
    totalDuration: number;
    successRate: number;
  } {
    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = results.length > 0 ? totalDuration / results.length : 0;

    return {
      total: results.length,
      successful,
      failed,
      averageDuration,
      totalDuration,
      successRate: results.length > 0 ? (successful / results.length) * 100 : 0,
    };
  }
}
