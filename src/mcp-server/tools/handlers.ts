/**
 * MCP tool request handlers for Claude Code memory server
 */

import { DatabaseQueries } from '../database/queries';

export class ToolHandlers {
  constructor(private queries: DatabaseQueries) {}

  /**
   * Handle get_database_schema tool request
   */
  async handleGetDatabaseSchema(args: any) {
    const schema = await this.queries.getSchema();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(schema, null, 2)
      }]
    };
  }

  /**
   * Handle get_session_messages tool request
   */
  async handleGetSessionMessages(args: any) {
    const history = await this.queries.getConversationHistory(
      args.session_ids as string[],
      {
        limit: args.limit as number,
        cursor: args.cursor as string,
        direction: args.direction as 'before' | 'after'
      }
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(history, null, 2)
      }]
    };
  }

  /**
   * Handle find_string_in_history tool request
   */
  async handleFindStringInHistory(args: any) {
    const searchResults = await this.queries.findStringInHistory(
      args.queries as string[],
      {
        sessionIds: args.session_ids as string[],
        limit: args.limit as number,
        cursor: args.cursor as string,
        direction: args.direction as 'before' | 'after'
      }
    );
    return {
      content: [{
        type: 'text', 
        text: JSON.stringify(searchResults, null, 2)
      }]
    };
  }

  /**
   * Handle get_session_list tool request
   */
  async handleGetSessionList(args: any) {
    const sessions = await this.queries.getSessionList({
      projectPath: args.project_path as string,
      limit: args.limit as number,
      cursor: args.cursor as string,
      direction: args.direction as 'before' | 'after'
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(sessions, null, 2)
      }]
    };
  }

  /**
   * Handle get_tool_usage_history tool request
   */
  async handleGetToolUsageHistory(args: any) {
    const toolHistory = await this.queries.getToolUsageHistory({
      toolNames: args.tool_names as string[],
      sessionIds: args.session_ids as string[],
      limit: args.limit as number,
      cursor: args.cursor as string,
      direction: args.direction as 'before' | 'after'
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(toolHistory, null, 2)
      }]
    };
  }

  /**
   * Handle get_file_history tool request
   */
  async handleGetFileHistory(args: any) {
    const fileHistory = await this.queries.getFileHistory({
      filePaths: args.file_paths as string[],
      sessionIds: args.session_ids as string[],
      limit: args.limit as number,
      cursor: args.cursor as string,
      direction: args.direction as 'before' | 'after'
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(fileHistory, null, 2)
      }]
    };
  }

  /**
   * Handle get_recent_messages tool request
   */
  async handleGetRecentMessages(args: any) {
    const result = await this.queries.getRecentMessages({
      limit: args.limit as number,
      cursor: args.cursor as string,
      direction: args.direction as 'before' | 'after',
      projectPath: args.project_path as string,
      messageTypes: args.message_types as ('user' | 'assistant' | 'summary')[],
      includeToolUse: args.include_tool_use as boolean
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Handle get_recent_messages_by_project tool request
   */
  async handleGetRecentMessagesByProject(args: any) {
    const messages = await this.queries.getRecentMessagesByProject(
      args.project_path as string,
      args.limit as number
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(messages, null, 2)
      }]
    };
  }

  /**
   * Route tool requests to appropriate handlers
   */
  async handleToolRequest(name: string, args: any) {
    switch (name) {
      case 'get_database_schema':
        return await this.handleGetDatabaseSchema(args);
      
      case 'get_session_messages':
        return await this.handleGetSessionMessages(args);
      
      case 'find_string_in_history':
        return await this.handleFindStringInHistory(args);
      
      case 'get_session_list':
        return await this.handleGetSessionList(args);
      
      case 'get_tool_usage_history':
        return await this.handleGetToolUsageHistory(args);
      
      case 'get_file_history':
        return await this.handleGetFileHistory(args);
      
      case 'get_recent_messages':
        return await this.handleGetRecentMessages(args);
      
      case 'get_recent_messages_by_project':
        return await this.handleGetRecentMessagesByProject(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}