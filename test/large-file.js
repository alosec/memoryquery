#!/usr/bin/env node

/**
 * Test handling of large JSONL files
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const { getTestFile, sleep, getDbPath, generateMessage } = require('./utils');

async function testLargeFile() {
  console.log('TEST: Large File Processing');
  
  let exitCode = 0;
  
  try {
    const messageCount = 1000;
    console.log(`  Generating ${messageCount} messages...`);
    
    const testFile = getTestFile();
    const messages = [];
    const messageIds = [];
    
    // Generate messages
    for (let i = 0; i < messageCount; i++) {
      const id = `large-test-${Date.now()}-${i}`;
      messageIds.push(id);
      
      const msg = generateMessage(id, {
        userText: `User message ${i} - This is a longer message to simulate real conversation content with more data`,
        assistantText: `Assistant response ${i} - This response contains detailed information and multiple sentences to better simulate actual usage patterns. The response includes various details and explanations that would typically be found in a real conversation.`,
        projectName: 'large-file-test',
        extra: {
          metadata: {
            index: i,
            batch: Math.floor(i / 100),
            timestamp_ms: Date.now()
          }
        }
      });
      
      messages.push(JSON.stringify(msg));
      
      // Show progress
      if ((i + 1) % 100 === 0) {
        process.stdout.write(`\r  Generated ${i + 1}/${messageCount} messages...`);
      }
    }
    
    console.log(`\n  Writing ${messageCount} messages to file...`);
    const startWrite = Date.now();
    fs.writeFileSync(testFile, messages.join('\n') + '\n');
    const writeTime = Date.now() - startWrite;
    console.log(`  File written in ${writeTime}ms`);
    
    // Get file size
    const stats = fs.statSync(testFile);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  File size: ${fileSizeMB} MB`);
    
    // Wait for sync with progress updates
    console.log('\n  Waiting for sync to process...');
    const syncStart = Date.now();
    const maxWaitTime = 30000; // 30 seconds max
    const checkInterval = 1000; // Check every second
    
    const dbPath = getDbPath();
    let lastCount = 0;
    let stableCount = 0;
    
    while (Date.now() - syncStart < maxWaitTime) {
      await sleep(checkInterval);
      
      let currentCount = 0;
      try {
        const db = new Database(dbPath, { readonly: true });
        const result = db.prepare(
          'SELECT COUNT(*) as count FROM messages WHERE id LIKE ?'
        ).get(`large-test-${syncStart}-%`);
        currentCount = result ? result.count : 0;
        db.close();
      } catch (e) {
        // Database might not be ready
      }
      
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  Synced ${currentCount}/${messageCount} messages (${elapsed}s elapsed)...`);
      
      // Check if sync has stabilized (same count for 3 checks)
      if (currentCount === lastCount) {
        stableCount++;
        if (stableCount >= 3 && currentCount > 0) {
          console.log('\n  Sync appears complete (count stable)');
          break;
        }
      } else {
        stableCount = 0;
      }
      lastCount = currentCount;
      
      // If all messages synced, we're done
      if (currentCount === messageCount) {
        console.log('\n  All messages synced!');
        break;
      }
    }
    
    // Final count
    let finalCount = 0;
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.prepare(
        'SELECT COUNT(*) as count FROM messages WHERE id LIKE ?'
      ).get(`large-test-${syncStart}-%`);
      finalCount = result ? result.count : 0;
      db.close();
    } catch (e) {
      console.log('\n  Error checking final count:', e.message);
    }
    
    const totalSyncTime = Date.now() - syncStart;
    const successRate = (finalCount / messageCount * 100).toFixed(1);
    
    console.log('\n' + '='.repeat(40));
    console.log('Results:');
    console.log('='.repeat(40));
    console.log(`  Messages generated: ${messageCount}`);
    console.log(`  Messages synced: ${finalCount}`);
    console.log(`  Success rate: ${successRate}%`);
    console.log(`  Total sync time: ${(totalSyncTime / 1000).toFixed(1)}s`);
    
    if (finalCount > 0) {
      const avgTimePerMsg = (totalSyncTime / finalCount).toFixed(1);
      console.log(`  Avg time per message: ${avgTimePerMsg}ms`);
    }
    
    // Determine pass/fail
    if (finalCount === messageCount) {
      console.log('\n✓ All messages successfully synced');
    } else if (finalCount >= messageCount * 0.95) {
      console.log('\n✓ >95% of messages synced (acceptable)');
    } else if (finalCount >= messageCount * 0.80) {
      console.log('\n⚠ 80-95% of messages synced (degraded performance)');
      exitCode = 1;
    } else if (finalCount > 0) {
      console.log(`\n✗ Only ${successRate}% of messages synced`);
      exitCode = 1;
    } else {
      console.log('\n✗ No messages were synced - is the sync daemon running?');
      exitCode = 1;
    }
    
    // Test memory efficiency (rough check)
    if (global.gc) {
      global.gc();
      const memUsage = process.memoryUsage();
      const heapMB = (memUsage.heapUsed / (1024 * 1024)).toFixed(1);
      console.log(`\n  Memory usage: ${heapMB} MB heap`);
    }
    
  } catch (error) {
    console.log('\n✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testLargeFile().then(process.exit);
}

module.exports = testLargeFile;
