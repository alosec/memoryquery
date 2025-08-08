/**
 * Start command - starts services WITHOUT importing sync-daemon
 */

import { startDaemon, startMCPServer, isDaemonRunning } from '../utils/process-manager';
import { checkProcesses } from '../utils/external-validator';
import * as path from 'path';
import * as os from 'os';

export async function startCommand(options: {
  dbPath?: string;
  projectsPath?: string;
  mcpOnly?: boolean;
  syncOnly?: boolean;
}) {
  console.log('🚀 Starting Simple Memory MCP...');
  
  const dbPath = options.dbPath || path.join(os.homedir(), '.local/share/simple-memory/mcp.db');
  const projectsPath = options.projectsPath || path.join(os.homedir(), '.claude', 'projects');
  
  const results = {
    syncDaemon: { started: false, error: null as string | null },
    mcpServer: { started: false, error: null as string | null }
  };

  try {
    // Check what's already running
    const processes = await checkProcesses();
    
    // Start sync daemon unless mcp-only mode
    if (!options.mcpOnly) {
      if (processes.syncDaemon) {
        console.log('⚠️  Sync daemon already running (PID: ' + processes.pids.syncDaemon + ')');
        results.syncDaemon.started = true;
      } else {
        console.log('🔄 Starting sync daemon...');
        const syncResult = await startDaemon({
          dbPath,
          projectsPath
        });
        
        if (syncResult.success) {
          console.log('✅ Sync daemon started (PID: ' + syncResult.pid + ')');
          results.syncDaemon.started = true;
        } else {
          console.error('❌ Failed to start sync daemon:', syncResult.error);
          results.syncDaemon.error = syncResult.error || 'Unknown error';
        }
      }
    }
    
    // Start MCP server unless sync-only mode
    if (!options.syncOnly) {
      if (processes.mcpServer) {
        console.log('⚠️  MCP server already running (PID: ' + processes.pids.mcpServer + ')');
        results.mcpServer.started = true;
      } else {
        console.log('📚 Starting MCP server...');
        const mcpResult = await startMCPServer({
          dbPath
        });
        
        if (mcpResult.success) {
          console.log('✅ MCP server started (PID: ' + mcpResult.pid + ')');
          results.mcpServer.started = true;
        } else {
          console.error('❌ Failed to start MCP server:', mcpResult.error);
          results.mcpServer.error = mcpResult.error || 'Unknown error';
        }
      }
    }
    
    // Summary
    const successCount = [
      !options.mcpOnly && results.syncDaemon.started,
      !options.syncOnly && results.mcpServer.started
    ].filter(Boolean).length;
    
    const expectedCount = [!options.mcpOnly, !options.syncOnly].filter(Boolean).length;
    
    if (successCount === expectedCount) {
      console.log('🎉 All requested services started successfully');
      
      // Set up graceful shutdown handlers
      const shutdown = async (signal: string) => {
        console.log(`\n👋 Received ${signal}, shutting down services...`);
        
        // Note: We don't import stopDaemon here to avoid sync-daemon import
        // The processes will be cleaned up by the OS or manual stop command
        console.log('🛑 Use "npm stop" to stop services');
        process.exit(0);
      };
      
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      
      // Keep process alive if services were started
      if (successCount > 0) {
        console.log('\n📝 Services running. Press Ctrl+C to stop.');
        // Keep the process running
        setInterval(() => {}, 1000 * 60 * 60); // Heartbeat every hour
      }
      
      return 0;
    } else {
      console.error('⚠️  Some services failed to start');
      return 1;
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return 1;
  }
}
