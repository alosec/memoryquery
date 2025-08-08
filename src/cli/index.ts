#!/usr/bin/env node

/**
 * CLI entry point for simple-memory-mcp
 */

import { program } from 'commander';
import { createMemoryServer } from '../mcp-server';
import { startSyncDaemon, stopSyncDaemon, getSyncDaemonStatus } from '../sync-daemon';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.local/share/simple-memory/mcp.db');

program
  .name('simple-memory')
  .description('Unified memory system for AI coding tools')
  .version('0.1.0');

program
  .command('start')
  .description('Start the MCP server and sync daemon')
  .option('--db-path <path>', 'Path to Claude Code database', DEFAULT_DB_PATH)
  .option('--projects-path <path>', 'Path to Claude Code projects directory')
  .option('--mcp-only', 'Start only MCP server, not sync daemon')
  .option('--sync-only', 'Start only sync daemon, not MCP server')
  .action(async (options) => {
    console.log('🚀 Starting Simple Memory MCP...');
    
    const promises: Promise<any>[] = [];
    let mcpServer: any = null;
    
    try {
      // Start MCP server unless sync-only mode
      if (!options.syncOnly) {
        console.log('📚 MCP server starting...');
        mcpServer = createMemoryServer({
          name: 'simple-memory-mcp',
          version: '0.1.0',
          dbPath: options.dbPath
        });
        
        promises.push(mcpServer.start().then(() => {
          console.log('✅ MCP server running');
        }));
      }
      
      // Start sync daemon unless mcp-only mode
      if (!options.mcpOnly) {
        console.log('🔄 Sync daemon starting...');
        const syncConfig = {
          dbPath: options.dbPath,
          projectsPath: options.projectsPath
        };
        
        promises.push(startSyncDaemon(syncConfig).then(() => {
          console.log('✅ Sync daemon running');
        }));
      }
      
      // Wait for all services to start
      await Promise.all(promises);
      console.log('🎉 All services started successfully');
      
      // Set up graceful shutdown
      const shutdown = async () => {
        console.log('\n👋 Shutting down services...');
        
        try {
          // Stop sync daemon if it was started
          if (!options.mcpOnly) {
            console.log('🔄 Stopping sync daemon...');
            await stopSyncDaemon('shutdown_signal');
            console.log('✅ Sync daemon stopped');
          }
          
          // MCP server will be stopped by process exit
          console.log('🛑 All services stopped');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      };
      
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      
    } catch (error) {
      console.error('❌ Failed to start:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check service status')
  .action(async () => {
    console.log('🔍 Service Status:');
    
    try {
      const status = await getSyncDaemonStatus();
      
      console.log(`Sync Daemon: ${status.running ? '✅ Running' : '❌ Stopped'}`);
      
      if (status.running && status.health) {
        console.log(`  Health: ${status.health.status}`);
        if (status.health.details?.database) {
          console.log(`  Database: ${status.health.details.database.accessible ? '✅ Connected' : '❌ Error'}`);
          console.log(`  Records: ${status.health.details.database.recordCount || 0}`);
        }
        if (status.health.details?.watcher) {
          console.log(`  File Watcher: ${status.health.details.watcher.active ? '✅ Active' : '❌ Inactive'}`);
        }
      }
      
      // TODO: Add MCP server status check when available
      console.log('MCP Server: Status check not implemented yet');
      
    } catch (error) {
      console.error('❌ Failed to get status:', error);
    }
  });

program
  .command('stop')
  .description('Stop all services')
  .action(async () => {
    console.log('🛑 Stopping services...');
    
    try {
      const status = await getSyncDaemonStatus();
      
      if (status.running) {
        console.log('🔄 Stopping sync daemon...');
        await stopSyncDaemon('manual_stop');
        console.log('✅ Sync daemon stopped');
      } else {
        console.log('ℹ️  Sync daemon was not running');
      }
      
      // TODO: Stop MCP server when status check available
      console.log('ℹ️  MCP server stop not implemented yet');
      
    } catch (error) {
      console.error('❌ Failed to stop services:', error);
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('View service logs')
  .option('--lines <n>', 'Number of recent log lines to show', '50')
  .option('--follow', 'Follow logs in real-time')
  .action(async (options) => {
    console.log('📋 Service Logs:');
    
    try {
      if (options.follow) {
        console.log('ℹ️  Real-time log following not implemented yet');
        console.log('ℹ️  Showing recent logs instead...\n');
      }
      
      const { getRecentLogs } = await import('../sync-daemon/execute/transaction-log.js');
      const logs = getRecentLogs(parseInt(options.lines));
      
      if (logs.length === 0) {
        console.log('ℹ️  No logs found');
        return;
      }
      
      for (const log of logs) {
        const timestamp = log.timestamp.replace('T', ' ').replace('Z', '');
        const level = log.level.toUpperCase().padEnd(5);
        const event = log.event.padEnd(25);
        
        let line = `${timestamp} [${level}] ${event}`;
        
        // Add relevant context
        if (log.data.sessionId) {
          line += ` session=${log.data.sessionId.substring(0, 8)}`;
        }
        if (log.data.filePath) {
          const filename = log.data.filePath.split('/').pop();
          line += ` file=${filename}`;
        }
        if (log.data.messageCount !== undefined) {
          line += ` messages=${log.data.messageCount}`;
        }
        
        // Color code by level
        switch (log.level) {
          case 'error':
            console.log('\x1b[31m%s\x1b[0m', line); // Red
            break;
          case 'warn':
            console.log('\x1b[33m%s\x1b[0m', line); // Yellow
            break;
          case 'debug':
            console.log('\x1b[36m%s\x1b[0m', line); // Cyan
            break;
          default:
            console.log(line);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to retrieve logs:', error);
    }
  });

program.parse();