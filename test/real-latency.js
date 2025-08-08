#!/usr/bin/env node

/**
 * Measure REAL sync latency using actual conversation files
 * Tests the actual time from JSONL modification to database availability
 */

const fs = require('fs');
const {
  findRealConversations,
  getMostRecentConversation,
  appendToRealJsonl,
  messageExistsInDb,
  sleep,
  getDatabaseStats,
  measureRealSyncLatency
} = require('./real-utils');

async function measureRealLatency() {
  console.log('TEST: Real Sync Latency Measurement');
  console.log('  Measuring actual JSONL → Database sync time');
  console.log('  Target: P50 < 500ms, P95 < 2000ms\n');
  
  let exitCode = 0;
  
  try {
    // Find a real conversation to test with
    console.log('Finding real conversation files...');
    const conversations = findRealConversations();
    
    if (conversations.length === 0) {
      console.log('✗ No Claude Code conversations found to test with');
      console.log('  Cannot measure latency without real files');
      return 1;
    }
    
    // Use the most recent conversation for testing
    const testFile = conversations[0];
    console.log(`✓ Using: ${testFile.name}`);
    console.log(`  Project: ${testFile.project}`);
    console.log(`  Size: ${(testFile.size / 1024).toFixed(1)} KB\n`);
    
    // Check database is accessible
    const dbStats = getDatabaseStats();
    if (!dbStats) {
      console.log('✗ Database not accessible - is sync daemon running?');
      console.log('  Start with: npm run dev:sync');
      return 1;
    }
    
    console.log('Running latency measurements...\n');
    
    const iterations = 10;
    const latencies = [];
    const failures = [];
    
    for (let i = 0; i < iterations; i++) {
      process.stdout.write(`  Iteration ${i + 1}/${iterations}: `);
      
      const latency = await measureRealSyncLatency(testFile.path, 10000);
      
      if (latency > 0) {
        latencies.push(latency);
        console.log(`${latency}ms`);
      } else {
        failures.push(i + 1);
        console.log('TIMEOUT (>10s)');
      }
      
      // Small delay between iterations to avoid overwhelming
      await sleep(500);
    }
    
    if (latencies.length === 0) {
      console.log('\n✗ All iterations failed - sync daemon not processing');
      console.log('  Check sync daemon logs for errors');
      return 1;
    }
    
    // Calculate statistics
    latencies.sort((a, b) => a - b);
    const successRate = (latencies.length / iterations * 100).toFixed(0);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || latencies[latencies.length - 1];
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const min = latencies[0];
    const max = latencies[latencies.length - 1];
    
    // Additional analysis
    console.log('\n' + '='.repeat(50));
    console.log('Latency Analysis:');
    console.log('='.repeat(50));
    console.log(`  Success Rate: ${successRate}%`);
    console.log(`  Samples: ${latencies.length}/${iterations}`);
    if (failures.length > 0) {
      console.log(`  Failed iterations: ${failures.join(', ')}`);
    }
    
    console.log('\n  Distribution:');
    console.log(`    Min:     ${min}ms`);
    console.log(`    P50:     ${p50}ms ${p50 < 500 ? '✓' : '✗'} (target: <500ms)`);
    console.log(`    Average: ${avg}ms`);
    console.log(`    P95:     ${p95}ms ${p95 < 2000 ? '✓' : '✗'} (target: <2000ms)`);
    console.log(`    P99:     ${p99}ms`);
    console.log(`    Max:     ${max}ms`);
    
    // Analyze latency patterns
    if (max > min * 10) {
      console.log('\n  ⚠ High variance detected (max > 10x min)');
      console.log('    Possible causes: disk I/O, database locks, or CPU spikes');
    }
    
    if (p95 > p50 * 4) {
      console.log('\n  ⚠ Long tail latency (P95 > 4x P50)');
      console.log('    Some syncs are significantly slower than typical');
    }
    
    // Test different file sizes if we have them
    if (conversations.length > 1) {
      console.log('\n' + '='.repeat(50));
      console.log('Testing File Size Impact:');
      console.log('='.repeat(50));
      
      const sizes = [
        conversations.find(c => c.size < 10 * 1024),      // <10KB
        conversations.find(c => c.size < 100 * 1024),     // <100KB
        conversations.find(c => c.size > 100 * 1024)      // >100KB
      ].filter(Boolean).slice(0, 3);
      
      for (const conv of sizes) {
        process.stdout.write(`  ${(conv.size / 1024).toFixed(0)}KB file: `);
        const latency = await measureRealSyncLatency(conv.path, 5000);
        if (latency > 0) {
          console.log(`${latency}ms`);
        } else {
          console.log('TIMEOUT');
        }
      }
    }
    
    // Determine pass/fail
    console.log('\n' + '='.repeat(50));
    console.log('Results:');
    console.log('='.repeat(50));
    
    if (p50 >= 500) {
      console.log('✗ P50 latency exceeds target (500ms)');
      exitCode = 1;
    } else {
      console.log('✓ P50 latency meets target');
    }
    
    if (p95 >= 2000) {
      console.log('✗ P95 latency exceeds target (2000ms)');
      exitCode = 1;
    } else {
      console.log('✓ P95 latency meets target');
    }
    
    if (successRate < 80) {
      console.log(`✗ Low success rate: ${successRate}%`);
      exitCode = 1;
    } else if (successRate < 100) {
      console.log(`⚠ Some timeouts occurred: ${successRate}% success`);
    } else {
      console.log('✓ All iterations completed successfully');
    }
    
    if (exitCode === 0) {
      console.log('\n✓ Real sync latency targets met!');
    } else {
      console.log('\n✗ Performance targets not met');
      console.log('  Consider optimizing database indexes or sync batch size');
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  measureRealLatency().then(process.exit);
}

module.exports = measureRealLatency;
