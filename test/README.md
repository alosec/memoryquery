# Simple Memory MCP - Real Validation Tests

## Philosophy Change
**Old Approach**: Create synthetic test files → Validate processing
**New Approach**: Use real conversation files → Validate actual sync

## Quick Start

```bash
# Ensure you have real Claude Code conversations
# Check ~/.claude/projects/ for .jsonl files

# Start sync daemon (required)
npm run dev:sync

# In another terminal, run validation tests
npm test
```

## Test Commands

```bash
# Run all real validation tests
npm test

# Individual test commands
npm run test:status      # Quick health check (no logs!)
npm run test:sync        # Test real conversation sync
npm run test:latency     # Measure actual sync latency
npm run test:integrity   # Validate data accuracy
npm run test:mcp         # Test MCP tool queries

# Quick status check
npm run test:quick

# Run old synthetic tests (not recommended)
npm run test:old
```

## Real Validation Tests

### Core Tests (Critical)
- `check-status.js` - Simple health check without triggering massive logs
- `real-sync-pipeline.js` - Validates actual conversation file synchronization
- `real-latency.js` - Measures real JSONL → Database latency

### Data Validation Tests
- `real-data-integrity.js` - Compares source JSONL with database content
- `mcp-query.js` - Tests MCP tool functionality with real data

## What These Tests Actually Validate

1. **Real Sync Pipeline**: 
   - Finds actual Claude Code conversations
   - Verifies they're being watched and synced
   - Tests new message append detection

2. **Real Latency**:
   - Measures actual time from file change to database
   - Uses real conversation files of varying sizes
   - Reports P50/P95 metrics for real workloads

3. **Data Integrity**:
   - Compares source JSONL content with database
   - Checks for missing messages
   - Validates no data corruption

4. **Status Check**:
   - Reports health WITHOUT generating 80k lines of logs
   - Simple, parseable output
   - Quick validation of system state

## Success Criteria

- ✅ Real conversation files are synced to database
- ✅ Sync latency P50 < 500ms on real files
- ✅ Sync latency P95 < 2000ms on real files
- ✅ >95% of messages successfully synced
- ✅ No data corruption or loss
- ✅ Status check completes in <1 second

## Prerequisites

1. **Claude Code Usage**: Must have existing conversation files
   - Location: `~/.claude/projects/*/conversation-*.jsonl`
   - At least one conversation file required

2. **Sync Daemon Running**: Start with `npm run dev:sync`
   - Must be running for tests to pass
   - Check status with `npm run test:status`

3. **Database Path**: Configured correctly
   - Default: `~/.local/share/simple-memory/mcp.db`
   - Override with: `SIMPLE_MEMORY_DB_PATH=/path/to/db`

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

## Key Difference from Old Tests

**Old tests created artificial data**:
- Generated `test-1234.jsonl` files
- Validated synthetic processing
- Passing tests didn't mean real conversations worked

**New tests validate real functionality**:
- Use actual Claude Code conversations
- Measure real performance metrics
- Success means users can actually access their data
