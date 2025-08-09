/**
 * Schema mapper to transform parsed JSONL data to Claude Code database format
 * Maps from ClaudeCodeMessage to database record structures
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  ClaudeCodeMessage, 
  DatabaseSession, 
  DatabaseMessage, 
  DatabaseToolUse, 
  DatabaseToolResult,
  ContentBlock,
  ToolUseContent,
  ToolResultContent,
  TransformResult
} from '../claude-code/types.js';

/**
 * Transform parsed messages to database format
 */
export function transformToDatabase(
  messages: ClaudeCodeMessage[], 
  sessionId: string, 
  sessionPath: string
): TransformResult {
  
  const result: TransformResult = {
    session: createDatabaseSession(sessionId, sessionPath, messages),
    messages: [],
    toolUses: [],
    toolResults: [],
    attachments: [],
    envInfo: []
  };

  for (const message of messages) {
    const dbMessage = transformMessage(message, sessionId);
    result.messages.push(dbMessage);

    // Extract tool uses and results from assistant messages
    if (message.type === 'assistant') {
      const { toolUses, toolResults } = extractToolData(message, dbMessage.id);
      result.toolUses.push(...toolUses);
      result.toolResults.push(...toolResults);
    }
  }

  return result;
}

/**
 * Create database session record
 */
function createDatabaseSession(
  sessionId: string, 
  sessionPath: string, 
  messages: ClaudeCodeMessage[]
): DatabaseSession {
  
  // Find earliest and latest timestamps
  const timestamps = messages.map(m => new Date(m.timestamp)).sort();
  const createdAt = timestamps[0]?.toISOString() || new Date().toISOString();
  const lastActivityAt = timestamps[timestamps.length - 1]?.toISOString() || createdAt;

  return {
    id: sessionId,
    path: sessionPath,
    created_at: createdAt,
    last_activity_at: lastActivityAt
  };
}

/**
 * Transform a message to database format
 */
function transformMessage(message: ClaudeCodeMessage, sessionId: string): DatabaseMessage {
  const messageId = getMessageId(message);
  
  const baseMessage: DatabaseMessage = {
    id: messageId,
    session_id: sessionId,
    type: message.type,
    timestamp: message.timestamp,
    project_name: message.sessionMetadata?.project_path || undefined
  };

  // Add type-specific content
  switch (message.type) {
    case 'summary':
      return {
        ...baseMessage,
        assistant_text: message.summary
      };
      
    case 'user':
      const userText = message.userText ?? extractTextFromContent(message.content) ?? undefined;
      if (process.env.DEBUG_CONTENT && !userText && message.content) {
        console.debug('USER_CONTENT_DEBUG:', { 
          messageId: baseMessage.id,
          hasUserText: !!message.userText,
          hasContent: !!message.content,
          contentLength: Array.isArray(message.content) ? message.content.length : 'not array',
          contentTypes: Array.isArray(message.content) ? message.content.map(c => c?.type) : 'not array'
        });
      }
      return {
        ...baseMessage,
        user_text: userText
      };
      
    case 'assistant':
      const assistantText = message.assistantText ?? extractTextFromContent(message.content) ?? undefined;
      if (process.env.DEBUG_CONTENT && !assistantText && message.content) {
        console.debug('ASSISTANT_CONTENT_DEBUG:', { 
          messageId: baseMessage.id,
          hasAssistantText: !!message.assistantText,
          hasContent: !!message.content,
          contentLength: Array.isArray(message.content) ? message.content.length : 'not array',
          contentTypes: Array.isArray(message.content) ? message.content.map(c => c?.type) : 'not array'
        });
      }
      return {
        ...baseMessage,
        assistant_text: assistantText
      };
      
    default:
      return baseMessage;
  }
}

/**
 * Extract tool uses and results from assistant message
 */
