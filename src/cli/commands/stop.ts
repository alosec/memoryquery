/**
 * Stop command - stops services WITHOUT importing sync-daemon
 */

import { stopDaemon } from '../utils/process-manager';
import { checkProcesses } from '../utils/external-validator';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function stopCommand(options?: {
  force?: boolean;
}) {
  console.log('🛑 Stopping Simple Memory MCP services...');
  
  const results = {
    syncDaemon: { stopped: false, error: null as string | null },
    mcpServer: { stopped: false, error: null as string | null }
  };

  try {
    // Check what's running
    const processes = await checkProcesses();
    
    // Stop sync daemon
    if (processes.syncDaemon) {
      console.log('🔄 Stopping sync daemon (PID: ' + processes.pids.syncDaemon + ')...');
      const stopResult = await stopDaemon();
      
      if (stopResult.success) {
        console.log('✅ Sync daemon stopped');
        results.syncDaemon.stopped = true;
      } else {
        console.error('❌ Failed to stop sync daemon:', stopResult.error);
        results.syncDaemon.error = stopResult.error || 'Unknown error';
        
        if (options?.force && processes.pids.syncDaemon) {
          console.log('⚠️  Force killing sync daemon...');
          try {
            process.kill(processes.pids.syncDaemon, 'SIGKILL');
            results.syncDaemon.stopped = true;
            console.log('✅ Sync daemon force killed');
          } catch (e) {
            console.error('❌ Failed to force kill:', e);
          }
        }
      }
    } else {
      console.log('ℹ️  Sync daemon not running');
      results.syncDaemon.stopped = true;
    }
    
    // Stop MCP server
    if (processes.mcpServer) {
      console.log('📚 Stopping MCP server (PID: ' + processes.pids.mcpServer + ')...');
      
      try {
        if (processes.pids.mcpServer) {
          // Try graceful shutdown
          process.kill(processes.pids.mcpServer, 'SIGTERM');
          
          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if still running
          try {
            process.kill(processes.pids.mcpServer, 0);
            // Still running, force kill if requested
            if (options?.force) {
              process.kill(processes.pids.mcpServer, 'SIGKILL');
            }
          } catch {
            // Process is gone, good
          }
          
          console.log('✅ MCP server stopped');
          results.mcpServer.stopped = true;
        } else {
          // Try pkill as fallback
          await execAsync('pkill -f "mcp-server"').catch(() => {});
          console.log('✅ MCP server stopped');
          results.mcpServer.stopped = true;
        }
      } catch (error) {
        console.error('❌ Failed to stop MCP server:', error);
        results.mcpServer.error = error instanceof Error ? error.message : String(error);
        
        if (options?.force) {
          console.log('⚠️  Force killing MCP server...');
          try {
            await execAsync('pkill -9 -f "mcp-server"');
            results.mcpServer.stopped = true;
            console.log('✅ MCP server force killed');
          } catch (e) {
            console.error('❌ Failed to force kill:', e);
          }
        }
      }
    } else {
      console.log('ℹ️  MCP server not running');
      results.mcpServer.stopped = true;
    }
    
    // Clean up any stray processes
    if (options?.force) {
      console.log('🧹 Cleaning up any stray processes...');
      try {
        await execAsync('pkill -f "simple-memory"').catch(() => {});
        console.log('✅ Cleanup complete');
      } catch {
        // Ignore errors
      }
    }
    
    // Summary
    const allStopped = results.syncDaemon.stopped && results.mcpServer.stopped;
    
    if (allStopped) {
      console.log('✅ All services stopped successfully');
      return 0;
    } else {
      console.error('⚠️  Some services could not be stopped');
      if (!options?.force) {
        console.log('💡 Try running with --force to forcefully terminate services');
      }
      return 1;
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return 1;
  }
}
