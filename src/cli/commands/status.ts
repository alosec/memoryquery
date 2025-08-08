/**
 * Status command - checks service status WITHOUT triggering sync
 * Based on working pattern from test/check-status.js
 */

import { getDatabaseStats, checkProcesses, findConversationFiles, validateSyncHealth } from '../utils/external-validator';
import * as path from 'path';
import * as os from 'os';

export async function statusCommand(options?: {
  dbPath?: string;
  projectsPath?: string;
  json?: boolean;
}) {
  const dbPath = options?.dbPath || path.join(os.homedir(), '.local/share/simple-memory/mcp.db');
  const projectsPath = options?.projectsPath || path.join(os.homedir(), '.claude', 'projects');

  if (!options?.json) {
    console.log('Simple Memory MCP - Status Check');
    console.log('=' + '='.repeat(40));
  }

  try {
    // 1. Check database
    const dbStats = getDatabaseStats(dbPath);
    
    // 2. Check processes
    const processes = await checkProcesses();
    
    // 3. Check conversation files
    const conversations = findConversationFiles(projectsPath);
    
    // 4. Quick sync health check (1 second)
    const syncHealth = await validateSyncHealth(dbPath, 1000);

    // Prepare results
    const status = {
      database: dbStats ? {
        status: 'CONNECTED',
        messages: dbStats.messages,
        sessions: dbStats.sessions,
        size: dbStats.fileSize,
        sizeFormatted: `${(dbStats.fileSize / 1024 / 1024).toFixed(1)} MB`,
        lastModified: dbStats.lastModified
      } : {
        status: 'NOT FOUND',
        path: dbPath
      },
      conversations: {
        count: conversations.length,
        mostRecent: conversations.length > 0 ? {
          name: conversations[0].name,
          modified: conversations[0].modified
        } : null
      },
      syncDaemon: {
        process: processes.syncDaemon ? 'RUNNING' : 'NOT RUNNING',
        pid: processes.pids.syncDaemon,
        active: syncHealth.active,
        messagesChanged: syncHealth.messagesChanged,
        reason: syncHealth.reason
      },
      mcpServer: {
        process: processes.mcpServer ? 'RUNNING' : 'NOT RUNNING',
        pid: processes.pids.mcpServer
      },
      health: {
        overall: dbStats && processes.syncDaemon ? 'HEALTHY' : 'NEEDS ATTENTION',
        issues: [] as string[]
      }
    };

    // Identify issues
    if (!dbStats) {
      status.health.issues.push('Database not found');
    }
    if (!processes.syncDaemon) {
      status.health.issues.push('Sync daemon not running');
    }
    if (!processes.mcpServer) {
      status.health.issues.push('MCP server not running');
    }
    if (processes.syncDaemon && !syncHealth.active) {
      status.health.issues.push('Sync daemon not processing (possible zombie state)');
    }

    // Output results
    if (options?.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      // Database status
      if (dbStats) {
        console.log('Database: CONNECTED');
        console.log(`  Messages: ${dbStats.messages}`);
        console.log(`  Sessions: ${dbStats.sessions}`);
        console.log(`  Size: ${(dbStats.fileSize / 1024 / 1024).toFixed(1)} MB`);
      } else {
        console.log('Database: NOT FOUND');
        console.log(`  Path: ${dbPath}`);
      }

      // Conversation files
      console.log(`\nConversation Files: ${conversations.length} found`);
      if (conversations.length > 0) {
        console.log(`  Most recent: ${conversations[0].name}`);
        console.log(`  Modified: ${conversations[0].modified.toLocaleString()}`);
      }

      // Sync daemon status
      console.log(`\nSync Daemon: ${processes.syncDaemon ? 'RUNNING ✓' : 'NOT RUNNING'}`);
      if (processes.syncDaemon) {
        if (processes.pids.syncDaemon) {
          console.log(`  PID: ${processes.pids.syncDaemon}`);
        }
        if (syncHealth.active) {
          console.log(`  Activity: ${syncHealth.messagesChanged} messages in last second`);
        } else {
          console.log(`  Activity: IDLE (${syncHealth.reason})`);
        }
      }

      // MCP server status
      console.log(`\nMCP Server: ${processes.mcpServer ? 'RUNNING ✓' : 'NOT RUNNING'}`);
      if (processes.mcpServer && processes.pids.mcpServer) {
        console.log(`  PID: ${processes.pids.mcpServer}`);
      }

      // Health summary
      console.log('\n' + '='.repeat(41));
      const healthy = dbStats && processes.syncDaemon;
      console.log(`Overall Health: ${healthy ? 'HEALTHY ✓' : 'NEEDS ATTENTION ✗'}`);
      
      if (status.health.issues.length > 0) {
        console.log('\nIssues:');
        status.health.issues.forEach(issue => {
          console.log(`  - ${issue}`);
        });
        
        console.log('\nTo fix:');
        if (!dbStats) {
          console.log('  1. Build project: npm run build');
          console.log('  2. Start services: npm start');
        } else if (!processes.syncDaemon) {
          console.log('  1. Start sync daemon: npm start --sync-only');
        } else if (!processes.mcpServer) {
          console.log('  1. Start MCP server: npm start --mcp-only');
        } else if (!syncHealth.active) {
          console.log('  1. Restart sync daemon: npm stop && npm start');
        }
      }
    }

    // Return exit code
    const exitCode = (dbStats && processes.syncDaemon) ? 0 : 1;
    return exitCode;

  } catch (error) {
    if (options?.json) {
      console.log(JSON.stringify({
        error: error instanceof Error ? error.message : String(error)
      }));
    } else {
      console.error('Error checking status:', error);
    }
    return 1;
  }
}
