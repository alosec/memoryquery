# Streamlined Testing Plan - Simple Memory MCP

## Core Focus
Non-interactive, scriptable tests for sync daemon and MCP tools efficacy. All tests are CLI-executable and LLM-friendly for automated verification.

## Primary Testing Objective
Verify that JSONL changes successfully sync to database and are queryable via MCP tools with acceptable latency.

## Test Structure

### Simple CLI Test Runner
```bash
# Run all tests
npm test

# Run specific test categories
npm run test:sync       # Test sync daemon functionality
npm run test:mcp        # Test MCP tool queries
npm run test:latency    # Measure sync latency
npm run test:integrity  # Verify data integrity
```

## Phase 1: Core Functionality Tests (Priority 1)

### 1.1 Sync Pipeline Test Script
**File**: `test/sync-pipeline.js`

```javascript
#!/usr/bin/env node
// Non-interactive test that creates JSONL, waits, and verifies DB

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function testSyncPipeline() {
  console.log('TEST: Sync Pipeline');
  
  // 1. Create test JSONL file
  const testFile = path.join(process.env.HOME, '.claude/projects/test/conversation.jsonl');
  const testMessage = {
    id: 'test-' + Date.now(),
    type: 'message',
    timestamp: new Date().toISOString(),
    user_text: 'Test message',
    assistant_text: 'Test response'
  };
  
  fs.writeFileSync(testFile, JSON.stringify(testMessage) + '\n');
  console.log('✓ Created test JSONL');
  
  // 2. Wait for sync (max 5 seconds)
  await sleep(2000);
  
  // 3. Check database
  const db = new Database(process.env.SIMPLE_MEMORY_DB_PATH);
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(testMessage.id);
  
  if (row) {
    console.log('✓ Message synced to database');
    return 0;
  } else {
    console.log('✗ Message not found in database after 2s');
    return 1;
  }
}

testSyncPipeline().then(process.exit);
```

### 1.2 MCP Tool Query Test
**File**: `test/mcp-query.js`

```javascript
#!/usr/bin/env node
// Test MCP tools return correct data

const { spawn } = require('child_process');

async function testMCPQuery() {
  console.log('TEST: MCP Tool Queries');
  
  // Send MCP request via stdio
  const mcp = spawn('node', ['dist/mcp-server/index.js']);
  
  // Test get_recent_conversations
  const request = {
    method: 'tools/call',
    params: {
      name: 'get_recent_conversations',
      arguments: { limit: 5 }
    }
  };
  
  mcp.stdin.write(JSON.stringify(request) + '\n');
  
  // Read response
  const response = await readResponse(mcp.stdout);
  
  if (response.result && Array.isArray(response.result)) {
    console.log(`✓ Retrieved ${response.result.length} conversations`);
    return 0;
  } else {
    console.log('✗ Failed to retrieve conversations');
    return 1;
  }
}

testMCPQuery().then(process.exit);
```

### 1.3 Latency Measurement Script
**File**: `test/measure-latency.js`

```javascript
#!/usr/bin/env node
// Measure sync latency non-interactively

const fs = require('fs');
const Database = require('better-sqlite3');

async function measureLatency() {
  console.log('TEST: Sync Latency Measurement');
  
  const iterations = 10;
  const latencies = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();
    const messageId = `latency-test-${startTime}`;
    
    // Write JSONL
    const testFile = getTestFile();
    fs.appendFileSync(testFile, JSON.stringify({
      id: messageId,
      type: 'message',
      timestamp: new Date().toISOString()
    }) + '\n');
    
    // Poll database until message appears (max 10s)
    const db = new Database(process.env.SIMPLE_MEMORY_DB_PATH);
    let found = false;
    
    while (Date.now() - startTime < 10000) {
      const row = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
      if (row) {
        found = true;
        break;
      }
      await sleep(100);
    }
    
    if (found) {
      const latency = Date.now() - startTime;
      latencies.push(latency);
      console.log(`  Iteration ${i + 1}: ${latency}ms`);
    } else {
      console.log(`  Iteration ${i + 1}: TIMEOUT`);
    }
  }
  
  // Calculate stats
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  
  console.log('\nResults:');
  console.log(`  P50: ${p50}ms ${p50 < 500 ? '✓' : '✗'} (target: <500ms)`);
  console.log(`  P95: ${p95}ms ${p95 < 2000 ? '✓' : '✗'} (target: <2000ms)`);
  
  return (p50 < 500 && p95 < 2000) ? 0 : 1;
}

measureLatency().then(process.exit);
```

