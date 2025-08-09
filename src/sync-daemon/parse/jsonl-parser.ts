/**
 * JSONL parser for Claude Code conversation files
 * Handles raw line parsing and message extraction
 */

import { readFileSync } from 'fs';
import { ClaudeCodeMessage } from '../claude-code/types.js';

export interface ParseResult {
  messages: ClaudeCodeMessage[];
  errors: Error[];
  linesProcessed: number;
  validMessages: number;
}

/**
 * Parse a JSONL file and extract Claude Code messages
 */
export function parseJsonlFile(filePath: string): ParseResult {
  const result: ParseResult = {
    messages: [],
    errors: [],
    linesProcessed: 0,
    validMessages: 0
  };

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    result.linesProcessed = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      try {
        const parsed = parseJsonlLine(line, i + 1);
        if (parsed) {
          result.messages.push(parsed);
          result.validMessages++;
        }
      } catch (error) {
        result.errors.push(new Error(`Line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  } catch (error) {
    result.errors.push(new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
  }

  return result;
}

/**
 * Parse a single JSONL line
 */
export function parseJsonlLine(line: string, lineNumber?: number): ClaudeCodeMessage | null {
  if (!line.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(line);
    
    // Validate required fields
    if (!parsed.type || !parsed.timestamp) {
      throw new Error('Missing required fields: type and timestamp');
    }

    // Validate message type
    if (!['summary', 'user', 'assistant'].includes(parsed.type)) {
      throw new Error(`Invalid message type: ${parsed.type}`);
    }

    // Ensure ID is present (use fallback hierarchy)
    const messageId = parsed.id || parsed.uuid || parsed.leafUuid || parsed.fallback_id;
    if (!messageId) {
      // Generate fallback ID if none present
      parsed.fallback_id = `line_${lineNumber || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // CRITICAL FIX: Handle Claude Code message wrapper structure
    // Claude Code wraps content in a "message" property: {type:"user", message:{role:"user", content:"..."}}
    const result = { ...parsed };
    
    if (parsed.message) {
      // Extract content from the wrapped message structure
      if (parsed.message.content) {
        result.content = Array.isArray(parsed.message.content) 
          ? parsed.message.content 
          : [{ type: 'text', text: parsed.message.content }];
      }
      
      // Extract other message properties
      if (parsed.message.role) result.role = parsed.message.role;
      if (parsed.message.cost_usd !== undefined) result.cost_usd = parsed.message.cost_usd;
      if (parsed.message.usage) result.usage = parsed.message.usage;
    }

    return result as ClaudeCodeMessage;
  } catch (error) {
    throw new Error(`Invalid JSON${lineNumber ? ` at line ${lineNumber}` : ''}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse JSONL content from string
 */
export function parseJsonlContent(content: string): ParseResult {
  const result: ParseResult = {
    messages: [],
    errors: [],
    linesProcessed: 0,
    validMessages: 0
  };

  const lines = content.split('\n').filter(line => line.trim() !== '');
  result.linesProcessed = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    try {
      const parsed = parseJsonlLine(line, i + 1);
      if (parsed) {
        result.messages.push(parsed);
        result.validMessages++;
      }
    } catch (error) {
      result.errors.push(new Error(`Line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  return result;
}

/**
 * Validate a parsed message structure
 */
export function validateMessage(message: any): ClaudeCodeMessage {
  // Type-specific validation
  switch (message.type) {
    case 'summary':
      if (!message.summary) {
        throw new Error('Summary message missing summary field');
      }
      break;
    
    case 'user':
    case 'assistant':
      // Content is now optional since some messages may only have text
      if (message.content && !Array.isArray(message.content)) {
        throw new Error(`${message.type} message has invalid content array`);
      }
      break;
    
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }

  return message as ClaudeCodeMessage;
}

/**
 * Extract session ID from file path
 */
export function extractSessionId(filePath: string): string {
  const filename = filePath.split('/').pop() || '';
  return filename.replace('.jsonl', '');
}

/**
 * Extract project path from full file path
 */
export function extractProjectPath(filePath: string): string {
  const parts = filePath.split('/');
  const projectsIndex = parts.findIndex(part => part === 'projects');
  
  if (projectsIndex === -1 || projectsIndex >= parts.length - 2) {
    return 'unknown';
  }
  
  return parts[projectsIndex + 1];
}