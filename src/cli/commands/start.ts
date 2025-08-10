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
  daemon?: boolean;
  background?: boolean;
  interactive?: boolean;
}) {
  console.log('🚀 Starting MemoryQuery...');
  
  const dbPath = options.dbPath || path.join(os.homedir(), '.local/share/memoryquery/mcp.db');
  const projectsPath = options.projectsPath || path.join(os.homedir(), '.claude', 'projects');
  const useDaemon = options.interactive ? false : (options.daemon || options.background || true); // Default to daemon mode unless interactive requested
  
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
          projectsPath,
          daemon: useDaemon
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
      
      // Only keep process alive if explicitly requested to run in interactive mode
      if (!useDaemon && successCount > 0 && !options.syncOnly) {
        // Set up graceful shutdown handlers
        const shutdown = async (signal: string) => {
          console.log(`\n👋 Received ${signal}, shutting down services...`);
          console.log('🛑 Use "npm stop" to stop services');
          process.exit(0);
        };
        
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        console.log('\n📝 Services running. Press Ctrl+C to stop.');
        console.log('💡 Use "npm run start:daemon" for background mode');
        // Keep the process running
        setInterval(() => {}, 1000 * 60 * 60); // Heartbeat every hour
      } else {
        console.log('✅ Services started in background mode');
        console.log('💡 Use "npm run status" to check status');
        console.log('💡 Use "npm run logs" to view recent output');
        console.log('💡 Use "npm stop" to stop services');
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