## Phase 2: Data Integrity Tests (Priority 2)

### 2.1 Deduplication Test
**File**: `test/deduplication.js`

```javascript
#!/usr/bin/env node
// Verify no duplicate messages are created

async function testDeduplication() {
  console.log('TEST: Message Deduplication');
  
  // Write same message twice
  const message = {
    id: 'dedup-test-' + Date.now(),
    type: 'message',
    timestamp: new Date().toISOString()
  };
  
  const testFile = getTestFile();
  fs.writeFileSync(testFile, JSON.stringify(message) + '\n');
  await sleep(1000);
  fs.appendFileSync(testFile, JSON.stringify(message) + '\n');
  await sleep(1000);
  
  // Check database has only one entry
  const db = new Database(process.env.SIMPLE_MEMORY_DB_PATH);
  const count = db.prepare('SELECT COUNT(*) as count FROM messages WHERE id = ?')
    .get(message.id).count;
  
  if (count === 1) {
    console.log('✓ Deduplication working');
    return 0;
  } else {
    console.log(`✗ Found ${count} copies (expected 1)`);
    return 1;
  }
}
```

### 2.2 Transaction Atomicity Test
**File**: `test/atomicity.js`

```javascript
#!/usr/bin/env node
// Verify transactions are atomic

async function testAtomicity() {
  console.log('TEST: Transaction Atomicity');
  
  // Create message with tool use (should be atomic)
  const message = {
    id: 'atomic-' + Date.now(),
    type: 'message',
    tool_uses: [{
      id: 'tool-1',
      tool_name: 'read_file',
      parameters: { path: '/test.txt' }
    }]
  };
  
  // Write and sync
  fs.writeFileSync(getTestFile(), JSON.stringify(message) + '\n');
  await sleep(2000);
  
  // Check both message and tool_use exist or neither
  const db = new Database(process.env.SIMPLE_MEMORY_DB_PATH);
  const messageExists = db.prepare('SELECT id FROM messages WHERE id = ?').get(message.id);
  const toolExists = db.prepare('SELECT id FROM tool_uses WHERE id = ?').get('tool-1');
  
  if ((messageExists && toolExists) || (!messageExists && !toolExists)) {
    console.log('✓ Transaction atomicity maintained');
    return 0;
  } else {
    console.log('✗ Partial transaction detected');
    return 1;
  }
}
```

## Phase 3: Error Handling Tests (Priority 3)

### 3.1 Malformed JSONL Test
**File**: `test/malformed-jsonl.js`

```javascript
#!/usr/bin/env node
// Verify sync handles malformed JSONL gracefully

async function testMalformedJSON() {
  console.log('TEST: Malformed JSONL Handling');
  
  // Write mix of valid and invalid JSON
  const testFile = getTestFile();
  const content = [
    '{"broken',
    JSON.stringify({ id: 'valid-1', type: 'message' }),
    'not even json',
    JSON.stringify({ id: 'valid-2', type: 'message' }),
    '{"incomplete": '
  ].join('\n');
  
  fs.writeFileSync(testFile, content);
  await sleep(2000);
  
  // Check that valid messages were processed
  const db = new Database(process.env.SIMPLE_MEMORY_DB_PATH);
  const valid1 = db.prepare('SELECT id FROM messages WHERE id = ?').get('valid-1');
  const valid2 = db.prepare('SELECT id FROM messages WHERE id = ?').get('valid-2');
  
  if (valid1 && valid2) {
    console.log('✓ Processed valid messages despite malformed lines');
    return 0;
  } else {
    console.log('✗ Failed to process valid messages');
    return 1;
  }
}
```

### 3.2 Large File Test
**File**: `test/large-file.js`

