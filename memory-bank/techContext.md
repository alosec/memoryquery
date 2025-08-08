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

**Sync Daemon (PENDING):**
- `better-sqlite3`: ^12.2.0 - High-performance SQLite bindings
- `chokidar`: ^4.0.3 - Cross-platform file system watching
- `uuid`: ^11.1.0 - Session ID generation

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

### SQLite Schema
**Existing Claude Code Structure:**
```sql
sessions (id, path, createdAt, lastActivityAt)
messages (id, sessionId, type, timestamp, userText, assistantText, projectName)
tool_uses (id, messageId, toolName, parameters)
tool_use_results (id, toolUseId, output, error)
attachments (id, messageId, filename, content)
env_info (id, messageId, workingDir, gitBranch)
```

**Access Patterns:**
- **Read-only MCP**: Query conversation history safely
- **Write-only Sync**: Update database from JSONL files
- **WAL Mode**: Concurrent read/write operations
- **Indexes**: Leverage existing Claude Code performance optimizations

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
- `CLAUDE_DB_PATH`: Path to Claude Code database (implemented with fallback)
- `CLAUDE_PROJECTS_PATH`: Path to JSONL files [PENDING - for sync daemon]
- `LOG_LEVEL`: Logging verbosity [PENDING]
- `SERVICE_PORT`: HTTP endpoint port [PENDING]

**✅ Configuration Pattern**:
```typescript
// Auto-detection with environment override
const DEFAULT_DB_PATH = path.join(os.homedir(), '.local/share/cafe-db/claude_code.db');
const dbPath = process.env.CLAUDE_DB_PATH || DEFAULT_DB_PATH;
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