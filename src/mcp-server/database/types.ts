/**
 * TypeScript interfaces for Claude Code conversation database
 */

export interface DatabaseSchema {
  name: string;
  sql: string;
}

export interface ConversationMessage {
  sessionId: string;
  type: string;
  timestamp: string;
  userText?: string;
  assistantText?: string;
  projectName?: string;
  activeFile?: string;
  toolName?: string;
  toolParams?: string;
  toolOutput?: string;
  toolError?: string;
}

export interface Session {
  sessionId: string;
  sessionPath: string;
  created: string;
  messageCount: number;
  lastActivity: string;
  projectName?: string;
}

export interface ToolUsage {
  sessionId: string;
  timestamp: string;
  toolName: string;
  parameters: string;
  output?: string;
  error?: string;
  projectName?: string;
}

export interface FileOperation {
  sessionId: string;
  timestamp: string;
  toolName: 'Read' | 'Write' | 'Edit' | 'MultiEdit';
  parameters: string;
  output: string;
  projectName?: string;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
}

export interface CursorOptions {
  limit?: number;
  cursor?: string; // Base64 encoded timestamp cursor
  direction?: 'before' | 'after'; // Navigate before or after cursor
}

export interface RecentMessagesOptions extends CursorOptions {
  projectPath?: string;
  messageTypes?: ('user' | 'assistant' | 'summary')[];
  includeToolUse?: boolean;
}

export interface SearchOptions extends CursorOptions {
  sessionIds?: string[];
}

export interface SessionListOptions extends CursorOptions {
  projectPath?: string;
}

export interface ToolUsageOptions extends CursorOptions {
  toolNames?: string[];
  sessionIds?: string[];
}

export interface FileHistoryOptions extends CursorOptions {
  filePaths?: string[];
  sessionIds?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    prevCursor?: string;
    totalCount?: number;
  };
}