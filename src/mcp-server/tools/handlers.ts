/**
 * MCP tool request handlers for Claude Code memory server
 */

import { DatabaseQueries } from '../database/queries';

interface QueryMemoryArgs {
  sql: string;
  limit?: number;
}

export class ToolHandlers {
  constructor(private queries: DatabaseQueries) {}

  /**
   * Handle query_memory tool request - direct SQL access to conversation data
   */
  async handleQueryMemory(args: QueryMemoryArgs) {
    try {
      const results = await this.queries.executeRawQuery(args.sql, args.limit || 100);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query: args.sql,
            rowCount: results.length,
            results: results
          }, null, 2)
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            query: args.sql
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * Route tool requests to appropriate handlers
   */
  async handleToolRequest(name: string, args: any) {
    switch (name) {
      case 'query_memory':
        return await this.handleQueryMemory(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}