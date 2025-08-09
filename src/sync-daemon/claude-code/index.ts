/**
 * Claude Code processor - handles JSONL file processing for database sync
 * Adapted from cafe-db-sync Claude Code processing patterns
 */

import { parseJsonlFile, extractSessionId, extractProjectPath } from '../parse/jsonl-parser.js';
import { transformToDatabase, validateTransformResult } from '../transform/schema-mapper.js';
import { executeToDatabase, initializeDatabase } from '../execute/database.js';
import { createSessionLogger, globalLogger } from '../execute/transaction-log.js';
import { getExistingJsonlFiles, watchJsonl, validateJsonlFile, stopWatcher } from '../watch/jsonl.js';
import { FileProcessingResult, SyncConfig } from './types.js';
import type chokidar from 'chokidar';

let watcher: any | null = null;

/**
 * Process a single JSONL file through the complete pipeline
 */
export async function processJsonlFile(filePath: string): Promise<FileProcessingResult> {
  const sessionId = extractSessionId(filePath);
  const logger = createSessionLogger(sessionId);
  
  const result: FileProcessingResult = {
    filePath,
    sessionId,
    messages: [],
    error: undefined
  };

  logger.info('file_processing_start', { filePath });
  const startTime = Date.now();

  try {
    // Validate file before processing
    if (!validateJsonlFile(filePath)) {
      throw new Error(`File validation failed: ${filePath}`);
    }

    // Parse JSONL file
    logger.debug('parsing_start');
    const parseResult = parseJsonlFile(filePath);
    
    if (parseResult.errors.length > 0) {
      logger.warn('parse_errors', { 
        filePath,
        errorCount: parseResult.errors.length,
        totalLines: parseResult.linesProcessed,
        errors: parseResult.errors.slice(0, 5).map(e => ({
          message: e.message,
          line: e.stack?.split('\n')[1] || 'unknown'
        }))
      });
    }

    result.messages = parseResult.messages;
    logger.info('parsing_complete', { 
      messageCount: parseResult.messages.length,
      linesProcessed: parseResult.linesProcessed,
      validMessages: parseResult.validMessages,
      errorCount: parseResult.errors.length
    });

    // Skip if no valid messages
    if (parseResult.messages.length === 0) {
      logger.warn('no_valid_messages', { filePath });
      return result;
    }

    // Transform to database format
    logger.debug('transform_start');
    const sessionPath = extractProjectPath(filePath);
    const transformResult = transformToDatabase(parseResult.messages, sessionId, sessionPath);
    
    // Validate transformed data
    validateTransformResult(transformResult);
    
    logger.info('transform_complete', {
      messagesTransformed: transformResult.messages.length,
      toolUsesTransformed: transformResult.toolUses.length,
      toolResultsTransformed: transformResult.toolResults.length
    });

    // Execute to database
    logger.debug('database_execution_start');
    const executeResult = await executeToDatabase(transformResult, sessionId, sessionPath);
    result.executeResult = executeResult;

    logger.info('database_execution_complete', {
      messagesProcessed: executeResult.messagesProcessed,
      messagesInserted: executeResult.messagesInserted,
      messagesUpdated: executeResult.messagesUpdated,
      toolUsesInserted: executeResult.toolUsesInserted,
      toolResultsInserted: executeResult.toolResultsInserted,
      errorCount: executeResult.errors.length
    });

    // Log any database errors
    if (executeResult.errors.length > 0) {
      logger.warn('database_errors', {
        errorCount: executeResult.errors.length,
        errors: executeResult.errors.slice(0, 3).map(e => e.message)
      });
    }

  } catch (error) {
    result.error = error instanceof Error ? error : new Error(String(error));
    logger.error('file_processing_error', { 
      filePath, 
      error: result.error.message,
      stack: result.error.stack
    });
  }

  const duration = Date.now() - startTime;
  logger.info('file_processing_complete', { 
    filePath, 
    duration,
    success: !result.error
  });

  return result;
}

/**
 * Run initial sync of all existing JSONL files
 */
