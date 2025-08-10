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

const DEFAULT_DB_PATH = path.join(os.homedir(), '.local/share/memoryquery/mcp.db');

program
  .name('memoryquery')
  .description('SQL-based memory system for AI conversation history')
  .version('0.1.0');

program
  .command('start')
  .description('Start the MCP server and sync daemon')
  .option('--db-path <path>', 'Path to Claude Code database', DEFAULT_DB_PATH)
  .option('--projects-path <path>', 'Path to Claude Code projects directory')
  .option('--mcp-only', 'Start only MCP server, not sync daemon')
  .option('--sync-only', 'Start only sync daemon, not MCP server')
  .option('--daemon', 'Run services in background/daemon mode (default)')
  .option('--background', 'Alias for --daemon')
  .option('--interactive', 'Run services in foreground interactive mode')
  .action(async (options) => {
    const exitCode = await startCommand(options);
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
    // Note: startCommand keeps process alive if needed
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
  .option('-n, --lines <lines>', 'Number of lines to show (default: 50)', '50')
  .option('-f, --follow', 'Follow log output continuously')
  .option('--sync', 'Show only sync daemon logs')
  .option('--mcp', 'Show only MCP server logs')
  .action(async (options) => {
    try {
      const { logsCommand } = await import('./commands/logs');
      const exitCode = await logsCommand(options);
      if (!options.follow) {
        process.exit(exitCode);
      }
      // If following, keep process alive
    } catch (error) {
      console.error('Error loading logs command:', error);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Reset the database (WARNING: deletes all data)')
  .option('--force', 'Skip confirmation prompt and reset immediately')
  .option('--db-path <path>', 'Path to database to reset', DEFAULT_DB_PATH)
  .action(async (options) => {
    try {
      const { resetCommand } = await import('./commands/reset');
      await resetCommand(options);
      process.exit(0);
    } catch (error) {
      console.error('Error in reset command:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
