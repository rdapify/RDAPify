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
 * Batch processor for efficient multiple queries
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

        // Remove from inProgress when done
        promise.finally(() => {
          const index = inProgress.indexOf(promise);
          if (index > -1) {
            inProgress.splice(index, 1);
          }
        });
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
