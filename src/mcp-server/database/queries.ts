/**
 * Database query implementations for Claude Code memory access
 */

import { DatabaseConnection } from './connection';
import type { QueryResult } from './types';

interface SqlQueryError extends Error {
  code?: string;
  errno?: number;
}

export class DatabaseQueries {
  constructor(private db: DatabaseConnection) {}

  /**
   * Execute raw SQL query with safety validation
   * Only SELECT statements are allowed
   */
  async executeRawQuery(sql: string, limit: number = 100): Promise<QueryResult[]> {
    // Validate SQL query safety
    const trimmedSql = sql.trim().toLowerCase();
    
    // Only allow SELECT statements
    if (!trimmedSql.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for safety');
    }
    
    // Block potentially dangerous keywords
    const dangerousKeywords = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate', 'replace'];
    for (const keyword of dangerousKeywords) {
      if (trimmedSql.includes(keyword.toLowerCase())) {
        throw new Error(`Dangerous keyword '${keyword}' not allowed in queries`);
      }
    }
    
    // Ensure limit is applied
    let finalSql = sql;
    if (!trimmedSql.includes('limit')) {
      finalSql += ` LIMIT ${Math.min(limit, 1000)}`;
    }
    
    try {
      const results = await this.db.all(finalSql);
      return results || [];
    } catch (error: any) {
      const sqlError = error as SqlQueryError;
      throw new Error(`SQL execution error: ${sqlError.message}`);
    }
  }
}