function extractToolData(
  message: ClaudeCodeMessage, 
  messageId: string
): { toolUses: DatabaseToolUse[]; toolResults: DatabaseToolResult[] } {
  
  const toolUses: DatabaseToolUse[] = [];
  const toolResults: DatabaseToolResult[] = [];

  if (message.type !== 'assistant' || !message.content) {
    return { toolUses, toolResults };
  }

  // Extract tool uses from content
  const toolUseBlocks = message.content.filter(block => block.type === 'tool_use') as ToolUseContent[];
  
  for (const toolUse of toolUseBlocks) {
    const dbToolUse: DatabaseToolUse = {
      id: toolUse.id,
      message_id: messageId,
      tool_name: toolUse.name,
      parameters: JSON.stringify(toolUse.input)
    };
    toolUses.push(dbToolUse);
  }

  // Extract tool results from content
  const toolResultBlocks = message.content.filter(block => block.type === 'tool_result') as ToolResultContent[];
  
  for (const toolResult of toolResultBlocks) {
    const dbToolResult: DatabaseToolResult = {
      id: uuidv4(),
      tool_use_id: toolResult.tool_use_id,
      output: toolResult.is_error ? undefined : toolResult.content || undefined,
      error: toolResult.is_error ? toolResult.content || undefined : undefined
    };
    toolResults.push(dbToolResult);
  }

  // Also check legacy tool_uses and tool_results arrays if present
  if (message.tool_uses) {
    for (const toolUse of message.tool_uses) {
      const dbToolUse: DatabaseToolUse = {
        id: toolUse.id,
        message_id: messageId,
        tool_name: toolUse.name,
        parameters: JSON.stringify(toolUse.input)
      };
      toolUses.push(dbToolUse);
    }
  }

  if (message.tool_results) {
    for (const toolResult of message.tool_results) {
      const dbToolResult: DatabaseToolResult = {
        id: uuidv4(),
        tool_use_id: toolResult.tool_use_id,
        output: toolResult.is_error ? undefined : toolResult.content || undefined,
        error: toolResult.is_error ? toolResult.content || undefined : undefined
      };
      toolResults.push(dbToolResult);
    }
  }

  return { toolUses, toolResults };
}

/**
 * Get message ID using fallback hierarchy
 */
function getMessageId(message: ClaudeCodeMessage): string {
  return message.id || 
         message.uuid || 
         message.leafUuid || 
         message.fallback_id || 
         uuidv4();
}

/**
 * Extract text content from content blocks
 */
function extractTextFromContent(content?: ContentBlock[]): string | null {
  if (!content || !Array.isArray(content)) {
    return null;
  }

  const textBlocks = content.filter(block => block.type === 'text');
  
  if (textBlocks.length === 0) {
    return null;
  }

  return textBlocks.map(block => (block as any).text).join('\n');
}

/**
 * Validate transformed data before database insertion
 */
export function validateTransformResult(result: TransformResult): void {
  // Validate session
  if (!result.session.id || !result.session.path) {
    throw new Error('Invalid session: missing id or path');
  }

  // Validate messages
  for (const message of result.messages) {
    if (!message.id || !message.session_id || !message.type || !message.timestamp) {
      throw new Error(`Invalid message: missing required fields - ${JSON.stringify(message)}`);
    }
  }

  // Validate tool uses
  for (const toolUse of result.toolUses) {
    if (!toolUse.id || !toolUse.message_id || !toolUse.tool_name) {
      throw new Error(`Invalid tool use: missing required fields - ${JSON.stringify(toolUse)}`);
    }
  }

  // Validate tool results
  for (const toolResult of result.toolResults) {
    if (!toolResult.id || !toolResult.tool_use_id) {
      throw new Error(`Invalid tool result: missing required fields - ${JSON.stringify(toolResult)}`);
    }
  }
}

/**
 * Get project name from session path
 */
export function extractProjectName(sessionPath: string): string | null {
  const parts = sessionPath.split('/');
  const projectsIndex = parts.findIndex(part => part === 'projects');
  
  if (projectsIndex === -1 || projectsIndex >= parts.length - 1) {
    return null;
  }
  
  return parts[projectsIndex + 1];
}