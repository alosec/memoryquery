#!/usr/bin/env node

/**
 * Test that JSONL changes successfully sync to database
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { getTestFile, sleep, getDbPath, generateMessage } = require('./utils');

async function testSyncPipeline() {
  console.log('TEST: Sync Pipeline');
  
  let exitCode = 0;
  
  try {
    // 1. Create test JSONL file
    const testFile = getTestFile();
    const testMessage = generateMessage(`sync-test-${Date.now()}`);
    
    fs.writeFileSync(testFile, JSON.stringify(testMessage) + '\n');
    console.log('✓ Created test JSONL at:', testFile);
    
    // 2. Wait for sync (max 5 seconds)
    console.log('  Waiting for sync...');
    let found = false;
    const maxWait = 5000;
    const startTime = Date.now();
    
    const db = new Database(getDbPath(), { readonly: true });
    
    while (Date.now() - startTime < maxWait) {
      try {
        const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(testMessage.id);
        if (row) {
          found = true;
          break;
        }
      } catch (e) {
        // Database might not exist yet
      }
      await sleep(500);
    }
    
    db.close();
    
    if (found) {
      const elapsed = Date.now() - startTime;
      console.log(`✓ Message synced to database in ${elapsed}ms`);
    } else {
      console.log('✗ Message not found in database after 5s');
      console.log('  Message ID:', testMessage.id);
      console.log('  DB Path:', getDbPath());
      exitCode = 1;
    }
    
    // 3. Test multiple messages
    console.log('\n  Testing batch sync...');
    const batchFile = getTestFile();
    const batchMessages = [];
    
    for (let i = 0; i < 5; i++) {
      const msg = generateMessage(`batch-${Date.now()}-${i}`);
      batchMessages.push(msg);
      fs.appendFileSync(batchFile, JSON.stringify(msg) + '\n');
    }
    
    console.log('  Created 5 messages in batch');
    await sleep(3000);
    
    const db2 = new Database(getDbPath(), { readonly: true });
    let batchFound = 0;
    
    for (const msg of batchMessages) {
      try {
        const row = db2.prepare('SELECT * FROM messages WHERE id = ?').get(msg.id);
        if (row) batchFound++;
      } catch (e) {
        // Continue checking others
      }
    }
    
    db2.close();
    
    if (batchFound === 5) {
      console.log('✓ All 5 batch messages synced');
    } else {
      console.log(`✗ Only ${batchFound}/5 batch messages synced`);
      exitCode = 1;
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testSyncPipeline().then(process.exit);
}

module.exports = testSyncPipeline;
