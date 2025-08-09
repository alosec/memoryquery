# System Patterns

## ✅ REVOLUTIONARY ARCHITECTURE COMPLETE - Single Tool SQL Interface

**Major Architecture Achievement (August 9, 2025)**:
- **✅ Paradigm Shift**: Eliminated 8 complex tools in favor of single `query_memory` SQL interface
- **✅ Unlimited Flexibility**: Any conversation analysis pattern possible through direct SQL access
- **✅ Safety First**: SELECT-only enforcement with dangerous keyword blocking (CREATE, DELETE, etc.)
- **✅ Model Optimized**: Leverages AI's excellent SQL capabilities for natural conversation memory access
- **✅ Future Proof**: No need to anticipate specific query patterns - unlimited analytical possibilities

**Proven Capabilities**:
- **Deep Historical Analysis**: Reconstructed July 23rd development timeline from conversation data
- **Pattern Recognition**: Identified circadian coding patterns, productivity cycles, error clustering
- **Project Intelligence**: Comprehensive multi-project analysis with relationship mapping
- **Meta-Analysis**: Self-referential analysis where system studies its own creation story

## Package Architecture

### Clean Separation of Concerns ✅ IMPLEMENTED
**Pattern**: Modular architecture with clear boundaries between components
**Implementation**:
- **✅ MCP Server** (`src/mcp-server/`): Complete implementation with database, tools, server, utils modules
- **✅ Sync Daemon** (`src/sync-daemon/`): Complete Watch-Transform-Execute pipeline for JSONL processing
- **✅ Management CLI** (`src/cli/`): Functional service control with commander.js interface  
- **Installation System** (`scripts/`): Handles setup, configuration, and registration [PENDING]

**✅ Actual Structure Implemented**:
```
src/mcp-server/
├── database/          # Data layer - connections, queries, types, cursor utils
├── tools/             # MCP layer - schemas, handlers for all 8 tools
├── utils/             # Shared utilities - error handling
├── server.ts          # Main server orchestration
├── transport.ts       # MCP stdio transport
└── index.ts           # Entry point with configuration
```

**✅ Benefits Achieved**: 
- ✅ Components developed and tested independently - MCP server complete
- ✅ Clear interfaces prevent coupling - database/tools/server separation working
- ✅ Easy to reason about system behavior - modular imports and exports
- ✅ Well-organized code structure - TypeScript compilation successful

### Service Coordination Pattern
**Pattern**: Coordinated services that work together while maintaining independence
**Design Approach**:
- **Shared Database**: SQLite database accessed by both MCP server (read) and sync daemon (write)
- **Health Monitoring**: Built-in status checking across all components
- **Graceful Startup**: Services start in correct order with dependency checking
- **Service Discovery**: Components find each other through standard mechanisms

### Installation-First Design Pattern  
**Pattern**: Every architectural decision optimized for clean installation experience
**Implementation**:
- **Single Entry Point**: One install command handles all setup [PENDING]
- **✅ Auto-Configuration**: Environment-based database path detection implemented
- **Registration Integration**: Automatically registers MCP server with Claude Code [PENDING]
- **✅ Service Management**: CLI commands implemented (start/stop/status/logs)

**✅ Current CLI Interface**:
```bash
simple-memory start [--db-path <path>]  # Start MCP server + sync daemon
simple-memory status                    # Check service health
simple-memory stop                      # Stop all services  
simple-memory logs                      # View service logs
```

**Example User Flow**:
```bash
curl -sSL install-url | bash    # Install everything
simple-memory status            # Check system health
simple-memory restart           # Restart services
simple-memory logs              # View service logs
```

## Data Flow Patterns

### Real-Time Sync Pattern ✅ WORKING  
**Pattern**: Event-driven synchronization with reliability guarantees
**Architecture**:
```
JSONL Files → File Watcher → Parser → SQLite Database → ✅ MCP Tools
     ↓              ↓           ↓           ↓                ↓
  Changes      Detect      Transform    Update         ✅ Query
```

**✅ Pipeline Operational**: Watch-Transform-Execute working - MCP tools returning current conversation data
**✅ Database Sync Working**: JSONL parsing, content extraction, and database updates functional

**✅ Implemented Reliability Features**:
- **✅ Atomic Updates**: Database transactions with retry logic ensure consistency
- **✅ Error Handling**: Parse errors logged and gracefully handled
- **✅ Health Checks**: CLI status and logs provide sync monitoring
- **✅ Mutex Coordination**: Database locks prevent concurrent write conflicts

**⚠️ Two Strategic Issues Remain**:
1. **Project Path Parameter Design**: Current encoded naming not intuitive for users
2. **Tool Usage Parsing**: "Masquerading" problem affects tool usage history queries

### Project Path Parameter Pattern ✅ SOLVED
**Pattern**: Flexible project path mapping supporting multiple user input formats
**✅ Enhanced Implementation**: Intelligent format detection and conversion

**✅ Supported Input Formats**:
```
1. Simple name: "simple-memory-mcp"                    # Most intuitive
2. Full path:   "/home/alex/code/simple-memory-mcp"    # Natural for filesystem users  
3. Encoded:     "-home-alex-code-simple-memory-mcp"    # Backward compatibility
```

**✅ Architecture Solution**:
- **ProjectPathMapper utility class**: Handles all format conversions and detection
- **Smart normalization**: Automatic input format detection in tool handlers
- **Database query flexibility**: Enhanced WHERE clause generation based on input format
- **Type safety**: Proper TypeScript typing for mixed SQL parameter types

