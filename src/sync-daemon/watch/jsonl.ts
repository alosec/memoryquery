/**
 * JSONL file watcher using chokidar
 * Adapted from cafe-db-sync file watching patterns
 */

import chokidar from 'chokidar';
import { join } from 'path';
import { homedir } from 'os';
import { readdirSync, statSync } from 'fs';
import { logWatcherEvent, globalLogger } from '../execute/transaction-log.js';

// Configuration
const PROJECTS_PATH = process.env.CLAUDE_PROJECTS_PATH || 
  (process.env.NODE_ENV === 'production' ? '/claude-projects' : join(homedir(), '.claude', 'projects'));

export interface WatchConfig {
  projectsPath?: string;
  awaitWriteFinish?: {
    stabilityThreshold: number;
    pollInterval: number;
  };
  ignored?: string[];
}

export interface FileEvent {
  event: 'add' | 'change' | 'unlink';
  filePath: string;
}

/**
 * Start watching JSONL files for changes
 */
export function watchJsonl(
  callback: (event: FileEvent) => void,
  config: WatchConfig = {}
): any {
  
  const projectsPath = config.projectsPath || PROJECTS_PATH;
  
  globalLogger.info('watcher_init', { 
    projectsPath, 
    nodeEnv: process.env.NODE_ENV,
    pid: process.pid 
  });

  // Validate directory exists and log contents
  try {
    const dirs = readdirSync(projectsPath);
    globalLogger.info('projects_directory_scan', { 
      path: projectsPath, 
      projectCount: dirs.length,
      projects: dirs.slice(0, 10) // Log first 10 projects
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    globalLogger.error('projects_directory_error', { 
      path: projectsPath, 
      error: errorMessage
    });
    // Continue anyway - directory might be created later
  }

  // Configure chokidar watcher with battle-tested settings from cafe-db-sync
  const watcher = chokidar.watch(projectsPath, {
    // Stability configuration for file write completion
    awaitWriteFinish: config.awaitWriteFinish || {
      stabilityThreshold: 100, // Wait 100ms after last change
      pollInterval: 50        // Check every 50ms
    },
    
    // Performance and reliability settings
    persistent: true,
    ignoreInitial: false,      // Process existing files on startup
    followSymlinks: false,
    cwd: projectsPath,
    depth: 2,                 // projects/project-name/file.jsonl
    
    // File filtering
    ignored: [
      /(^|[\/\\])\../,        // Hidden files
      '**/*.tmp',             // Temporary files  
      '**/*.swp',             // Vim swap files
      ...(config.ignored || [])
    ],
    
    // Polling configuration (important for Docker/network volumes)
    usePolling: process.env.NODE_ENV === 'production',
    interval: 1000,           // Poll every 1s in production
    binaryInterval: 5000      // Poll binary files every 5s
  });

  // Set up event handlers
  watcher.on('ready', () => {
    globalLogger.info('watcher_ready', { projectsPath });
  });

  watcher.on('add', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logWatcherEvent('add', filePath);
      callback({ event: 'add', filePath: join(projectsPath, filePath) });
    }
  });

  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logWatcherEvent('change', filePath);
      callback({ event: 'change', filePath: join(projectsPath, filePath) });
    }
  });

  watcher.on('unlink', (filePath) => {
    if (filePath.endsWith('.jsonl')) {
      logWatcherEvent('unlink', filePath);
      callback({ event: 'unlink', filePath: join(projectsPath, filePath) });
    }
  });

  watcher.on('error', (error: any) => {
    globalLogger.error('watcher_error', { 
      error: error instanceof Error ? error.message : String(error), 
      stack: error instanceof Error ? error.stack : undefined
    });
  });

  // Debug event for low-level file system events
  watcher.on('raw', (event, path, details) => {
    globalLogger.debug('watcher_raw_event', { event, path, details });
  });

  // Directory-level events for debugging
  watcher.on('addDir', (dirPath) => {
    globalLogger.debug('watcher_add_dir', { dirPath });
  });

  watcher.on('unlinkDir', (dirPath) => {
    globalLogger.debug('watcher_unlink_dir', { dirPath });
  });

  return watcher;
}

/**
 * Get list of existing JSONL files for initial sync
 */
export function getExistingJsonlFiles(projectsPath?: string): string[] {
  const basePath = projectsPath || PROJECTS_PATH;
  const jsonlFiles: string[] = [];

  try {
    const projects = readdirSync(basePath);
    
    for (const project of projects) {
      const projectDir = join(basePath, project);
      
      try {
        const stat = statSync(projectDir);
        if (stat.isDirectory()) {
          const files = readdirSync(projectDir);
          
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              jsonlFiles.push(join(projectDir, file));
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        globalLogger.warn('project_scan_error', { 
          project, 
          error: errorMessage
        });
        continue;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    globalLogger.error('projects_scan_error', { 
      basePath, 
      error: errorMessage
    });
  }

  globalLogger.info('initial_scan_complete', { 
    basePath, 
    fileCount: jsonlFiles.length,
    files: jsonlFiles.map(f => f.split('/').pop()).slice(0, 10) // Log first 10 filenames
  });

  return jsonlFiles;
}

/**
 * Validate JSONL file before processing
 */
export function validateJsonlFile(filePath: string): boolean {
  try {
    const stat = statSync(filePath);
    
    // Check if file is readable and has content
    if (!stat.isFile() || stat.size === 0) {
      globalLogger.warn('file_validation_failed', { 
        filePath, 
        isFile: stat.isFile(), 
        size: stat.size 
      });
      return false;
    }

    // Check file extension
    if (!filePath.endsWith('.jsonl')) {
      globalLogger.warn('file_validation_failed', { 
        filePath, 
        reason: 'not_jsonl_extension' 
      });
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    globalLogger.warn('file_validation_error', { 
      filePath, 
      error: errorMessage
    });
    return false;
  }
}

/**
 * Extract session ID from file path
 */
export function extractSessionIdFromPath(filePath: string): string {
  const filename = filePath.split('/').pop() || '';
  return filename.replace('.jsonl', '');
}

/**
 * Extract project name from file path
 */
export function extractProjectFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const projectsIndex = parts.findIndex(part => part === 'projects');
  
  if (projectsIndex === -1 || projectsIndex >= parts.length - 2) {
    return 'unknown';
  }
  
  return parts[projectsIndex + 1];
}

/**
 * Stop and cleanup watcher
 */
export async function stopWatcher(watcher: any): Promise<void> {
  globalLogger.info('watcher_stopping');
  
  try {
    await watcher.close();
    globalLogger.info('watcher_stopped');
  } catch (error) {
    globalLogger.error('watcher_stop_error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}