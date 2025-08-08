# Simple Memory MCP

A unified memory system for AI coding tools. Provides conversation history access and real-time synchronization through MCP protocol integration.

## Quick Start

```bash
# Install everything
curl -sSL https://install.simple-memory.com | bash

# Check status
simple-memory status

# View recent conversations
simple-memory query recent --limit 10
```

## Supported Tools

- **Claude Code**: Full conversation history and tool usage tracking
- **Cline** (Coming soon): VSCode extension conversation logs
- **Claude Desktop** (Coming soon): Desktop app conversation sync

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Tool Logs │───▶│   Sync Daemon   │───▶│   SQLite DB     │
│   (JSONL/JSON)  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │   MCP Server    │
                                               │                 │
                                               └─────────────────┘
```

## Components

### MCP Server (`src/mcp-server/`)
- Conversation history queries
- Cross-session search
- Tool usage analytics
- Real-time database access

### Sync Daemon (`src/sync-daemon/`)  
- Multi-format log file monitoring
- Real-time database updates
- Parser plugins for different AI tools
- Health monitoring and recovery

### Management CLI (`src/cli/`)
- Service start/stop/status
- Configuration management
- Health diagnostics
- Query interface

## Development

```bash
# Setup development environment
git clone https://github.com/user/simple-memory-mcp
cd simple-memory-mcp
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT