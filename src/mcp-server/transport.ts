/**
 * Transport layer abstraction for MCP server
 */

const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

export interface Transport {
  connect(): Promise<void>;
}

export class StdioTransport implements Transport {
  private transport: any;

  constructor() {
    this.transport = new StdioServerTransport();
  }

  async connect(): Promise<void> {
    // Transport connection is handled by the MCP server
    return Promise.resolve();
  }

  getTransport() {
    return this.transport;
  }
}

/**
 * Create a stdio transport instance
 */
export function createStdioTransport(): StdioTransport {
  return new StdioTransport();
}