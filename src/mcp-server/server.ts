/**
 * MCP server setup and configuration for Claude Code memory
 */

import { createDatabaseConnection } from './database/connection';
import { DatabaseQueries } from './database/queries';
import { ToolHandlers } from './tools/handlers';
import { TOOL_SCHEMAS } from './tools/schema';
import { createStdioTransport } from './transport';
import { createErrorHandler } from './utils/errors';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

export interface ServerConfig {
  name: string;
  version: string;
  dbPath: string;
}

export class MemoryServer {
  private server: any;
  private toolHandlers: ToolHandlers;
  private errorHandler: (error: unknown) => any;

  constructor(config: ServerConfig) {
    // Initialize server
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize database and query layer
    const dbConnection = createDatabaseConnection(config.dbPath);
    const queries = new DatabaseQueries(dbConnection);
    this.toolHandlers = new ToolHandlers(queries);
    this.errorHandler = createErrorHandler();

    this.setupRequestHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupRequestHandlers(): void {
    // Tool listing handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOL_SCHEMAS
      };
    });

    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      try {
        const { name, arguments: args } = request.params;
        return await this.toolHandlers.handleToolRequest(name, args);
      } catch (error) {
        return this.errorHandler(error);
      }
    });
  }

  /**
   * Start the server with stdio transport
   */
  async start(): Promise<void> {
    const transport = createStdioTransport();
    await this.server.connect(transport.getTransport());
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer() {
    return this.server;
  }
}

/**
 * Create and configure a memory server instance
 */
export function createMemoryServer(config: ServerConfig): MemoryServer {
  return new MemoryServer(config);
}