**Implementation Location**: `src/mcp-server/utils/path-mapper.ts`

### Claude Code Message "Masquerading" Pattern ⚠️ PARSING ISSUE
**Pattern**: Tool results disguised as user messages in Claude Code JSONL format
**Architecture Challenge**:
```
Assistant → tool_use message
System    → tool_result data BUT formatted as "user" message type
```

**Impact**: Standard user/assistant parsing fails to identify tool usage properly
**Evidence**: Tool usage history queries return empty despite tool data in database  

**Critical Reference Documentation**:
- **`/home/alex/code/cafe/cafe-db-sync/memory-bank/cc-jsonl.md`**: Key patterns for the "masquerading" problem
  - Documents how tool results appear as user messages with `toolUseResult` metadata
  - Shows the 3 message types: summary, user, assistant
  - Explains "User" masquerade pattern and threading behavior
- **`/home/alex/code/cafedelic/docs/claude_code_logs.md`**: Comprehensive Claude Code log format analysis
  - Complete JSONL structure documentation
  - Tool usage detection patterns
  - File operation parsing strategies

**Solution Required**: Enhanced parsing that recognizes tool result messages masquerading as user messages

### Database Access Pattern ✅ IMPLEMENTED
**Pattern**: Read-write separation with safe concurrent access
**✅ Implementation**:
- **✅ Sync Daemon**: Write-only access for JSONL updates with transaction safety
- **✅ MCP Server**: Read-only access for conversation queries with WAL mode
- **✅ SQLite WAL Mode**: Configured for concurrent read/write operations
- **✅ Mutex Coordination**: Database locks prevent write conflicts between services
- **✅ Separate Database**: `~/.local/share/simple-memory/mcp.db` avoids conflicts

## Error Handling and Reliability Patterns

### Graceful Degradation Pattern
**Pattern**: System continues operating when components fail
**Scenarios**:
- **Sync Failure**: MCP tools still work with existing data
- **MCP Server Issues**: Sync continues populating database
- **Database Lock**: Retry logic with exponential backoff
- **Configuration Problems**: Clear error messages with recovery suggestions

### Health Monitoring Pattern
**Pattern**: Comprehensive system health visibility
**Metrics**:
- **Sync Latency**: Time from JSONL update to database availability
- **MCP Response Time**: Query execution performance
- **Error Rates**: Failed operations and their causes
- **Service Status**: Up/down status of all components

**Implementation**:
```bash
simple-memory status --detailed
# ✅ Sync Daemon: Active (avg latency: 2.3s)
# ✅ MCP Server: Registered (avg query: 0.8ms)  
# ✅ Database: Healthy (size: 245MB)
# ⚠️  Recent Issues: 2 sync retries in last hour
```

## Development and Maintenance Patterns

### Clean Git History Pattern
**Pattern**: Clean commit history from project inception
**Standards**:
- **Conventional Commits**: Consistent commit message format
- **Semantic Versioning**: Clear version progression
- **Release Notes**: Comprehensive change documentation
- **Clean Branches**: Feature development with merge discipline

### ✅ Testing Strategy Pattern (REDESIGNED - August 9, 2025)
**Pattern**: Timestamp-based validation with real conversation data
**Architecture**:
- **✅ Timestamp Comparison**: Measure sync lag via JSONL vs database timestamps
- **✅ Read-Only Validation**: Tests don't modify real conversation files
- **✅ Deterministic Results**: No polling timeouts or file system dependencies
- **✅ Real Data Focus**: Tests validate actual Claude Code conversation sync

**✅ Implemented Clean Test Suite**:
1. **System Health**: `check-status.js` - Database connectivity and file detection
2. **Sync Latency**: `latency-timestamp.js` - Timestamp gap measurement (NEW approach)
3. **Pipeline Validation**: `real-sync-pipeline.js` - Conversation file synchronization
4. **Data Integrity**: `real-data-integrity.js` - Source vs database comparison
5. **MCP Functionality**: `mcp-query.js` - All 8 tools operational testing
6. **Error Handling**: `deduplication.js`, `malformed-jsonl.js` - Reliability tests

**Partial Results**: Tests identified path resolution bug, partial fix implemented, but core issue remains - watcher still goes idle, causing 169+ second lag.

### Documentation Pattern
**Pattern**: Clear documentation that enables adoption
**Structure**:
- **Quick Start**: 5-minute setup guide
- **Architecture Guide**: System design explanation
- **API Reference**: Complete MCP tool documentation
- **Troubleshooting**: Common issues and solutions
- **Contributing**: Development setup and guidelines

## Security and Safety Patterns

### Safe Database Access Pattern
**Pattern**: Protect user data while providing functionality
**Implementation**:
- **Read-Only MCP**: MCP server cannot modify conversation history
- **Input Validation**: All queries validated and sanitized
- **Path Restrictions**: File system access limited to designated areas
- **Error Information**: Security-conscious error messages

### Service Isolation Pattern
**Pattern**: Components isolated to limit failure impact
**Benefits**:
- **Process Separation**: Services run in separate processes
- **Resource Limits**: CPU and memory bounds prevent resource exhaustion
- **Permission Minimization**: Each component has minimal required permissions
- **Network Isolation**: No unnecessary network exposure