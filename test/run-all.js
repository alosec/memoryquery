#!/usr/bin/env node

/**
 * Master test runner - executes all tests and reports results
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { cleanupTestFiles } = require('./utils');

// Test files in execution order
const tests = [
  { name: 'Sync Pipeline', file: 'sync-pipeline.js', critical: true },
  { name: 'MCP Queries', file: 'mcp-query.js', critical: true },
  { name: 'Sync Latency', file: 'measure-latency.js', critical: true },
  { name: 'Deduplication', file: 'deduplication.js', critical: false },
  { name: 'Transaction Atomicity', file: 'atomicity.js', critical: false },
  { name: 'Malformed JSONL', file: 'malformed-jsonl.js', critical: false },
  { name: 'Large File Processing', file: 'large-file.js', critical: false }
];

/**
 * Run a single test file
 */
async function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, testFile);
    
    // Check if test file exists
    if (!fs.existsSync(testPath)) {
      console.log(`  ✗ Test file not found: ${testFile}`);
      resolve({ passed: false, error: 'File not found' });
      return;
    }
    
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
  console.log('Simple Memory MCP - Test Suite');
  console.log('='.repeat(60));
  console.log(`Running ${tests.length} tests...\n`);
  
  // Check if sync daemon and MCP server might be running
  console.log('Pre-flight checks:');
  console.log('  - Ensure sync daemon is running: npm run dev:sync');
  console.log('  - Database path:', process.env.SIMPLE_MEMORY_DB_PATH || '~/.local/share/simple-memory/mcp.db');
  console.log('');
  
  // Clean up any previous test files
  console.log('Cleaning up previous test files...');
  cleanupTestFiles();
  console.log('');
  
  const results = [];
  let criticalFailure = false;
  
  // Run each test
  for (const test of tests) {
    console.log('─'.repeat(60));
    console.log(`Running: ${test.name}`);
    console.log('─'.repeat(60));
    
    const result = await runTest(test.file);
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
    
    console.log('');
  }
  
  // Clean up test files
  console.log('Cleaning up test files...');
  cleanupTestFiles();
  
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
    console.log('✓ All tests passed! 🎉');
    process.exit(0);
  } else if (criticalFailure) {
    console.log('✗ Critical tests failed - system not working correctly');
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
