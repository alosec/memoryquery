/**
 * Main entry point for the MCP memory server
 */

import * as path from 'path';
import * as os from 'os';
import { createMemoryServer, ServerConfig } from './server';

// Default Simple Memory database path
const DEFAULT_DB_PATH = path.join(os.homedir(), '.local/share/simple-memory/mcp.db');

/**
 * Create server configuration from environment variables
 */
function createServerConfig(): ServerConfig {
  return {
    name: 'simple-memory-mcp',
    version: '0.1.0',
    dbPath: process.env.SIMPLE_MEMORY_DB_PATH || DEFAULT_DB_PATH
  };
}

/**
 * Start the MCP server
 */
async function main() {
  try {
    const config = createServerConfig();
    const server = createMemoryServer(config);
    
    // Start the server
    await server.start();
    
    // Keep the process running
    process.on('SIGINT', () => {
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (require.main === module) {
  main();
}

export { createMemoryServer, ServerConfig };