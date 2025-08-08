#!/usr/bin/env node

/**
 * CLI entry point for simple-memory-mcp
 * IMPORTANT: This file must NOT import sync-daemon to avoid triggering sync during module loading
 */

import { program } from 'commander';
import { statusCommand } from './commands/status';
import { startCommand } from './commands/start';
import { stopCommand } from './commands/stop';
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
    const exitCode = await startCommand(options);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
    // Note: startCommand keeps process alive if services started
  });

program
  .command('stop')
  .description('Stop all services')
  .option('--force', 'Force stop services')
  .action(async (options) => {
    const exitCode = await stopCommand(options);
    process.exit(exitCode);
  });

program
  .command('status')
  .description('Check service status')
  .option('--json', 'Output status as JSON')
  .option('--db-path <path>', 'Path to Claude Code database', DEFAULT_DB_PATH)
  .option('--projects-path <path>', 'Path to Claude Code projects directory')
  .action(async (options) => {
    const exitCode = await statusCommand(options);
    process.exit(exitCode);
  });

program
  .command('logs')
  .description('View service logs')
  .option('--tail <lines>', 'Number of lines to show', '50')
  .option('--follow', 'Follow log output')
  .action(async (options) => {
    console.log('📋 Viewing logs...');
    
    // Log files are typically in ~/.local/share/simple-memory/logs/
    const logsPath = path.join(os.homedir(), '.local/share/simple-memory/logs');
    
    console.log(`Log directory: ${logsPath}`);
    console.log('');
    
    try {
      const fs = await import('fs');
      
      if (!fs.existsSync(logsPath)) {
        console.log('No logs directory found. Services may not have been started yet.');
        process.exit(0);
      }
      
      const files = fs.readdirSync(logsPath).filter(f => f.endsWith('.log'));
      
      if (files.length === 0) {
        console.log('No log files found.');
        process.exit(0);
      }
      
      console.log('Available log files:');
      files.forEach(file => {
        const stats = fs.statSync(path.join(logsPath, file));
        console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      });
      
      // Show most recent log
      const mostRecent = files.sort((a, b) => {
        const statA = fs.statSync(path.join(logsPath, a));
        const statB = fs.statSync(path.join(logsPath, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      })[0];
      
      if (mostRecent) {
        console.log(`\nShowing last ${options.tail} lines from ${mostRecent}:`);
        console.log('-'.repeat(50));
        
        const content = fs.readFileSync(path.join(logsPath, mostRecent), 'utf-8');
        const lines = content.split('\n');
        const tailLines = lines.slice(-parseInt(options.tail));
        
        console.log(tailLines.join('\n'));
        
        if (options.follow) {
          console.log('\n[Following log output - Press Ctrl+C to stop]');
          // Simple tail -f implementation
          const { spawn } = await import('child_process');
          const tail = spawn('tail', ['-f', path.join(logsPath, mostRecent)]);
          tail.stdout.pipe(process.stdout);
          tail.stderr.pipe(process.stderr);
        }
      }
      
    } catch (error) {
      console.error('Error reading logs:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
