# Technical Context

## Technology Stack

### Runtime Environment
- **Node.js**: v20.19+ for consistent ES modules support
- **TypeScript**: Full typing with ES2022 target
- **SQLite**: Direct database access without ORM overhead
- **Docker**: Optional containerization for deployment flexibility

### ✅ Implemented Dependencies
**✅ MCP Server (COMPLETE):**
- `@modelcontextprotocol/sdk`: ^1.17.0 - MCP protocol implementation
- `sqlite3`: ^5.1.7 - Database connectivity with promisified interface
- `@types/node`: ^20.19.9 - TypeScript definitions

**CLI Interface:**
- `commander`: ^12.0.0 - Command-line interface framework

**✅ Sync Daemon (COMPLETE):**
- `better-sqlite3`: ^12.2.0 - High-performance SQLite bindings for database operations
- `chokidar`: ^4.0.3 - Cross-platform file system watching with stability handling
- `uuid`: ^11.1.0 - Session ID generation and message deduplication

**✅ Development Tools:**
- `tsx`: ^4.0.0 - TypeScript execution for development
- `typescript`: ^5.7.2 - Compilation and type checking
- `concurrently`: ^9.0.1 - Parallel script execution

### Package Management
- **Single package.json**: Unified dependency management
- **Workspaces**: Logical separation without complexity
- **Lock files**: Deterministic dependency resolution
- **Minimal footprint**: Only essential dependencies

## Database Architecture

### SQLite Schema ✅ IMPLEMENTED
**Simple Memory Database Structure** (`~/.local/share/simple-memory/mcp.db`):
```sql
sessions (id, path, created_at, last_activity_at)
messages (id, session_id, type, timestamp, user_text, assistant_text, project_name)
tool_uses (id, message_id, tool_name, parameters)
tool_use_results (id, tool_use_id, output, error)
attachments (id, message_id, filename, content)
env_info (id, message_id, working_dir, git_branch, platform)
```

**✅ Access Patterns Implemented:**
- **✅ Read-only MCP**: MCP server queries conversation history safely
- **✅ Write-only Sync**: Sync daemon updates database from JSONL files with atomic transactions
- **✅ WAL Mode**: Concurrent read/write operations enabled
- **✅ Indexes**: Performance indexes on session_id, timestamp, message_id, tool_use_id

### Connection Management
- **Single connection per service**: Simple and reliable
- **Connection pooling**: Only if performance requires it
- **Graceful reconnection**: Handle database unavailability
- **Transaction boundaries**: Atomic updates for data consistency

## File System Integration

### JSONL Processing
**Claude Code File Format:**
```
~/.claude/projects/[project-name]/conversation-[timestamp].jsonl
```

**Processing Pipeline:**
1. **File Detection**: Watch for new/modified JSONL files
2. **Parsing**: Extract messages, tool uses, and metadata
3. **Transformation**: Convert to Claude Code database schema
4. **Database Updates**: Insert/update records atomically

### File Watching Strategy
- **Cross-platform**: Use chokidar for consistent behavior
- **Efficient polling**: Balance responsiveness with resource usage
- **Event debouncing**: Handle rapid file changes gracefully
- **Recovery**: Detect and process missed events

## Service Architecture

### Process Management
**Deployment Options:**
- **Native processes**: Direct Node.js execution
- **Docker containers**: Containerized deployment
- **System services**: systemd/launchd integration
- **Development mode**: Local development with hot reload

### Inter-Service Communication
- **Shared database**: Primary coordination mechanism
- **Health endpoints**: HTTP endpoints for status checking
- **Log aggregation**: Centralized logging for debugging
- **Configuration**: Environment variables and config files

## Development Environment

### ✅ Build System (IMPLEMENTED)
```bash
# ✅ Development
npm run dev          # Start all services in watch mode (concurrent)
npm run build        # Compile TypeScript to CommonJS in dist/
npm test             # Run test suite

# ✅ Production
npx tsc              # Direct TypeScript compilation
node dist/cli/index.js --help  # CLI interface working

# Pending Installation
npm run install      # Run full installation process
npm run register     # Register MCP server with Claude Code
```

**✅ TypeScript Configuration**:
- Target: ES2022 with CommonJS modules
- Output: dist/ with sourcemaps and declarations  
- Strict type checking enabled

### Testing Strategy
- **Unit tests**: Individual component functionality
- **Integration tests**: Service interaction verification
- **Installation tests**: Full setup process validation
- **Database tests**: Schema and query validation

### ✅ Configuration Management (IMPLEMENTED)
**✅ Environment Variables:**
- `SIMPLE_MEMORY_DB_PATH`: Path to simple-memory database (defaults to ~/.local/share/simple-memory/mcp.db)
- `CLAUDE_PROJECTS_PATH`: Path to JSONL files (implemented - defaults to ~/.claude/projects)
- `LOG_LEVEL`: Logging verbosity [PENDING]
- `SERVICE_PORT`: HTTP endpoint port [PENDING]

**✅ Configuration Pattern**:
```typescript
// Auto-detection with environment override (updated for separate database)
const DEFAULT_DB_PATH = path.join(os.homedir(), '.local/share/simple-memory/mcp.db');
const dbPath = process.env.SIMPLE_MEMORY_DB_PATH || DEFAULT_DB_PATH;
```

**Config Files [PENDING]:**
- `config/default.json`: Default configuration  
- `config/production.json`: Production overrides
- `config/development.json`: Development settings

## Deployment Considerations

### Installation Requirements
- **Node.js 20+**: Required runtime
- **SQLite support**: Database functionality
- **File system access**: JSONL monitoring
- **Network access**: MCP registration

### Cross-Platform Support
- **Linux**: Primary development target
- **macOS**: Full feature parity
- **Windows**: Best-effort support
- **Docker**: Consistent behavior across platforms

### Performance Characteristics
**Expected Metrics:**
- **Sync latency**: < 5 seconds for JSONL updates
- **Query response**: < 100ms for typical MCP requests
- **Memory usage**: < 50MB per service
- **CPU usage**: < 5% during normal operation

### Security Considerations
- **Read-only database access** for MCP server
- **Minimal file system permissions** for sync daemon
- **No network exposure** except for health endpoints
- **Input validation** for all external data