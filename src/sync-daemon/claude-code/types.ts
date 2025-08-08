/**
 * TypeScript types for Claude Code JSONL format
 * Adapted from cafe-db-sync comprehensive type definitions
 */

// Base message types
export type MessageType = 'summary' | 'user' | 'assistant';

// Content types for different message parts
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content?: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

// Usage metadata
export interface UsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

// Session metadata
export interface SessionMetadata {
  session_id: string;
  project_path?: string;
  created_at?: string;
}

// Base message interface
export interface BaseMessage {
  id?: string;
  uuid?: string;
  leafUuid?: string;
  fallback_id?: string;
  timestamp: string;
  type: MessageType;
  sessionMetadata?: SessionMetadata;
}

// Summary message
export interface SummaryMessage extends BaseMessage {
  type: 'summary';
  summary: string;
  usage?: UsageMetadata;
}

// User message
export interface UserMessage extends BaseMessage {
  type: 'user';
  content: ContentBlock[];
  userText?: string;
}

// Assistant message
export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  content: ContentBlock[];
  assistantText?: string;
  usage?: UsageMetadata;
  tool_uses?: ToolUseContent[];
  tool_results?: ToolResultContent[];
}

// Union type for all message types
export type ClaudeCodeMessage = SummaryMessage | UserMessage | AssistantMessage;

// Tool names enumeration (comprehensive list from cafe-db-sync)
export type ToolName = 
  | 'Read'
  | 'Write' 
  | 'Edit'
  | 'MultiEdit'
  | 'Bash'
  | 'LS'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'WebSearch'
  | 'TodoWrite'
  | 'Task'
  | 'NotebookEdit'
  | 'ExitPlanMode'
  | string; // Allow unknown tool names

// Database-related types
export interface DatabaseSession {
  id: string;
  path: string;
  created_at: string;
  last_activity_at: string;
}

export interface DatabaseMessage {
  id: string;
  session_id: string;
  type: MessageType;
  timestamp: string;
  user_text?: string;
  assistant_text?: string;
  project_name?: string;
}

export interface DatabaseToolUse {
  id: string;
  message_id: string;
  tool_name: string;
  parameters: string; // JSON string
}

export interface DatabaseToolResult {
  id: string;
  tool_use_id: string;
  output?: string;
  error?: string;
}

// Transform result type for schema mapping
export interface TransformResult {
  session: DatabaseSession;
  messages: DatabaseMessage[];
  toolUses: DatabaseToolUse[];
  toolResults: DatabaseToolResult[];
  attachments: any[];
  envInfo: any[];
}

// Execute result type for database operations
export interface ExecuteResult {
  messagesProcessed: number;
  messagesInserted: number;
  messagesUpdated: number;
  toolUsesInserted: number;
  toolResultsInserted: number;
  errors: Error[];
  sessionId: string;
  sessionPath: string;
}

// Configuration types
export interface SyncConfig {
  projectsPath: string;
  dbPath: string;
  watchDebounce?: number;
  maxRetries?: number;
}

// File processing types
export interface FileProcessingResult {
  filePath: string;
  sessionId: string;
  messages: ClaudeCodeMessage[];
  executeResult?: ExecuteResult;
  error?: Error;
}