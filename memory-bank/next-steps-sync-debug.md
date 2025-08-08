# Next Steps: Real-Time Sync Debug & Refactoring

## Current State Summary (August 8, 2025)

### ✅ Infrastructure Completely Fixed
**Process Management**: PID files, daemon mode, clean start/stop/restart operations
**CLI Architecture**: Fast status commands, isolated from sync imports, no zombie processes
**Service Coordination**: Background mode working, proper signal handling, logging infrastructure

### ❌ Core Sync Engine Broken
**Real-Time Sync**: ALL latency tests timeout (>10s), proving sync is non-functional
**File Monitoring**: Watcher starts but goes idle, not detecting JSONL file changes
**Processing Pipeline**: Initial sync works (historical files) but real-time monitoring fails

## Evidence Analysis

### Working Components
- **Daemon Startup**: ✅ Process spawns correctly with PID 78049
- **Initial Sync**: ✅ Processes 485 conversation files during startup (4.6s duration)
- **Database Access**: ✅ SQLite operations working (66,631 messages in database)
- **File Detection**: ✅ Finds conversation files correctly during initial scan
- **Logging System**: ✅ Transaction logs, error logs, PID files all functional

### Failing Components  
- **Real-Time Monitoring**: ❌ Watcher goes idle after "watcher_ready" event
- **File Change Detection**: ❌ Not detecting new/modified JSONL files
- **Sync Processing**: ❌ No file processing events after initial startup
- **Latency Performance**: ❌ All test iterations timeout (>10s vs <500ms target)

### Transaction Log Evidence
```
2025-08-08 07:16:31.196 [INFO] starting_real_time_sync
2025-08-08 07:16:31.196 [INFO] real_time_watching_start  
2025-08-08 07:16:31.200 [INFO] watcher_ready
[NO SUBSEQUENT ACTIVITY - WATCHER IDLE FOR 4+ MINUTES]
```

## Investigation Required: Sync Engine Components

### 1. File Watcher Analysis (`src/sync-daemon/watch/jsonl.ts`)
**Examine**: Chokidar configuration, file pattern matching, event handling
**Questions**:
- Is the watcher properly configured for `~/.claude/projects/**/*.jsonl` pattern?
- Are file change events being emitted but not handled?
- Is the debouncing logic preventing event processing?
- Are there permission issues with file system monitoring?

### 2. Processing Pipeline (`src/sync-daemon/claude-code/index.ts`)
**Examine**: File processing workflow, error handling, event coordination
**Questions**:
- Is `runClaudeCodeSync()` only running during initial sync?
- Is the real-time processing separate from initial sync?
- Are file change events properly triggering processing functions?
- Is there an event loop or callback issue preventing ongoing monitoring?

### 3. Event Coordination (`src/sync-daemon/index.ts`)
**Examine**: Main daemon orchestration, watcher integration, keep-alive logic
**Questions**:
- Is the daemon process staying alive after initial sync completion?
- Is the watcher integration properly set up for ongoing file monitoring?
- Are there race conditions between initial sync and real-time monitoring?
- Is the process exit logic interfering with ongoing monitoring?

### 4. Database Operations (`src/sync-daemon/execute/database.ts`)
**Examine**: Transaction handling, concurrency control, connection management
**Questions**:
- Are database locks preventing real-time updates?
- Is the database connection staying open for ongoing operations?
- Are there transaction conflicts between initial sync and real-time updates?
- Is the mutex coordination working properly for concurrent access?

## Root Cause Hypothesis

**Primary Theory**: The daemon successfully completes initial sync, but the **real-time file monitoring loop is not properly established or maintained**. The watcher reports "ready" but then doesn't process subsequent file change events.

**Likely Issues**:
1. **Event Loop Termination**: Main process may be exiting after initial sync despite watcher setup
2. **File Pattern Mismatch**: Watcher may not be monitoring the correct file patterns or directories  
3. **Event Handler Missing**: File change events may be emitted but not connected to processing pipeline
4. **Async Coordination**: Race condition between initial sync completion and real-time watcher activation

## Required Analysis Steps

### Phase 1: Watcher Diagnosis (30 minutes)
1. **Examine watcher configuration** in `src/sync-daemon/watch/jsonl.ts`
2. **Add debug logging** to file change event handlers
3. **Test watcher directly** - create/modify JSONL file and check for events
4. **Verify file patterns** - ensure watcher monitors correct directories

### Phase 2: Process Flow Analysis (30 minutes) 
1. **Trace main daemon execution** in `src/sync-daemon/index.ts`
2. **Identify process keep-alive mechanism** - how daemon stays running
3. **Map event coordination** between initial sync and real-time monitoring
4. **Check for early exit conditions** that might terminate monitoring

### Phase 3: Integration Testing (30 minutes)
1. **Create isolated watcher test** - minimal file monitoring without full daemon
2. **Test processing pipeline separately** - can it handle individual file updates?
3. **Validate database operations** - are real-time updates working at DB level?
4. **End-to-end integration** - connect working components properly

## Success Criteria

### Immediate Targets
- **File Change Detection**: Watcher detects new/modified JSONL files within 1 second
- **Processing Latency**: P50 < 500ms, P95 < 2000ms for JSONL → SQLite sync
- **Continuous Operation**: Daemon processes files continuously without going idle
- **Transaction Logging**: Real-time processing events visible in transaction logs

### Validation Tests
- **Latency Test**: `node test/real-latency.js` shows consistent sub-second sync times
- **Activity Detection**: Status command shows active sync rather than idle state  
- **Transaction Log**: Ongoing file processing events (not just startup events)
- **Database Growth**: Message count increases as new conversation files are created

## Expected Outcome

After this debug phase, the sync daemon should provide **true real-time synchronization** where:
- New Claude Code conversation messages appear in SQLite database within 500ms
- File changes trigger immediate processing without manual intervention
- MCP tools provide access to current conversation data without lag
- System operates reliably in production with continuous monitoring

The infrastructure foundation is solid - we just need to fix the core sync engine to maintain ongoing file monitoring and processing.