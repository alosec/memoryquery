/**
 * Logs command - view and follow service logs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

export interface LogsOptions {
  lines?: string;
  follow?: boolean;
  sync?: boolean;
  mcp?: boolean;
}

export async function logsCommand(options: LogsOptions): Promise<number> {
  const logsPath = path.join(os.homedir(), '.local/share/simple-memory/logs');
  const lines = parseInt(options.lines || '50');
  
  if (!fs.existsSync(logsPath)) {
    if (options.follow) {
      console.log('📋 No logs directory found. Waiting for services to start...');
      console.log(`    Watching: ${logsPath}`);
      console.log('    Press Ctrl+C to stop');
      
      // Watch for directory creation
      const parentDir = path.dirname(logsPath);
      if (fs.existsSync(parentDir)) {
        const watcher = fs.watchFile(logsPath, (curr) => {
          if (curr.isDirectory()) {
            console.log('✅ Logs directory created, starting to follow...');
            fs.unwatchFile(logsPath);
            followLogs(logsPath, options);
          }
        });
      }
      return 0;
    } else {
      console.log('📋 No logs directory found. Services may not have been started yet.');
      console.log(`    Expected location: ${logsPath}`);
      console.log('    Try running: npm start');
      return 1;
    }
  }

  const files = getLogFiles(logsPath, options);
  
  if (files.length === 0) {
    if (options.follow) {
      console.log('📋 No matching log files found. Waiting for logs...');
      console.log('    Press Ctrl+C to stop');
      setTimeout(() => {
        // Check again after a short delay
        return logsCommand(options);
      }, 1000);
      return 0;
    } else {
      console.log('📋 No matching log files found.');
      console.log(`    Log directory: ${logsPath}`);
      if (options.sync || options.mcp) {
        console.log(`    Filter: ${options.sync ? 'sync daemon' : 'MCP server'} logs only`);
      }
      return 1;
    }
  }

  if (!options.follow) {
    // Static output - show recent logs and exit
    console.log('📋 Recent service logs:');
    console.log('━'.repeat(60));
    
    for (const file of files) {
      await showRecentLogs(path.join(logsPath, file), lines, file);
    }
    
    console.log('━'.repeat(60));
    console.log(`💡 Use -f to follow logs continuously`);
    console.log(`💡 Use -n <number> to change line count (current: ${lines})`);
    
    return 0;
  } else {
    // Follow mode
    return followLogs(logsPath, options);
  }
}

function getLogFiles(logsPath: string, options: LogsOptions): string[] {
  try {
    const allFiles = fs.readdirSync(logsPath).filter(f => f.endsWith('.log'));
    
    let files = allFiles;
    
    if (options.sync && !options.mcp) {
      files = allFiles.filter(f => f.includes('sync') || f.includes('daemon'));
    } else if (options.mcp && !options.sync) {
      files = allFiles.filter(f => f.includes('mcp') || f.includes('server'));
    }
    
    // Sort by modification time (newest first)
    return files.sort((a, b) => {
      const statA = fs.statSync(path.join(logsPath, a));
      const statB = fs.statSync(path.join(logsPath, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });
  } catch (error) {
    return [];
  }
}

async function showRecentLogs(filePath: string, lines: number, fileName: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const logLines = content.split('\n').filter(line => line.trim());
    
    const recentLines = logLines.slice(-lines);
    
    if (recentLines.length === 0) {
      console.log(`📄 ${fileName} (${(stats.size / 1024).toFixed(1)} KB) - empty`);
      return;
    }
    
    console.log(`📄 ${fileName} (${(stats.size / 1024).toFixed(1)} KB) - last ${recentLines.length} lines:`);
    console.log('');
    
    recentLines.forEach(line => {
      // Simple log formatting - color-code by log level
      if (line.includes('[ERROR]') || line.includes('ERROR')) {
        console.log(`\x1b[31m${line}\x1b[0m`); // Red
      } else if (line.includes('[WARN]') || line.includes('WARN')) {
        console.log(`\x1b[33m${line}\x1b[0m`); // Yellow  
      } else if (line.includes('[DEBUG]') || line.includes('DEBUG')) {
        console.log(`\x1b[36m${line}\x1b[0m`); // Cyan
      } else {
        console.log(line);
      }
    });
    
    console.log('');
  } catch (error) {
    console.log(`📄 ${fileName} - Error reading file: ${error}`);
  }
}

function followLogs(logsPath: string, options: LogsOptions): number {
  console.log('📋 Following logs (Press Ctrl+C to stop)...');
  console.log('━'.repeat(60));
  
  const files = getLogFiles(logsPath, options);
  
  if (files.length === 0) {
    console.log('⚠️  No log files to follow');
    return 1;
  }
  
  // Use tail -f to follow the most recent log file
  const mostRecentFile = files[0];
  const filePath = path.join(logsPath, mostRecentFile);
  
  console.log(`Following: ${mostRecentFile}`);
  console.log('');
  
  const tail = spawn('tail', ['-f', filePath], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Color-code output
  tail.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line: string) => {
      if (!line.trim()) return;
      
      if (line.includes('[ERROR]') || line.includes('ERROR')) {
        process.stdout.write(`\x1b[31m${line}\x1b[0m\n`); // Red
      } else if (line.includes('[WARN]') || line.includes('WARN')) {
        process.stdout.write(`\x1b[33m${line}\x1b[0m\n`); // Yellow  
      } else if (line.includes('[DEBUG]') || line.includes('DEBUG')) {
        process.stdout.write(`\x1b[36m${line}\x1b[0m\n`); // Cyan
      } else {
        process.stdout.write(`${line}\n`);
      }
    });
  });
  
  tail.stderr.pipe(process.stderr);
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping log follow...');
    tail.kill();
    process.exit(0);
  });
  
  tail.on('exit', (code) => {
    if (code !== 0) {
      console.error(`\n❌ tail process exited with code ${code}`);
    }
    process.exit(code || 0);
  });
  
  return 0;
}