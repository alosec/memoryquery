# Simple Memory MCP - Test Suite

## Quick Start

```bash
# Make sure sync daemon is running
npm run dev:sync

# In another terminal, run all tests
npm test
```

## Test Commands

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:sync       # Test sync pipeline
npm run test:mcp        # Test MCP tool queries
npm run test:latency    # Measure sync latency
npm run test:integrity  # Test deduplication and atomicity
npm run test:errors     # Test error handling

# Quick pass/fail check
npm run test:quick

# Clean up test files
npm run test:clean
```

## Test Files

- `sync-pipeline.js` - Verifies JSONL files sync to database
- `mcp-query.js` - Tests MCP tool responses
- `measure-latency.js` - Benchmarks sync performance (P50/P95)
- `deduplication.js` - Ensures no duplicate messages
- `atomicity.js` - Verifies transaction safety
- `malformed-jsonl.js` - Tests handling of bad input
- `large-file.js` - Tests bulk data processing (1000 messages)

## Success Criteria

- ✅ JSONL changes appear in database
- ✅ MCP tools return correct data
- ✅ Sync latency P50 < 500ms
- ✅ Sync latency P95 < 2000ms
- ✅ No data corruption or duplicates
- ✅ Graceful error handling

## For LLMs

```bash
# Parse test results
npm test 2>&1 | grep -E "(✓|✗|P50|P95)"

# Quick health check
npm run test:quick

# Latency only
npm run test:latency | grep "P50\|P95"
```

## Requirements

- Node.js 20+
- Sync daemon running (`npm run dev:sync`)
- Database path set correctly (or use default)

## Exit Codes

- `0` - All tests passed
- `1` - Some non-critical tests failed
- `2` - Critical tests failed
- `3` - Test runner error
