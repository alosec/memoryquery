/**
 * Process management utilities for CLI commands
 * Manages sync-daemon as a separate child process WITHOUT importing it
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

interface DaemonProcess {
  process: ChildProcess;
  pid: number;
  startTime: Date;
}

// Keep track of spawned processes
const activeProcesses = new Map<string, DaemonProcess>();

/**
 * Start the sync daemon as a separate process
 */
export async function startDaemon(config?: {
  dbPath?: string;
  projectsPath?: string;
  daemon?: boolean;
}): Promise<{ success: boolean; pid?: number; error?: string }> {
  try {
    // Check if already running externally
    const running = await isDaemonRunning();
    if (running.running) {
      return {
        success: false,
        error: 'Sync daemon is already running (PID: ' + running.pid + ')'
      };
    }

    // Find the sync daemon entry point
    const possiblePaths = [
      path.join(process.cwd(), 'dist', 'sync-daemon', 'daemon.js'),  // New daemon wrapper
      path.join(process.cwd(), 'dist', 'sync-daemon', 'index.js'),
      path.join(process.cwd(), 'src', 'sync-daemon', 'daemon.ts'),   // TypeScript daemon wrapper
      path.join(process.cwd(), 'src', 'sync-daemon', 'index.ts'),
      path.join(__dirname, '..', '..', 'sync-daemon', 'daemon.js')
    ];

    let daemonPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        daemonPath = p;
        break;
      }
    }

    if (!daemonPath) {
      return {
        success: false,
        error: 'Could not find sync daemon entry point. Run "npm run build" first.'
      };
    }

    // Prepare environment variables
    const env = { ...process.env };
    if (config?.dbPath) {
      env.SIMPLE_MEMORY_DB_PATH = config.dbPath;
    }
    if (config?.projectsPath) {
      env.CLAUDE_PROJECTS_PATH = config.projectsPath;
    }

    // Determine how to run the daemon
    const isTypeScript = daemonPath.endsWith('.ts');
    const command = isTypeScript ? 'tsx' : 'node';
    
    // Build arguments
    const args = [daemonPath];
    if (config?.daemon !== false) {
      // Default to daemon mode unless explicitly disabled
      args.push('--daemon');
    }
    
    // Spawn the daemon
    const child = spawn(command, args, {
      detached: false,  // Let daemon wrapper handle detaching
      stdio: config?.daemon !== false ? 'ignore' : 'inherit',
      env
    });

    if (!child.pid) {
      return {
        success: false,
        error: 'Failed to spawn sync daemon process'
      };
    }

    // Store process reference (only if not daemon mode)
    if (config?.daemon === false) {
      activeProcesses.set('sync-daemon', {
        process: child,
        pid: child.pid,
        startTime: new Date()
      });
    }

    // For daemon mode, wait a bit to get the actual PID
    if (config?.daemon !== false) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if daemon started successfully
      const running = await isDaemonRunning();
      if (running.running) {
        return {
          success: true,
          pid: running.pid
        };
      } else {
        return {
          success: false,
          error: 'Daemon failed to start - check logs in ~/.local/share/simple-memory/logs/'
        };
      }
    }

    // For foreground mode, just check if process started
    return {
      success: true,
      pid: child.pid
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Stop the sync daemon process
 */
export async function stopDaemon(): Promise<{ success: boolean; error?: string }> {
  try {
    // First check PID file
    const pidFile = path.join(os.homedir(), '.local/share/simple-memory/logs/sync-daemon.pid');
    if (fs.existsSync(pidFile)) {
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
        process.kill(pid, 'SIGTERM');
        
        // Give it a moment to exit cleanly
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if it actually stopped
        try {
          process.kill(pid, 0); // Check if still running
          // If we get here, it's still running, force kill
          process.kill(pid, 'SIGKILL');
        } catch {
          // Process is gone, which is what we want
        }
        
        // Remove PID file
        fs.unlinkSync(pidFile);
        return { success: true };
      } catch (error) {
        // Try to remove stale PID file
        try { fs.unlinkSync(pidFile); } catch {}
      }
    }
    
    // Then check our tracked processes
    const tracked = activeProcesses.get('sync-daemon');
    if (tracked) {
      try {
        process.kill(tracked.pid, 'SIGTERM');
        activeProcesses.delete('sync-daemon');
        
        // Give it a moment to exit cleanly
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if it actually stopped
        try {
          process.kill(tracked.pid, 0); // Check if still running
          // If we get here, it's still running, force kill
          process.kill(tracked.pid, 'SIGKILL');
        } catch {
          // Process is gone, which is what we want
        }
        
        return { success: true };
      } catch (error) {
        // Process might have already exited
        activeProcesses.delete('sync-daemon');
      }
    }

    // Check for externally running daemon
    const running = await isDaemonRunning();
    if (!running.running) {
      return {
        success: true // Already stopped
      };
    }

    if (running.pid) {
      // Try graceful shutdown first
      try {
        process.kill(running.pid, 'SIGTERM');
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if stopped
        const stillRunning = await isDaemonRunning();
        if (stillRunning.running && stillRunning.pid) {
          // Force kill
          process.kill(stillRunning.pid, 'SIGKILL');
        }
        
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `Failed to stop process ${running.pid}: ${error}`
        };
      }
    }

    // Try pkill as last resort
    await execAsync('pkill -f "sync-daemon"').catch(() => {});
    
    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if sync daemon is running
 */
export async function isDaemonRunning(): Promise<{ running: boolean; pid?: number }> {
  // First check PID file
  const pidFile = path.join(os.homedir(), '.local/share/simple-memory/logs/sync-daemon.pid');
  if (fs.existsSync(pidFile)) {
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      // Check if process is still alive
      process.kill(pid, 0);
      return { running: true, pid };
    } catch {
      // PID file exists but process is dead, remove stale PID file
      fs.unlinkSync(pidFile);
    }
  }
  
  // Then check our tracked processes
  const tracked = activeProcesses.get('sync-daemon');
  if (tracked) {
    try {
      // Check if process is still alive
      process.kill(tracked.pid, 0);
      return { running: true, pid: tracked.pid };
    } catch {
      // Process is dead, remove from tracking
      activeProcesses.delete('sync-daemon');
    }
  }

  // Check system processes
  try {
    const { stdout } = await execAsync('ps aux | grep -v grep | grep "sync-daemon\\|simple-memory.*sync"');
    if (stdout.trim()) {
      // Extract PID from ps output
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/^\S+\s+(\d+)/);
        if (match) {
          return { running: true, pid: parseInt(match[1]) };
        }
      }
      return { running: true };
    }
  } catch {
    // No process found
  }

  return { running: false };
}

