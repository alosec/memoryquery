/**
 * Database reset command
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as readline from 'readline';

interface ResetOptions {
  force?: boolean;
  dbPath?: string;
}

/**
 * Reset database command
 */
export async function resetCommand(options: ResetOptions = {}): Promise<void> {
  const dbPath = options.dbPath || path.join(os.homedir(), '.local/share/memoryquery/mcp.db');
  
  console.log('MemoryQuery - Database Reset');
  console.log('=====================================');
  console.log(`Database: ${dbPath}`);
  
  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.log('✓ Database does not exist - nothing to reset');
    return;
  }
  
  // Get confirmation unless --force is used
  if (!options.force) {
    const confirmed = await confirmReset();
    if (!confirmed) {
      console.log('Reset cancelled by user');
      return;
    }
  }
  
  try {
    // Stop any running services first
    console.log('Stopping any running services...');
    await stopServices();
    
    // Remove database file
    console.log('Removing database file...');
    fs.unlinkSync(dbPath);
    
    // Remove logs directory
    const logsDir = path.join(os.homedir(), '.local/share/memoryquery/logs');
    if (fs.existsSync(logsDir)) {
      console.log('Clearing logs directory...');
      fs.rmSync(logsDir, { recursive: true, force: true });
    }
    
    console.log('');
    console.log('✓ Database reset complete');
    console.log('');
    console.log('Next steps:');
    console.log('  npm start    # Start sync daemon for full reprocessing');
    console.log('  npm status   # Check sync progress');
    
  } catch (error) {
    console.error('❌ Reset failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Ask user for confirmation
 */
async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\n⚠️  This will permanently delete all conversation data. Continue? (y/N): ', (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Stop running services
 */
async function stopServices(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // Kill sync daemon processes
    await execAsync('pkill -f "memoryquery.*sync" || true').catch(() => {});
    await execAsync('pkill -f "sync-daemon" || true').catch(() => {});
    
    // Kill MCP server processes
    await execAsync('pkill -f "memoryquery.*mcp" || true').catch(() => {});
    await execAsync('pkill -f "mcp-server" || true').catch(() => {});
    
    // Remove PID files
    const pidFile = path.join(os.homedir(), '.local/share/memoryquery/logs/sync-daemon.pid');
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
    
    // Wait a moment for processes to terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.warn('Warning: Could not stop all services:', error instanceof Error ? error.message : String(error));
  }
}