/**
 * Main sync daemon orchestrator
 * Adapted from cafe-db-sync main entry point patterns
 */

import { join } from 'path';
import { homedir } from 'os';
import { runClaudeCodeSync, startWatching, stopWatching, healthCheck, getRecentSyncLatency, isWatcherActive } from './claude-code/index.js';
import { logSyncStart, logSyncStop, globalLogger, rotateLogs } from './execute/transaction-log.js';
import { SyncConfig } from './claude-code/types.js';

// Default configuration
const DEFAULT_CONFIG: SyncConfig = {
  projectsPath: process.env.CLAUDE_PROJECTS_PATH || 
    (process.env.NODE_ENV === 'production' ? '/claude-projects' : join(homedir(), '.claude', 'projects')),
  dbPath: process.env.MEMQ_DB_PATH || join(homedir(), '.local/share/memoryquery/mcp.db'),
  watchDebounce: 100,
  maxRetries: 5
};

let isRunning = false;
let shutdownPromise: Promise<void> | null = null;

/**
 * Main sync daemon entry point
 */
export async function main(config: Partial<SyncConfig> = {}): Promise<void> {
  const syncConfig = { 
    ...DEFAULT_CONFIG, 
    ...config,
    startTime: Date.now()
  };
  
  logSyncStart(syncConfig);
  isRunning = true;

  try {
    // Rotate logs if needed
    rotateLogs();

    // Run initial sync of existing files
    globalLogger.info('starting_initial_sync');
    const initialSyncResults = await runClaudeCodeSync(syncConfig);
    
    const successCount = initialSyncResults.filter(r => !r.error).length;
    const errorCount = initialSyncResults.filter(r => r.error).length;
    
    globalLogger.info('initial_sync_summary', {
      totalFiles: initialSyncResults.length,
      successful: successCount,
      failed: errorCount
    });

    if (errorCount > 0) {
      globalLogger.warn('initial_sync_had_errors', { 
        errorCount,
        errors: initialSyncResults
          .filter(r => r.error)
          .slice(0, 5)
          .map(r => ({ file: r.filePath, error: r.error?.message }))
      });
    }

    // Start real-time file watching
    globalLogger.info('starting_real_time_sync');
    const watcher = startWatching(syncConfig);

    // Set up graceful shutdown
    setupShutdownHandlers();

    globalLogger.info('sync_daemon_fully_started', {
      projectsPath: syncConfig.projectsPath,
      dbPath: syncConfig.dbPath,
      initialSyncFiles: initialSyncResults.length,
      pid: process.pid
    });

    // Keep the process alive
    await new Promise<void>((resolve) => {
      let lastHealthLog = Date.now();
      const checkShutdown = () => {
        if (shutdownPromise) {
          shutdownPromise.then(resolve);
        } else {
          // Log periodic health status every 30 seconds
          const now = Date.now();
          if (now - lastHealthLog > 30000) {
            globalLogger.info('daemon_health_ping', {
              uptime: Math.floor((now - syncConfig.startTime) / 1000),
              watcherActive: isWatcherActive(),
              pid: process.pid
            });
            lastHealthLog = now;
          }
          setTimeout(checkShutdown, 1000);
        }
      };
      checkShutdown();
    });

  } catch (error) {
    globalLogger.error('sync_daemon_error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    isRunning = false;
    logSyncStop('main_exit');
  }
}

/**
 * Start sync daemon (public API)
 */
export async function startSyncDaemon(config?: Partial<SyncConfig>): Promise<void> {
  if (isRunning) {
    throw new Error('Sync daemon is already running');
  }

  return main(config);
}

/**
 * Stop sync daemon gracefully
 */
export async function stopSyncDaemon(reason: string = 'manual_stop'): Promise<void> {
  if (!isRunning) {
    globalLogger.warn('stop_called_but_not_running');
    return;
  }

  globalLogger.info('sync_daemon_shutdown_requested', { reason });

  // Create shutdown promise if not exists
  if (!shutdownPromise) {
    shutdownPromise = performShutdown(reason);
  }

  return shutdownPromise;
}

/**
 * Perform actual shutdown steps
 */
async function performShutdown(reason: string): Promise<void> {
  try {
    globalLogger.info('shutdown_sequence_start', { reason });

    // Stop file watching
    await stopWatching();
    globalLogger.info('file_watching_stopped');

    // Close database connections
    const { closeDatabase } = await import('./execute/database.js');
    closeDatabase();
    globalLogger.info('database_connections_closed');

    globalLogger.info('shutdown_sequence_complete', { reason });
  } catch (error) {
    globalLogger.error('shutdown_error', {
      reason,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Set up signal handlers for graceful shutdown
 */
function setupShutdownHandlers(): void {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

  for (const signal of signals) {
    process.on(signal, async () => {
      globalLogger.info('shutdown_signal_received', { signal });
      
      try {
        await stopSyncDaemon(`signal_${signal}`);
        process.exit(0);
      } catch (error) {
        globalLogger.error('shutdown_signal_error', {
          signal,
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      }
    });
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    globalLogger.error('uncaught_exception', {
      error: error.message,
      stack: error.stack
    });
    
    stopSyncDaemon('uncaught_exception')
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    globalLogger.error('unhandled_rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
    
    stopSyncDaemon('unhandled_rejection')
      .then(() => process.exit(1))
      .catch(() => process.exit(1));
  });
}

/**
 * Get sync daemon status - DEPRECATED: Use external process validation instead
 * 
 * WARNING: This function relies on in-memory state that can be unreliable.
 * For accurate status checking, use external validation like test/check-status.js
 */
export async function getSyncDaemonStatus(): Promise<{
  running: boolean;
  health: any;
  config: SyncConfig;
}> {
  // This function is now deprecated - it only reports in-memory state
  // which can be misleading. External process validation is more reliable.
  
  const health = {
    status: 'unknown' as const,
    details: { 
      message: 'Status check via in-memory flag (unreliable)',
      recommendation: 'Use external process validation instead',
      timestamp: new Date().toISOString()
    }
  };

  return {
    running: isRunning, // This is just the in-memory flag, not actual process state
    health,
    config: DEFAULT_CONFIG
  };
}

/**
 * Entry point when run directly
 */
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}