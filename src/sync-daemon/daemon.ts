#!/usr/bin/env node

/**
 * Daemon wrapper for sync daemon - ensures proper background execution
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Parse command line arguments
const args = process.argv.slice(2);
const isDaemon = args.includes('--daemon') || args.includes('--background');
const logDir = path.join(os.homedir(), '.local/share/simple-memory/logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Generate log file names with timestamp
const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
const stdoutLog = path.join(logDir, `sync-daemon-${timestamp}.log`);
const stderrLog = path.join(logDir, `sync-daemon-${timestamp}.error.log`);
const pidFile = path.join(logDir, 'sync-daemon.pid');

if (isDaemon) {
  // Fork as a daemon
  console.log('🚀 Starting sync daemon in background mode...');
  console.log(`📝 Logs: ${stdoutLog}`);
  console.log(`📝 Errors: ${stderrLog}`);
  
  // Open log files
  const out = fs.openSync(stdoutLog, 'a');
  const err = fs.openSync(stderrLog, 'a');
  
  // Spawn the actual sync daemon
  const child = spawn(process.execPath, [
    path.join(__dirname, 'index.js')
  ], {
    detached: true,
    stdio: ['ignore', out, err],
    env: process.env
  });
  
  // Write PID file
  if (child.pid) {
    fs.writeFileSync(pidFile, child.pid.toString());
    console.log(`✅ Sync daemon started (PID: ${child.pid})`);
    console.log(`💡 To stop: npm stop or kill ${child.pid}`);
  }
  
  // Detach from parent
  child.unref();
  
  // Exit parent process
  process.exit(0);
} else {
  // Run in foreground - import and run main
  console.log('📋 Starting sync daemon in foreground mode...');
  console.log('💡 Use --daemon or --background flag to run in background');
  
  import('./index.js').then(module => {
    // Check if main is exported, otherwise it auto-runs
    if (module.main) {
      module.main().catch((error: any) => {
        console.error('Fatal error:', error);
        process.exit(1);
      });
    }
  }).catch(error => {
    console.error('Failed to load sync daemon:', error);
    process.exit(1);
  });
}
