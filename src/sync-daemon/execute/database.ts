/**
 * Database operations with retry logic and transaction handling
 * Adapted from cafe-db-sync database patterns
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { ExecuteResult, TransformResult } from '../claude-code/types.js';
import { withDatabaseWriteLock, withSessionLock } from '../utils/database-lock.js';
import { TransactionLogger } from './transaction-log.js';

// Database configuration
const DB_PATH = process.env.SIMPLE_MEMORY_DB_PATH || join(homedir(), '.local/share/simple-memory/mcp.db');
const DB_DIR = join(homedir(), '.local/share/simple-memory');

let database: Database.Database | null = null;

/**
 * Initialize and get database connection
 */
export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  // Ensure directory exists
  mkdirSync(DB_DIR, { recursive: true });

  // Initialize database with optimal settings
  database = new Database(DB_PATH);
  
  // Configure SQLite for concurrent access and performance
  database.pragma('journal_mode = WAL');
  database.pragma('synchronous = NORMAL');
  database.pragma('cache_size = 10000');
  database.pragma('temp_store = memory');
  database.pragma('mmap_size = 268435456'); // 256MB
  database.pragma('busy_timeout = 10000'); // 10 seconds
  
  // Enable foreign keys
  database.pragma('foreign_keys = ON');

  return database;
}

/**
 * Initialize database schema if not exists
 */
export function initializeDatabase(): Database.Database {
  const db = getDatabase();
  
  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_activity_at TEXT NOT NULL
    );
  `);

  // Create messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_text TEXT,
      assistant_text TEXT,
      project_name TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  // Create tool_uses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_uses (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      parameters TEXT,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `);

  // Create tool_use_results table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_use_results (
      id TEXT PRIMARY KEY,
      tool_use_id TEXT NOT NULL,
      output TEXT,
      error TEXT,
      FOREIGN KEY (tool_use_id) REFERENCES tool_uses(id) ON DELETE CASCADE
    );
  `);

  // Create attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      filename TEXT,
      content TEXT,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `);

  // Create env_info table
  db.exec(`
    CREATE TABLE IF NOT EXISTS env_info (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      working_dir TEXT,
      git_branch TEXT,
      platform TEXT,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for performance (individual statements for better error handling)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_tool_uses_message_id ON tool_uses(message_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_tool_use_results_tool_use_id ON tool_use_results(tool_use_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at);');
  } catch (indexError) {
    console.warn('Warning: Some indexes could not be created:', indexError instanceof Error ? indexError.message : String(indexError));
  }

  return db;
}

/**
 * Execute transformed data to database with retry logic
 */
export async function executeToDatabase(
  transformResult: TransformResult,
  sessionId: string,
  sessionPath: string
): Promise<ExecuteResult> {
  
  return withDatabaseWriteLock(async () => {
    return withSessionLock(sessionId, async () => {
      const db = initializeDatabase();
      const logger = new TransactionLogger();
      const result: ExecuteResult = {
        messagesProcessed: transformResult.messages.length,
        messagesInserted: 0,
        messagesUpdated: 0,
        toolUsesInserted: 0,
        toolResultsInserted: 0,
        errors: [],
        sessionId,
        sessionPath
      };

      const transaction = db.transaction(() => {
        try {
          // Ensure session exists
          ensureSession(db, transformResult.session, logger);

          // Process messages
          for (const message of transformResult.messages) {
            const inserted = insertMessage(db, message, logger);
            if (inserted) {
              result.messagesInserted++;
            } else {
              result.messagesUpdated++;
            }
          }

          // Process tool uses
          for (const toolUse of transformResult.toolUses) {
            if (insertToolUse(db, toolUse, logger)) {
              result.toolUsesInserted++;
            }
          }

          // Process tool results
          for (const toolResult of transformResult.toolResults) {
            if (insertToolResult(db, toolResult, logger)) {
              result.toolResultsInserted++;
            }
          }

          logger.log('transaction_complete', { sessionId, result });
        } catch (error) {
          logger.log('transaction_error', { sessionId, error: error instanceof Error ? error.message : String(error) });
          throw error;
        }
      });

      try {
        await retryDatabaseOperation(() => transaction(), 5);
        return result;
      } catch (error) {
        result.errors.push(error instanceof Error ? error : new Error(String(error)));
        return result;
      }
    });
  });
}

/**
 * Ensure session exists in database
 */
function ensureSession(db: Database.Database, session: any, logger: TransactionLogger): void {
  const existingSession = db.prepare('SELECT id FROM sessions WHERE id = ?').get(session.id);
  
  if (!existingSession) {
    const stmt = db.prepare(`
      INSERT INTO sessions (id, path, created_at, last_activity_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(session.id, session.path, session.created_at, session.last_activity_at);
    logger.log('session_created', { sessionId: session.id, path: session.path });
  } else {
    // Update last activity
    const stmt = db.prepare('UPDATE sessions SET last_activity_at = ? WHERE id = ?');
    stmt.run(session.last_activity_at, session.id);
    logger.log('session_updated', { sessionId: session.id });
  }
}

