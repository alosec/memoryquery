# MemoryQuery - Test Suite

## Clean Test Architecture
**Approach**: Timestamp-based validation using real conversation data
**Focus**: 6 essential tests that properly validate sync functionality

## Quick Start

```bash
# Ensure you have real Claude Code conversations
# Check ~/.claude/projects/ for .jsonl files

# Start sync daemon (optional - some tests work without it)
npm run dev:sync

# In another terminal, run validation tests
npm test
```

## Test Commands

```bash
# Run all validation tests
npm test

# Individual test commands
npm run test:status      # Quick system health check
npm run test:sync        # Test conversation file synchronization
npm run test:latency     # Measure sync lag via timestamps
npm run test:integrity   # Validate data accuracy
npm run test:mcp         # Test MCP tool queries

# Quick status check
npm run test:quick
```

## Core Test Suite (6 Tests)

### Essential Tests
1. **`check-status.js`** - System health check without triggering massive logs
2. **`latency-timestamp.js`** - Measures sync lag using JSONL vs database timestamp comparison
3. **`real-sync-pipeline.js`** - Validates conversation file synchronization pipeline  
4. **`real-data-integrity.js`** - Compares source JSONL with database content
5. **`mcp-query.js`** - Tests all 8 MCP tools return correct data
6. **`deduplication.js`** - Ensures no duplicate messages in database

### Reliability Tests  
- **`malformed-jsonl.js`** - Tests error handling for corrupted files

## Test Validation Goals

1. **Timestamp Latency**:
   - Compares latest JSONL timestamps with database timestamps
   - Measures sync lag (healthy: <3s, acceptable: 3-10s) 
   - No file modification required - pure timestamp comparison

2. **Sync Pipeline**:
   - Validates conversation files are being processed
   - Tests real file detection and synchronization
   - Confirms sync daemon functionality

3. **Data Integrity**:
   - Compares source JSONL content with database
   - Checks for missing or corrupted messages
   - Validates accurate data synchronization

4. **MCP Functionality**:
   - Tests all 8 conversation history tools
   - Validates tools return correct data from database
   - Confirms MCP server operational status

5. **System Health**:
   - Quick health check without triggering massive logs
   - Database connectivity and statistics
   - Process status validation

## Success Criteria

- ✅ Sync lag between JSONL and database <10 seconds
- ✅ All conversation files detected and accessible
- ✅ >95% of messages successfully synced without corruption
- ✅ All MCP tools return accurate conversation data  
- ✅ Status check completes quickly (<5 seconds)

## Prerequisites

1. **Claude Code Usage**: Must have existing conversation files
   - Location: `~/.claude/projects/*/conversation-*.jsonl`
   - At least one conversation file required

2. **Sync Daemon Running**: Start with `npm run dev:sync`
   - Must be running for tests to pass
   - Check status with `npm run test:status`

3. **Database Path**: Configured correctly
   - Default: `~/.local/share/memoryquery/mcp.db`
   - Override with: `MEMQ_DB_PATH=/path/to/db`

## Troubleshooting

### No conversation files found
- Use Claude Code to create some conversations first
- Check `~/.claude/projects/` directory exists

### All tests timeout
- Ensure sync daemon is running: `npm run dev:sync`
- Check database path configuration
- Review sync daemon logs for errors

### Status command shows "NOT RUNNING"
- Start sync daemon: `npm run dev:sync`
- Wait a few seconds for initialization
- Run status check again

## Exit Codes

- `0` - All tests passed
- `1` - Some non-critical tests failed
- `2` - Critical tests failed (sync not working)
- `3` - Test runner error

## Architecture Improvements

**Previous Issues Resolved**:
- ❌ Polling-based tests with 10+ second timeouts
- ❌ File modification tests that polluted real conversation files  
- ❌ Synthetic test data disconnected from real usage
- ❌ Tests dependent on full sync pipeline timing

**Current Clean Approach**:
- ✅ Timestamp comparison for deterministic latency measurement
- ✅ Read-only validation of real conversation data
- ✅ Tests work independently without complex dependencies
- ✅ Fast, reliable tests that complete in seconds
