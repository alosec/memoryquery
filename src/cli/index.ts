#!/usr/bin/env node

/**
 * CLI entry point for simple-memory-mcp
 */

import { program } from 'commander';
import { createMemoryServer } from '../mcp-server';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.local/share/cafe-db/claude_code.db');

program
  .name('simple-memory')
  .description('Unified memory system for AI coding tools')
  .version('0.1.0');

program
  .command('start')
  .description('Start the MCP server and sync daemon')
  .option('--db-path <path>', 'Path to Claude Code database', DEFAULT_DB_PATH)
  .action(async (options) => {
    console.log('🚀 Starting Simple Memory MCP...');
    
    try {
      const server = createMemoryServer({
        name: 'simple-memory-mcp',
        version: '0.1.0',
        dbPath: options.dbPath
      });
      
      console.log('📚 MCP server starting...');
      await server.start();
      console.log('✅ MCP server running');
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log('\n👋 Shutting down...');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check service status')
  .action(() => {
    console.log('🔍 Service Status:');
    console.log('MCP Server: Not implemented yet');
    console.log('Sync Daemon: Not implemented yet');
  });

program
  .command('stop')
  .description('Stop all services')
  .action(() => {
    console.log('🛑 Stopping services...');
    console.log('Not implemented yet');
  });

program
  .command('logs')
  .description('View service logs')
  .action(() => {
    console.log('📋 Service Logs:');
    console.log('Not implemented yet');
  });

program.parse();