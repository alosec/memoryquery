/**
 * External validation utilities for CLI commands
 * These utilities check system state WITHOUT importing sync-daemon modules
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import Database from 'better-sqlite3';

const execAsync = promisify(exec);

export interface DatabaseStats {
  messages: number;
  sessions: number;
  fileSize: number;
  lastModified: Date;
}

export interface ProcessStatus {
  syncDaemon: boolean;
  mcpServer: boolean;
  pids: {
    syncDaemon?: number;
    mcpServer?: number;
  };
}

export interface ConversationFile {
  name: string;
  path: string;
  modified: Date;
  size: number;
}

/**
 * Get database statistics without triggering sync
 */
export function getDatabaseStats(dbPath?: string): DatabaseStats | null {
  const defaultPath = path.join(os.homedir(), '.local/share/simple-memory/mcp.db');
  const targetPath = dbPath || defaultPath;

  try {
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    const db = new Database(targetPath, { readonly: true });
    const messages = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
    const sessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    const stats = fs.statSync(targetPath);
    db.close();

    return {
      messages: messages.count,
      sessions: sessions.count,
      fileSize: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    return null;
  }
}

/**
 * Check for running processes externally
 */
export async function checkProcesses(): Promise<ProcessStatus> {
  const result: ProcessStatus = {
    syncDaemon: false,
    mcpServer: false,
    pids: {}
  };

  try {
    // Check for sync daemon
    const { stdout: syncOut } = await execAsync('ps aux | grep -v grep | grep "sync-daemon\\|simple-memory.*sync"');
    if (syncOut.trim()) {
      result.syncDaemon = true;
      // Try to extract PID
      const match = syncOut.match(/^\S+\s+(\d+)/);
      if (match) {
        result.pids.syncDaemon = parseInt(match[1]);
      }
    }
  } catch {
    // No sync daemon found
  }

  try {
    // Check for MCP server
    const { stdout: mcpOut } = await execAsync('ps aux | grep -v grep | grep "mcp-server\\|simple-memory.*mcp"');
    if (mcpOut.trim()) {
      result.mcpServer = true;
      // Try to extract PID
      const match = mcpOut.match(/^\S+\s+(\d+)/);
      if (match) {
        result.pids.mcpServer = parseInt(match[1]);
      }
    }
  } catch {
    // No MCP server found
  }

  return result;
}

/**
 * Find Claude Code conversation files
 */
export function findConversationFiles(projectsPath?: string): ConversationFile[] {
  const defaultPath = path.join(os.homedir(), '.claude', 'projects');
  const targetPath = projectsPath || defaultPath;

  const conversations: ConversationFile[] = [];

  try {
    if (!fs.existsSync(targetPath)) {
      return conversations;
    }

    // Recursively find all .jsonl files
    function scanDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          const stats = fs.statSync(fullPath);
          conversations.push({
            name: entry.name,
            path: fullPath,
            modified: stats.mtime,
            size: stats.size
          });
        }
      }
    }

    scanDirectory(targetPath);
    
    // Sort by most recent first
    conversations.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    
  } catch (error) {
    // Directory not accessible
  }

  return conversations;
}

/**
 * Check if sync daemon is healthy by monitoring database changes
 */
export async function validateSyncHealth(dbPath?: string, checkInterval: number = 2000): Promise<{
  running: boolean;
  active: boolean;
  messagesChanged?: number;
  reason?: string;
}> {
  const processes = await checkProcesses();
  
  if (!processes.syncDaemon) {
    return {
      running: false,
      active: false,
      reason: 'No sync daemon process found'
    };
  }

  // Check if database is being updated
  const stats1 = getDatabaseStats(dbPath);
  if (!stats1) {
    return {
      running: true,
      active: false,
      reason: 'Database not accessible'
    };
  }

  // Wait and check again
  await new Promise(resolve => setTimeout(resolve, checkInterval));
  
  const stats2 = getDatabaseStats(dbPath);
  if (!stats2) {
    return {
      running: true,
      active: false,
      reason: 'Database became inaccessible'
    };
  }

  const messagesChanged = stats2.messages - stats1.messages;
  
  return {
    running: true,
    active: messagesChanged > 0,
    messagesChanged: messagesChanged > 0 ? messagesChanged : undefined,
    reason: messagesChanged > 0 ? undefined : 'No new messages in ' + (checkInterval/1000) + ' seconds'
  };
}

/**
 * Get overall system health
 */
export async function getSystemHealth(config?: {
  dbPath?: string;
  projectsPath?: string;
}): Promise<{
  healthy: boolean;
  database: DatabaseStats | null;
  processes: ProcessStatus;
  conversations: number;
  syncActive: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  // Check database
  const database = getDatabaseStats(config?.dbPath);
  if (!database) {
    issues.push('Database not found');
  }

  // Check processes
  const processes = await checkProcesses();
  if (!processes.syncDaemon) {
    issues.push('Sync daemon not running');
  }

  // Check conversation files
  const conversations = findConversationFiles(config?.projectsPath);
  if (conversations.length === 0) {
    issues.push('No conversation files found');
  }

  // Quick sync health check
  const syncHealth = await validateSyncHealth(config?.dbPath, 1000);

  return {
    healthy: issues.length === 0,
    database,
    processes,
    conversations: conversations.length,
    syncActive: syncHealth.active,
    issues
  };
}
