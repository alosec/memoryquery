# Testing Index

## Current Testing Approach
The project uses a **streamlined, script-based testing strategy** focused on core functionality verification.

## Testing Documents

### 1. **[streamlined-testing-plan.md](./streamlined-testing-plan.md)** ⭐ ACTIVE
The current testing implementation plan featuring:
- Non-interactive test scripts
- Simple CLI commands  
- LLM-friendly output format
- Focus on sync latency and MCP tool efficacy

### 2. **[testing-development-plan.md](./testing-development-plan.md)** (Reference)
Original comprehensive testing strategy (superseded by streamlined approach)

### 3. **[technical-debt-testing.md](./technical-debt-testing.md)** (Reference)
Specific tests for addressing technical debt issues

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run all tests
npm test

# Run specific test categories
npm run test:sync       # Test sync daemon
npm run test:mcp        # Test MCP tools
npm run test:latency    # Measure performance
```

## Test Categories

### Core Functionality (Priority 1)
- `sync-pipeline.js` - Verify JSONL → DB sync
- `mcp-query.js` - Test MCP tool responses
- `measure-latency.js` - Benchmark sync performance

### Data Integrity (Priority 2)
- `deduplication.js` - Prevent duplicate messages
- `atomicity.js` - Ensure transaction safety

### Error Handling (Priority 3)
- `malformed-jsonl.js` - Handle bad input
- `large-file.js` - Process bulk data

## Success Criteria

✅ Tests pass when:
- JSONL changes sync to database
- MCP tools return accurate data
- Sync latency P50 < 500ms
- Sync latency P95 < 2000ms
- No data corruption or loss

## For LLMs

Execute tests and parse results:
```bash
npm test 2>&1 | grep -E "(✓|✗|P50|P95)"
```

Quick health check:
```bash
npm run test:sync && npm run test:mcp && echo "PASS" || echo "FAIL"
```
