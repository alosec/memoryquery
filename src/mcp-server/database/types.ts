/**
 * Simplified TypeScript interfaces for query_memory tool
 */

export interface QueryResult {
  [key: string]: any;
}

export interface SqlQueryResult {
  query: string;
  rowCount: number;
  results: QueryResult[];
}

export interface SqlErrorResult {
  error: string;
  query: string;
}