export async function runClaudeCodeSync(config?: SyncConfig): Promise<FileProcessingResult[]> {
  globalLogger.info('initial_sync_start');
  const startTime = Date.now();

  // Initialize database
  initializeDatabase();

  // Get all existing JSONL files
  const jsonlFiles = getExistingJsonlFiles(config?.projectsPath);
  const results: FileProcessingResult[] = [];

  globalLogger.info('initial_sync_files_found', { fileCount: jsonlFiles.length });

  // Process each file
  for (const filePath of jsonlFiles) {
    try {
      const result = await processJsonlFile(filePath);
      results.push(result);
    } catch (error) {
      const failureResult: FileProcessingResult = {
        filePath,
        sessionId: extractSessionId(filePath),
        messages: [],
        error: error instanceof Error ? error : new Error(String(error))
      };
      results.push(failureResult);
      
      globalLogger.error('initial_sync_file_failed', { 
        filePath, 
        error: failureResult.error?.message || 'Unknown error'
      });
    }
  }

  const duration = Date.now() - startTime;
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  globalLogger.info('initial_sync_complete', {
    duration,
    totalFiles: results.length,
    successful,
    failed,
    totalMessages: results.reduce((sum, r) => sum + r.messages.length, 0)
  });

  return results;
}

/**
 * Start watching for file changes
 */
export function startWatching(config?: SyncConfig): any {
  globalLogger.info('real_time_watching_start');

  // Ensure database is initialized
  initializeDatabase();

  watcher = watchJsonl(async (event) => {
    const eventStartTime = Date.now();
    globalLogger.info('file_event_received', { 
      event: event.event, 
      filePath: event.filePath,
      timestamp: new Date().toISOString()
    });

    try {
      switch (event.event) {
        case 'add':
        case 'change':
          const processStart = Date.now();
          await processJsonlFile(event.filePath);
          const processDuration = Date.now() - processStart;
          globalLogger.info('file_event_processed', {
            event: event.event,
            filePath: event.filePath,
            duration: processDuration,
            latency: Date.now() - eventStartTime
          });
          break;
          
        case 'unlink':
          // TODO: Handle file deletion (mark sessions as deleted?)
          globalLogger.info('file_deleted', { filePath: event.filePath });
          break;
      }
    } catch (error) {
      globalLogger.error('file_event_processing_error', {
        event: event.event,
        filePath: event.filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }, {
    projectsPath: config?.projectsPath,
    awaitWriteFinish: {
      stabilityThreshold: config?.watchDebounce || 100,
      pollInterval: 50
    }
  });

  return watcher;
}

/**
 * Stop watching and cleanup
 */
export async function stopWatching(): Promise<void> {
  if (watcher) {
    globalLogger.info('stopping_file_watcher');
    await stopWatcher(watcher);
    watcher = null;
  }
}

/**
 * Check if watcher is active
 */
export function isWatcherActive(): boolean {
  return !!watcher;
}

/**
 * Get recent sync latency from transaction logs
 */
export function getRecentSyncLatency(): { recent: number | null; p95: number | null; count: number } {
  try {
    const { getRecentSyncLatency: getLatencyFromLogs } = require('../execute/transaction-log.js');
    return getLatencyFromLogs();
  } catch (error) {
    return {
      recent: null,
      p95: null,
      count: 0
    };
  }
}

/**
 * Get sync statistics
 */
export function getSyncStats(): any {
  try {
    const { getDatabaseStats } = require('../execute/database.js');
    const stats = getDatabaseStats();
    
    return {
      database: stats,
      watcher: {
        active: !!watcher,
        watching: watcher ? 'active' : 'stopped'
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    globalLogger.error('stats_error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      error: 'Failed to retrieve stats',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Health check for sync daemon - deterministic and fast
 */
export async function healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'error'; details: any }> {
  try {
    const stats = getSyncStats();
    const syncLatency = getRecentSyncLatency();
    
    const health = {
      status: 'healthy' as const,
      details: {
        database: {
          accessible: true,
          recordCount: stats.database?.messages?.count || 0
        },
        watcher: {
          active: !!watcher,
          status: watcher ? 'running' : 'stopped'
        },
        syncLatency: syncLatency,
        timestamp: new Date().toISOString()
      }
    };

    return health;
  } catch (error) {
    return {
      status: 'error',
      details: {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
    };
  }
}