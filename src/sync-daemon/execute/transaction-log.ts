/**
 * Transaction logging for debugging and service coordination
 * Adapted from cafe-db-sync transaction logging patterns
 */

import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.local/share/simple-memory/logs');
const TRANSACTION_LOG = join(LOG_DIR, 'sync-transactions.jsonl');

export interface TransactionLogEntry {
  timestamp: string;
  event: string;
  data: any;
  level: 'info' | 'warn' | 'error' | 'debug';
}

export class TransactionLogger {
  private sessionId?: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
    this.ensureLogDir();
  }

  /**
   * Log a transaction event
   */
  log(event: string, data: any = {}, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
    const entry: TransactionLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      data: {
        ...data,
        sessionId: this.sessionId || data.sessionId
      },
      level
    };

    try {
      const logLine = JSON.stringify(entry) + '\n';
      appendFileSync(TRANSACTION_LOG, logLine, 'utf8');
      
      // Also log to console for debugging in development
      if (process.env.NODE_ENV !== 'production') {
        this.logToConsole(entry);
      }
    } catch (error) {
      console.error('Failed to write transaction log:', error);
    }
  }

  /**
   * Log info level event
   */
  info(event: string, data?: any): void {
    this.log(event, data, 'info');
  }

  /**
   * Log warning level event
   */
  warn(event: string, data?: any): void {
    this.log(event, data, 'warn');
  }

  /**
   * Log error level event
   */
  error(event: string, data?: any): void {
    this.log(event, data, 'error');
  }

  /**
   * Log debug level event
   */
  debug(event: string, data?: any): void {
    this.log(event, data, 'debug');
  }

  /**
   * Log batch processing start
   */
  startBatch(filePath: string, messageCount: number): void {
    this.info('batch_start', { filePath, messageCount });
  }

  /**
   * Log batch processing completion
   */
  completeBatch(filePath: string, result: any): void {
    this.info('batch_complete', { filePath, result });
  }

  /**
   * Log file processing error
   */
  fileError(filePath: string, error: Error): void {
    this.error('file_error', { filePath, error: error.message, stack: error.stack });
  }

  /**
   * Log database operation metrics
   */
  dbMetrics(operation: string, duration: number, recordCount?: number): void {
    this.debug('db_metrics', { operation, duration, recordCount });
  }

  /**
   * Log sync daemon health status
   */
  healthCheck(status: 'healthy' | 'degraded' | 'error', details?: any): void {
    this.info('health_check', { status, details });
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDir(): void {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: TransactionLogEntry): void {
    const timestamp = entry.timestamp.replace('T', ' ').replace('Z', '');
    const level = entry.level.toUpperCase().padEnd(5);
    const event = entry.event.padEnd(20);
    
    let message = `${timestamp} [${level}] ${event}`;
    
    // Add relevant data fields
    if (entry.data.sessionId) {
      message += ` session=${entry.data.sessionId.substring(0, 8)}`;
    }
    
    if (entry.data.filePath) {
      const filename = entry.data.filePath.split('/').pop() || 'unknown';
      message += ` file=${filename}`;
    }
    
    if (entry.data.messageCount !== undefined) {
      message += ` messages=${entry.data.messageCount}`;
    }
    
    if (entry.data.duration !== undefined) {
      message += ` duration=${entry.data.duration}ms`;
    }

    // Color coding by level
    switch (entry.level) {
      case 'error':
        console.error('\x1b[31m%s\x1b[0m', message); // Red
        break;
      case 'warn':
        console.warn('\x1b[33m%s\x1b[0m', message); // Yellow
        break;
      case 'debug':
        console.log('\x1b[36m%s\x1b[0m', message); // Cyan
        break;
      default:
        console.log(message);
    }

    // Log error details separately
    if (entry.level === 'error' && entry.data.error) {
      console.error('  Error:', entry.data.error);
      if (entry.data.stack) {
        console.error('  Stack:', entry.data.stack);
      }
    }
  }
}

/**
 * Global transaction logger instance
 */
export const globalLogger = new TransactionLogger();

/**
 * Log sync daemon startup
 */
export function logSyncStart(config: any): void {
  globalLogger.info('sync_daemon_start', { 
    config: {
      projectsPath: config.projectsPath,
      dbPath: config.dbPath,
      watchDebounce: config.watchDebounce
    },
    pid: process.pid
  });
}

/**
 * Log sync daemon shutdown
 */
export function logSyncStop(reason?: string): void {
  globalLogger.info('sync_daemon_stop', { reason, pid: process.pid });
}

/**
 * Log file watcher events
 */
export function logWatcherEvent(event: string, filePath: string, details?: any): void {
  globalLogger.debug('watcher_event', { event, filePath, details });
}

/**
 * Log processing pipeline metrics
 */
export function logPipelineMetrics(stage: string, duration: number, details?: any): void {
  globalLogger.debug('pipeline_metrics', { stage, duration, details });
}

/**
 * Create session-specific logger
 */
export function createSessionLogger(sessionId: string): TransactionLogger {
  return new TransactionLogger(sessionId);
}

/**
 * Rotate logs if they get too large (basic rotation)
 */
export function rotateLogs(): void {
  try {
    const stats = require('fs').statSync(TRANSACTION_LOG);
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (stats.size > maxSize) {
      const backup = TRANSACTION_LOG + '.' + Date.now();
      require('fs').renameSync(TRANSACTION_LOG, backup);
      globalLogger.info('log_rotated', { backup, originalSize: stats.size });
    }
  } catch (error) {
    // Ignore rotation errors
  }
}

/**
 * Get recent log entries for debugging
 */
export function getRecentLogs(count: number = 100): TransactionLogEntry[] {
  try {
    const content = require('fs').readFileSync(TRANSACTION_LOG, 'utf8');
    const lines = content.trim().split('\n').slice(-count);
    return lines.map((line: string) => JSON.parse(line));
  } catch (error) {
    return [];
  }
}