```javascript
#!/usr/bin/env node
// Test handling of large JSONL files

async function testLargeFile() {
  console.log('TEST: Large File Processing');
  
  // Generate 1000 messages
  const messages = [];
  for (let i = 0; i < 1000; i++) {
    messages.push(JSON.stringify({
      id: `large-test-${i}`,
      type: 'message',
      timestamp: new Date().toISOString()
    }));
  }
  
  const startTime = Date.now();
  fs.writeFileSync(getTestFile(), messages.join('\n'));
  
  // Wait for sync with timeout
  await sleep(5000);
  
  // Check how many synced
  const db = new Database(process.env.SIMPLE_MEMORY_DB_PATH);
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE id LIKE ?'
  ).get('large-test-%').count;
  
  const elapsed = Date.now() - startTime;
  console.log(`  Synced ${count}/1000 messages in ${elapsed}ms`);
  
  if (count === 1000) {
    console.log('✓ All messages synced');
    return 0;
  } else {
    console.log('✗ Not all messages synced');
    return 1;
  }
}
```

## Test Utilities

### Shared Test Helpers
**File**: `test/utils.js`

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

function getTestFile() {
  const dir = path.join(os.homedir(), '.claude/projects/test');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `test-${Date.now()}.jsonl`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanupTestFiles() {
  const dir = path.join(os.homedir(), '.claude/projects/test');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

module.exports = { getTestFile, sleep, cleanupTestFiles };
```

## Master Test Script

### Run All Tests
**File**: `test/run-all.js`

```javascript
#!/usr/bin/env node
// Run all tests and report results

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const tests = [
  'sync-pipeline.js',
  'mcp-query.js',
  'measure-latency.js',
  'deduplication.js',
  'atomicity.js',
  'malformed-jsonl.js',
  'large-file.js'
];

async function runTest(testFile) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, testFile)], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('exit', (code) => {
      resolve(code === 0);
    });
  });
}

async function main() {
  console.log('='.repeat(50));
  console.log('Simple Memory MCP - Test Suite');
  console.log('='.repeat(50));
  
  const results = [];
  
  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ test, passed });
    console.log('');
  }
  
  // Summary
  console.log('='.repeat(50));
  console.log('Test Summary:');
  console.log('='.repeat(50));
  
  let allPassed = true;
  for (const { test, passed } of results) {
    console.log(`  ${passed ? '✓' : '✗'} ${test}`);
    if (!passed) allPassed = false;
  }
  
  console.log('');
  if (allPassed) {
    console.log('✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}

main();
```

## Package.json Scripts

```json
{
  "scripts": {
    "test": "node test/run-all.js",
    "test:sync": "node test/sync-pipeline.js",
    "test:mcp": "node test/mcp-query.js",
    "test:latency": "node test/measure-latency.js",
    "test:integrity": "node test/deduplication.js && node test/atomicity.js",
    "test:errors": "node test/malformed-jsonl.js && node test/large-file.js",
    "test:clean": "node -e \"require('./test/utils').cleanupTestFiles()\""
  }
}
```

## LLM-Friendly Test Execution

### Single Command Verification
```bash
# For LLMs to verify the system works
npm test 2>&1 | grep -E "(✓|✗|PASS|FAIL|P50|P95)"
```

### Quick Health Check
```bash
# Simple pass/fail for system health
npm run test:sync && npm run test:mcp && echo "HEALTHY" || echo "UNHEALTHY"
```

### Latency Check Only
```bash
# Just check if sync is fast enough
npm run test:latency | grep "P50\|P95"
```

## Expected Output Format

All tests output simple, parseable results:
```
TEST: Sync Pipeline
✓ Created test JSONL
✓ Message synced to database

TEST: Sync Latency Measurement
  Iteration 1: 245ms
  Iteration 2: 189ms
  ...
Results:
  P50: 234ms ✓ (target: <500ms)
  P95: 456ms ✓ (target: <2000ms)
```

## Success Criteria

### Core Functionality
- [ ] JSONL → Database sync works
- [ ] MCP tools return data
- [ ] Sync latency P50 < 500ms
- [ ] Sync latency P95 < 2000ms

### Data Integrity
- [ ] No duplicate messages
- [ ] Transactions are atomic
- [ ] Tool uses linked correctly

### Error Handling
- [ ] Malformed JSONL doesn't crash
- [ ] Large files process successfully
- [ ] Sync recovers from errors

## Notes for Implementation

1. **All tests are non-interactive** - No user input required
2. **Exit codes matter** - 0 for pass, 1 for fail
3. **Simple output** - Easy to parse by humans and LLMs
4. **No external dependencies** - Uses only what's already in package.json
5. **Fast execution** - Complete test suite runs in <30 seconds
6. **Deterministic** - Same results on repeated runs

This streamlined approach focuses on practical verification of core functionality without unnecessary complexity.