/**
 * Start the MCP server as a separate process
 */
export async function startMCPServer(config?: {
  dbPath?: string;
}): Promise<{ success: boolean; pid?: number; error?: string }> {
  try {
    // Find MCP server entry point
    const possiblePaths = [
      path.join(process.cwd(), 'dist', 'mcp-server', 'server.js'),
      path.join(process.cwd(), 'src', 'mcp-server', 'server.ts'),
      path.join(__dirname, '..', '..', 'mcp-server', 'server.js')
    ];

    let serverPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        serverPath = p;
        break;
      }
    }

    if (!serverPath) {
      return {
        success: false,
        error: 'Could not find MCP server entry point. Run "npm run build" first.'
      };
    }

    // Prepare environment
    const env = { ...process.env };
    if (config?.dbPath) {
      env.SIMPLE_MEMORY_DB_PATH = config.dbPath;
    }

    // Determine how to run
    const isTypeScript = serverPath.endsWith('.ts');
    const command = isTypeScript ? 'tsx' : 'node';

    // Spawn the server
    const child = spawn(command, [serverPath], {
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env
    });

    if (!child.pid) {
      return {
        success: false,
        error: 'Failed to spawn MCP server process'
      };
    }

    // Store process reference
    activeProcesses.set('mcp-server', {
      process: child,
      pid: child.pid,
      startTime: new Date()
    });

    // Let it run independently
    child.unref();

    return {
      success: true,
      pid: child.pid
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Clean up any tracked processes on exit
 */
process.on('exit', () => {
  for (const [name, proc] of activeProcesses) {
    try {
      process.kill(proc.pid, 'SIGTERM');
    } catch {
      // Process might already be gone
    }
  }
});
