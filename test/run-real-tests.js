#!/usr/bin/env node

/**
 * Master test runner - executes REAL validation tests
 * Tests actual sync daemon functionality with real conversation files
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Real validation tests (not synthetic)
const tests = [
  { 
    name: 'Status Check', 
    file: 'check-status.js', 
    critical: true,
    description: 'Basic health check without triggering logs'
  },
  { 
    name: 'Real Sync Pipeline', 
    file: 'real-sync-pipeline.js', 
    critical: true,
    description: 'Validates actual conversation file synchronization'
  },
  { 
    name: 'Sync Latency', 
    file: 'latency-timestamp.js', 
    critical: true,
    description: 'Measures JSONL vs DB timestamp gap'
  },
  { 
    name: 'Data Integrity', 
    file: 'real-data-integrity.js', 
    critical: false,
    description: 'Validates synced data matches source files'
  },
  { 
    name: 'MCP Queries', 
    file: 'mcp-query.js', 
    critical: false,
    description: 'Tests MCP tool functionality'
  }
];

// Keep some original tests that still make sense
const optionalTests = [
  { 
    name: 'Deduplication', 
    file: 'deduplication.js', 
    critical: false,
    description: 'Ensures no duplicate messages'
  },
  { 
    name: 'Malformed JSONL', 
    file: 'malformed-jsonl.js', 
    critical: false,
    description: 'Tests error handling'
  }
];

/**
 * Run a single test file
 */
async function runTest(testFile, description) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, testFile);
    
    // Check if test file exists
    if (!fs.existsSync(testPath)) {
      console.log(`  ✗ Test file not found: ${testFile}`);
      resolve({ passed: false, error: 'File not found' });
      return;
    }
    
    console.log(`  ${description}`);
    console.log('');
    
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('exit', (code) => {
      resolve({ passed: code === 0, exitCode: code });
    });
    
    child.on('error', (err) => {
      console.log(`  ✗ Failed to run test: ${err.message}`);
      resolve({ passed: false, error: err.message });
    });
  });
}

/**
 * Main test runner
 */
async function main() {
  const startTime = Date.now();
  
  console.log('='.repeat(60));
  console.log('Simple Memory MCP - Real Validation Test Suite');
  console.log('='.repeat(60));
  console.log('Testing with actual Claude Code conversation files\n');
  
  // Pre-flight message
  console.log('Prerequisites:');
  console.log('  1. Claude Code must have existing conversations');
  console.log('  2. Sync daemon should be running: npm run dev:sync');
  console.log('  3. Database path should be configured correctly');
  console.log('');
  
  const results = [];
  let criticalFailure = false;
  
  // Run core tests
  console.log('Running Real Validation Tests:\n');
  console.log('─'.repeat(60));
  
  for (const test of tests) {
    console.log(`\n${test.name}:`);
    console.log('─'.repeat(60));
    
    const result = await runTest(test.file, test.description);
    results.push({
      name: test.name,
      file: test.file,
      passed: result.passed,
      critical: test.critical,
      error: result.error
    });
    
    if (!result.passed && test.critical) {
      criticalFailure = true;
    }
  }
  
  // Optionally run additional tests if core tests pass
  if (!criticalFailure && process.env.RUN_OPTIONAL_TESTS === 'true') {
    console.log('\n' + '─'.repeat(60));
    console.log('Running Optional Tests:\n');
    
    for (const test of optionalTests) {
      console.log(`\n${test.name}:`);
      console.log('─'.repeat(60));
      
      const result = await runTest(test.file, test.description);
      results.push({
        name: test.name,
        file: test.file,
        passed: result.passed,
        critical: false,
        error: result.error
      });
    }
  }
  
  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  
  // List results
  for (const result of results) {
    const icon = result.passed ? '✓' : '✗';
    const critical = result.critical ? ' [CRITICAL]' : '';
    const error = result.error ? ` (${result.error})` : '';
    console.log(`  ${icon} ${result.name}${critical}${error}`);
  }
  
  console.log('');
  console.log(`Total: ${passed} passed, ${failed} failed`);
  console.log(`Time: ${totalTime}s`);
  
  // Overall result
  console.log('');
  if (failed === 0) {
    console.log('✓ All tests passed! Real sync pipeline is working correctly 🎉');
    process.exit(0);
  } else if (criticalFailure) {
    console.log('✗ Critical tests failed - sync pipeline not working');
    console.log('\nTroubleshooting:');
    console.log('  1. Ensure sync daemon is running: npm run dev:sync');
    console.log('  2. Check database path configuration');
    console.log('  3. Verify Claude Code has conversation files');
    process.exit(2);
  } else {
    console.log('⚠ Some tests failed but core functionality works');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(3);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(3);
});

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(3);
  });
}

module.exports = main;
