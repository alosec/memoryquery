#!/usr/bin/env node

/**
 * Measure sync latency non-interactively
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const { getTestFile, sleep, getDbPath, generateMessage } = require('./utils');

async function measureLatency() {
  console.log('TEST: Sync Latency Measurement');
  console.log('  Target: P50 < 500ms, P95 < 2000ms\n');
  
  const iterations = 10;
  const latencies = [];
  let exitCode = 0;
  
  try {
    // Ensure database directory exists
    const dbPath = getDbPath();
    const dbDir = require('path').dirname(dbPath);
    fs.mkdirSync(dbDir, { recursive: true });
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const messageId = `latency-test-${startTime}-${i}`;
      
      // Write JSONL
      const testFile = getTestFile();
      const message = generateMessage(messageId, {
        userText: `Latency test iteration ${i + 1}`,
        assistantText: `Response for iteration ${i + 1}`
      });
      
      fs.writeFileSync(testFile, JSON.stringify(message) + '\n');
      
      // Poll database until message appears (max 10s)
      let found = false;
      let db = null;
      
      try {
        db = new Database(dbPath, { readonly: true });
        
        while (Date.now() - startTime < 10000) {
          try {
            const row = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
            if (row) {
              found = true;
              break;
            }
          } catch (e) {
            // Database table might not exist yet
          }
          await sleep(50); // Poll every 50ms
        }
      } catch (e) {
        // Database might not exist yet
      } finally {
        if (db) db.close();
      }
      
      if (found) {
        const latency = Date.now() - startTime;
        latencies.push(latency);
        console.log(`  Iteration ${i + 1}: ${latency}ms`);
      } else {
        console.log(`  Iteration ${i + 1}: TIMEOUT (>10s)`);
      }
      
      // Small delay between iterations
      await sleep(200);
    }
    
    if (latencies.length === 0) {
      console.log('\n✗ No successful syncs - is the sync daemon running?');
      console.log('  Start it with: npm run dev:sync');
      return 1;
    }
    
    // Calculate statistics
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    
    console.log('\n' + '='.repeat(40));
    console.log('Results:');
    console.log('='.repeat(40));
    console.log(`  Successful: ${latencies.length}/${iterations}`);
    console.log(`  Min: ${min}ms`);
    console.log(`  Max: ${max}ms`);
    console.log(`  Average: ${avg}ms`);
    console.log(`  P50: ${p50}ms ${p50 < 500 ? '✓' : '✗'} (target: <500ms)`);
    console.log(`  P95: ${p95}ms ${p95 < 2000 ? '✓' : '✗'} (target: <2000ms)`);
    
    // Determine pass/fail
    if (p50 >= 500) {
      console.log('\n✗ P50 latency exceeds target');
      exitCode = 1;
    }
    if (p95 >= 2000) {
      console.log('✗ P95 latency exceeds target');
      exitCode = 1;
    }
    if (exitCode === 0 && latencies.length === iterations) {
      console.log('\n✓ All latency targets met!');
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  measureLatency().then(process.exit);
}

module.exports = measureLatency;
