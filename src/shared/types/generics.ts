/**
 * Generic type utilities for RDAPify
 * @module types/generics
 */

import type { DomainResponse, IPResponse, ASNResponse } from './responses';

/**
 * Query type literals
 */
export type QueryTypeLiteral = 'domain' | 'ip' | 'asn';

/**
 * Maps query type to response type
 */
export type QueryResultMap = {
  domain: DomainResponse;
  ip: IPResponse;
  asn: ASNResponse;
};

/**
 * Gets the response type for a given query type
 */
export type QueryResult<T extends QueryTypeLiteral> = QueryResultMap[T];

/**
 * Extracts metadata type from response
 */
export type ResponseMetadata<T extends DomainResponse | IPResponse | ASNResponse> = T['metadata'];

/**
 * Makes specific fields optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Makes specific fields required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extracts promise type
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Type-safe query options
 */
export interface TypedQueryOptions<T extends QueryTypeLiteral> {
  type: T;
  query: string;
  cache?: boolean;
  includeRaw?: boolean;
}

/**
 * Batch query result
 */
export type BatchQueryResult<T extends QueryTypeLiteral> = {
  type: T;
  query: string;
  result?: QueryResult<T>;
  error?: Error;
  duration: number;
};