/**
 * Insert message with deduplication
 */
function insertMessage(db: Database.Database, message: any, logger: TransactionLogger): boolean {
  const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(message.id);
  
  if (existing) {
    return false;
  }

  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, type, timestamp, user_text, assistant_text, project_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    message.id,
    message.session_id,
    message.type,
    message.timestamp,
    message.user_text,
    message.assistant_text,
    message.project_name
  );
  
  logger.log('message_inserted', { messageId: message.id, type: message.type });
  return true;
}

/**
 * Insert tool use with deduplication
 */
function insertToolUse(db: Database.Database, toolUse: any, logger: TransactionLogger): boolean {
  const existing = db.prepare('SELECT id FROM tool_uses WHERE id = ?').get(toolUse.id);
  
  if (existing) {
    return false;
  }

  const stmt = db.prepare(`
    INSERT INTO tool_uses (id, message_id, tool_name, parameters)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(toolUse.id, toolUse.message_id, toolUse.tool_name, toolUse.parameters);
  logger.log('tool_use_inserted', { toolUseId: toolUse.id, toolName: toolUse.tool_name });
  return true;
}

/**
 * Insert tool result with deduplication
 */
function insertToolResult(db: Database.Database, toolResult: any, logger: TransactionLogger): boolean {
  const existing = db.prepare('SELECT id FROM tool_use_results WHERE id = ?').get(toolResult.id);
  
  if (existing) {
    return false;
  }

  const stmt = db.prepare(`
    INSERT INTO tool_use_results (id, tool_use_id, output, error)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(toolResult.id, toolResult.tool_use_id, toolResult.output, toolResult.error);
  logger.log('tool_result_inserted', { toolResultId: toolResult.id });
  return true;
}

/**
 * Retry database operation with exponential backoff
 */
async function retryDatabaseOperation<T>(
  operation: () => T,
  maxRetries: number = 5
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a database busy error
      if (lastError.message.includes('SQLITE_BUSY') && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
        console.warn(`Database busy, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Non-retryable error or max attempts reached
      throw lastError;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): any {
  const db = getDatabase();
  
  const stats = {
    sessions: db.prepare('SELECT COUNT(*) as count FROM sessions').get(),
    messages: db.prepare('SELECT COUNT(*) as count FROM messages').get(),
    tool_uses: db.prepare('SELECT COUNT(*) as count FROM tool_uses').get(),
    tool_results: db.prepare('SELECT COUNT(*) as count FROM tool_use_results').get(),
    size_mb: Math.round((db.prepare('PRAGMA page_count').get() as any).page_count * (db.prepare('PRAGMA page_size').get() as any).page_size / 1024 / 1024)
  };
  
  return stats;
}