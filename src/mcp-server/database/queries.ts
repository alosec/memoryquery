/**
 * Database query implementations for Claude Code memory access
 */

import { DatabaseConnection } from './connection';
import { buildCursorConditions, getCursorOrdering, createMessageCursor } from './cursor-utils';
import type {
  DatabaseSchema,
  ConversationMessage,
  Session,
  ToolUsage,
  FileOperation,
  SearchOptions,
  SessionListOptions,
  ToolUsageOptions,
  FileHistoryOptions,
  RecentMessagesOptions,
  PaginatedResponse
} from './types';

export class DatabaseQueries {
  constructor(private db: DatabaseConnection) {}

  /**
   * Get database schema information
   */
  async getSchema(): Promise<DatabaseSchema[]> {
    const sql = `
      SELECT name, sql FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;
    return await this.db.all(sql);
  }

  /**
   * Get conversation history from specific sessions with cursor pagination
   */
  async getConversationHistory(
    sessionIds: string[], 
    options: { limit?: number; cursor?: string; direction?: 'before' | 'after' } = {}
  ): Promise<PaginatedResponse<ConversationMessage>> {
    const { limit = 100, cursor, direction = 'before' } = options;
    
    const placeholders = sessionIds.map(() => '?').join(',');
    const cursorCondition = buildCursorConditions(cursor, direction, 'm.timestamp', 'm.id');
    
    const sql = `
      SELECT 
        m.id,
        m.sessionId,
        m.type,
        m.timestamp,
        m.userText,
        m.assistantText,
        m.projectName,
        m.activeFile,
        tu.toolName,
        tu.parameters as toolParams,
        tur.output as toolOutput,
        tur.error as toolError
      FROM messages m
      LEFT JOIN tool_uses tu ON m.id = tu.messageId
      LEFT JOIN tool_use_results tur ON tu.id = tur.toolUseId
      WHERE m.sessionId IN (${placeholders})
      ${cursorCondition.condition}
      ${getCursorOrdering(direction, 'm.timestamp', 'm.id')}
      LIMIT ?
    `;
    
    const params = [...sessionIds, ...cursorCondition.params, limit + 1];
    const results = await this.db.all(sql, params);
    
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (data.length > 0) {
      const firstItem = data[0];
      const lastItem = data[data.length - 1];
      
      nextCursor = hasMore ? createMessageCursor(lastItem.timestamp, lastItem.id) : undefined;
      prevCursor = createMessageCursor(firstItem.timestamp, firstItem.id);
    }

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor
      }
    };
  }

  /**
   * Search for strings across conversation history
   */
  async findStringInHistory(
    queries: string[], 
    options: SearchOptions = {}
  ): Promise<PaginatedResponse<ConversationMessage>> {
    const { sessionIds, limit = 10, cursor, direction = 'before' } = options;
    
    const searchConditions = queries.map(() => `
      (m.userText LIKE ? OR m.assistantText LIKE ? OR 
       tu.parameters LIKE ? OR tur.output LIKE ?)
    `).join(' AND ');
    
    const sessionFilter = sessionIds?.length 
      ? `AND m.sessionId IN (${sessionIds.map(() => '?').join(',')})`
      : '';

    // Build cursor conditions
    const cursorCondition = buildCursorConditions(cursor, direction, 'm.timestamp', 'm.id');

    const sql = `
      SELECT 
        m.id,
        m.sessionId,
        m.type,
        m.timestamp,
        m.userText,
        m.assistantText,
        m.projectName,
        m.activeFile,
        tu.toolName,
        tur.output as toolOutput
      FROM messages m
      LEFT JOIN tool_uses tu ON m.id = tu.messageId
      LEFT JOIN tool_use_results tur ON tu.id = tur.toolUseId
      WHERE ${searchConditions} ${sessionFilter} ${cursorCondition.condition}
      ${getCursorOrdering(direction, 'm.timestamp', 'm.id')}
      LIMIT ?
    `;

    const searchParams = queries.flatMap(q => [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
    const params = [...searchParams, ...(sessionIds || []), ...cursorCondition.params, limit];
    
    const results = await this.db.all(sql, params);
    
    // Create cursors for pagination
    let nextCursor, prevCursor;
    if (results.length > 0) {
      const first = results[0];
      const last = results[results.length - 1];
      
      nextCursor = direction === 'before' 
        ? createMessageCursor(last.timestamp, last.id)
        : createMessageCursor(first.timestamp, first.id);
      prevCursor = direction === 'before'
        ? createMessageCursor(first.timestamp, first.id)
        : createMessageCursor(last.timestamp, last.id);
    }

    return {
      data: results,
      pagination: {
        hasMore: results.length === limit,
        nextCursor: results.length === limit ? nextCursor : undefined,
        prevCursor: cursor ? prevCursor : undefined
      }
    };
  }

  /**
   * Get list of sessions with metadata
   */
  async getSessionList(options: SessionListOptions = {}): Promise<PaginatedResponse<Session>> {
    const { projectPath, limit = 10, cursor, direction = 'before' } = options;
    
    const projectFilter = projectPath ? 'WHERE s.sessionPath LIKE ?' : '';
    
    // For sessions, we'll use the lastActivity timestamp for cursor pagination
    // First, get the base query results
    const sql = `
      SELECT 
        s.sessionId,
        s.sessionPath,
        s.created,
        COUNT(m.id) as messageCount,
        MAX(m.timestamp) as lastActivity,
        m.projectName
      FROM sessions s
      LEFT JOIN messages m ON s.sessionId = m.sessionId
      ${projectFilter}
      GROUP BY s.sessionId
      HAVING 1=1 ${cursor ? `AND MAX(m.timestamp) ${direction === 'before' ? '<' : '>'} ?` : ''}
      ORDER BY lastActivity ${direction === 'before' ? 'DESC' : 'ASC'}
      LIMIT ?
    `;
    
    let params = [];
    if (projectPath) params.push(`%${projectPath}%`);
    if (cursor) {
      const { timestamp } = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
      params.push(timestamp);
    }
    params.push(limit);
    
    const results = await this.db.all(sql, params);
    
    // Create cursors for pagination
    let nextCursor, prevCursor;
    if (results.length > 0) {
      const first = results[0];
      const last = results[results.length - 1];
      
      nextCursor = direction === 'before' 
        ? createMessageCursor(last.lastActivity, last.sessionId)
        : createMessageCursor(first.lastActivity, first.sessionId);
      prevCursor = direction === 'before'
        ? createMessageCursor(first.lastActivity, first.sessionId)
        : createMessageCursor(last.lastActivity, last.sessionId);
    }

    return {
      data: results,
      pagination: {
        hasMore: results.length === limit,
        nextCursor: results.length === limit ? nextCursor : undefined,
        prevCursor: cursor ? prevCursor : undefined
      }
    };
  }

  /**
   * Get tool usage history - extracts tool information from user tool_result messages
   */
  async getToolUsageHistory(options: ToolUsageOptions = {}): Promise<PaginatedResponse<ToolUsage>> {
    const { toolNames, sessionIds, limit = 5, cursor, direction = 'before' } = options;
    
    const sessionFilter = sessionIds?.length 
      ? `AND m.sessionId IN (${sessionIds.map(() => '?').join(',')})`
      : '';

    // Build cursor conditions
    const cursorCondition = buildCursorConditions(cursor, direction, 'm.timestamp', 'm.id');

    const sql = `
      SELECT 
        m.id,
        m.sessionId,
        m.timestamp,
        m.userText,
        m.projectName
      FROM messages m
      WHERE m.userText LIKE '%"tool_result"%'
      ${sessionFilter} ${cursorCondition.condition}
      ${getCursorOrdering(direction, 'm.timestamp', 'm.id')}
      LIMIT ?
    `;

    const params = [...(sessionIds || []), ...cursorCondition.params, limit + 1];
    const rawResults = await this.db.all(sql, params);
    
    // Parse JSON and extract tool usage information from tool results
    const results: any[] = [];
    for (const row of rawResults) {
      try {
        if (row.userText && row.userText.includes('tool_result')) {
          const userData = JSON.parse(row.userText);
          if (Array.isArray(userData)) {
            for (const item of userData) {
              if (item.type === 'tool_result') {
                // Extract tool name from the content or use generic label
                let toolName = 'unknown_tool';
                let output = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
                
                // Try to infer tool type from content patterns
                if (typeof item.content === 'string') {
                  const content = item.content;
                  if (content.includes('→') && content.includes('file')) {
                    toolName = 'Read';
                  } else if (content.includes('file has been updated')) {
                    toolName = 'Edit';
                  } else if (content.includes('Applied') && content.includes('edit')) {
                    toolName = 'Edit';
                  } else if (content.includes('> ') && (content.includes('npm') || content.includes('build'))) {
                    toolName = 'Bash';
                  } else if (content.startsWith('{') && content.includes('"data"')) {
                    toolName = 'MCP_Tool';
                  }
                }
                
                // Filter by tool names if specified
                if (!toolNames?.length || toolNames.includes(toolName)) {
                  results.push({
                    id: row.id,
                    sessionId: row.sessionId,
                    timestamp: row.timestamp,
                    toolName: toolName,
                    parameters: null,
                    output: output.length > 500 ? output.substring(0, 500) + '...' : output,
                    error: item.is_error ? output : null,
                    projectName: row.projectName
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip malformed JSON
        continue;
      }
    }

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    
    // Create cursors for pagination
    let nextCursor, prevCursor;
    if (data.length > 0) {
      const first = data[0];
      const last = data[data.length - 1];
      
      nextCursor = hasMore ? createMessageCursor(last.timestamp, last.id) : undefined;
      prevCursor = createMessageCursor(first.timestamp, first.id);
    }

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor: cursor ? prevCursor : undefined
      }
    };
  }

  /**
   * Get file operation history - parses JSON from messages table since tool_uses/tool_use_results are not populated
   */
  async getFileHistory(options: FileHistoryOptions = {}): Promise<PaginatedResponse<FileOperation>> {
    const { filePaths, sessionIds, limit = 5, cursor, direction = 'before' } = options;
    
    const sessionFilter = sessionIds?.length 
      ? `AND m.sessionId IN (${sessionIds.map(() => '?').join(',')})`
      : '';

    // Build cursor conditions
    const cursorCondition = buildCursorConditions(cursor, direction, 'm.timestamp', 'm.id');

    const sql = `
      SELECT 
        m.id,
        m.sessionId,
        m.timestamp,
        m.userText,
        m.projectName
      FROM messages m
      WHERE m.userText LIKE '%"tool_result"%' AND (
        m.userText LIKE '%→%' OR 
        m.userText LIKE '%file has been updated%' OR
        m.userText LIKE '%Applied%'
      )
      ${sessionFilter} ${cursorCondition.condition}
      ${getCursorOrdering(direction, 'm.timestamp', 'm.id')}
      LIMIT ?
    `;

    const params = [...(sessionIds || []), ...cursorCondition.params, limit + 1];
    const rawResults = await this.db.all(sql, params);
    
    // Parse JSON and extract file operation information
    const results: any[] = [];
    const fileTools = ['Read', 'Write', 'Edit', 'MultiEdit'];
    
    for (const row of rawResults) {
      try {
        // Parse assistant messages for file tool usage
        if (row.assistantText && row.assistantText.includes('tool_use')) {
          const assistantData = JSON.parse(row.assistantText);
          if (Array.isArray(assistantData)) {
            for (const item of assistantData) {
              if (item.type === 'tool_use' && fileTools.includes(item.name)) {
                const filePath = item.input?.file_path;
                if (!filePaths?.length || (filePath && filePaths.some(fp => filePath.includes(fp)))) {
                  results.push({
                    id: row.id,
                    sessionId: row.sessionId,
                    timestamp: row.timestamp,
                    toolName: item.name,
                    parameters: JSON.stringify(item.input || {}),
                    output: null,
                    projectName: row.projectName,
                    filePath: filePath
                  });
                }
              }
            }
          }
        }
        
        // Parse user messages for file tool results
        if (row.userText && row.userText.includes('tool_result')) {
          const userData = JSON.parse(row.userText);
          if (Array.isArray(userData)) {
            for (const item of userData) {
              if (item.type === 'tool_result' && typeof item.content === 'string') {
                // Check if this looks like a file operation result
                const content = item.content;
                if (content.includes('file has been updated') || 
                    content.includes('→') || // Read tool output format
                    content.includes('Applied') || // Edit tool output
                    content.length > 100) { // Likely file content
                  
                  results.push({
                    id: row.id,
                    sessionId: row.sessionId,
                    timestamp: row.timestamp,
                    toolName: 'file_result',
                    parameters: null,
                    output: content.length > 500 ? content.substring(0, 500) + '...' : content,
                    projectName: row.projectName
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip malformed JSON
        continue;
      }
    }

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    
    // Create cursors for pagination
    let nextCursor, prevCursor;
    if (data.length > 0) {
      const first = data[0];
      const last = data[data.length - 1];
      
      nextCursor = hasMore ? createMessageCursor(last.timestamp, last.id) : undefined;
      prevCursor = createMessageCursor(first.timestamp, first.id);
    }

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor: cursor ? prevCursor : undefined
      }
    };
  }

  /**
   * Get recent messages across all projects or filtered by project
   */
  async getRecentMessages(options: RecentMessagesOptions = {}): Promise<PaginatedResponse<ConversationMessage>> {
    const { 
      limit = 10, 
      cursor, 
      direction = 'before', 
      projectPath, 
      messageTypes,
      includeToolUse = true 
    } = options;

    // Build filters
    const projectFilter = projectPath ? 'AND s.sessionPath LIKE ?' : '';
    const typeFilter = messageTypes?.length 
      ? `AND m.type IN (${messageTypes.map(() => '?').join(',')})`
      : '';
    
    // Build cursor conditions
    const cursorCondition = buildCursorConditions(cursor, direction, 'm.timestamp', 'm.id');
    
    // Tool use joins
    const toolJoins = includeToolUse 
      ? `
        LEFT JOIN tool_uses tu ON m.id = tu.messageId
        LEFT JOIN tool_use_results tur ON tu.id = tur.toolUseId
      `
      : '';
    
    const toolFields = includeToolUse 
      ? `
        tu.toolName,
        tu.parameters as toolParams,
        tur.output as toolOutput,
        tur.error as toolError,
      `
      : '';

    const sql = `
      SELECT 
        m.id,
        m.sessionId,
        m.type,
        m.timestamp,
        m.userText,
        m.assistantText,
        m.projectName,
        m.activeFile,
        ${toolFields}
        s.sessionPath
      FROM messages m
      JOIN sessions s ON m.sessionId = s.sessionId
      ${toolJoins}
      WHERE 1=1 
      ${projectFilter}
      ${typeFilter}
      ${cursorCondition.condition}
      ${getCursorOrdering(direction, 'm.timestamp', 'm.id')}
      LIMIT ?
    `;

    const params = [
      ...(projectPath ? [`%${projectPath}%`] : []),
      ...(messageTypes || []),
      ...cursorCondition.params,
      limit + 1 // Get one extra to check if there are more
    ];

    const results = await this.db.all(sql, params);
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    // Generate pagination cursors
    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (data.length > 0) {
      const firstItem = data[0];
      const lastItem = data[data.length - 1];
      
      nextCursor = hasMore ? createMessageCursor(lastItem.timestamp, lastItem.id) : undefined;
      prevCursor = createMessageCursor(firstItem.timestamp, firstItem.id);
    }

    return {
      data,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor
      }
    };
  }

  /**
   * Get recent messages by project with smart project detection
   */
  async getRecentMessagesByProject(projectPath: string, limit: number = 10): Promise<ConversationMessage[]> {
    const sql = `
      SELECT 
        m.id,
        m.sessionId,
        m.type,
        m.timestamp,
        m.userText,
        m.assistantText,
        m.projectName,
        m.activeFile,
        tu.toolName,
        tu.parameters as toolParams,
        tur.output as toolOutput,
        tur.error as toolError
      FROM messages m
      JOIN sessions s ON m.sessionId = s.sessionId
      LEFT JOIN tool_uses tu ON m.id = tu.messageId
      LEFT JOIN tool_use_results tur ON tu.id = tur.toolUseId
      WHERE s.sessionPath LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `;

    return await this.db.all(sql, [`%${projectPath}%`, limit]);
  }
}