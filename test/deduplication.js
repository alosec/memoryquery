#!/usr/bin/env node

/**
 * Verify no duplicate messages are created
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const { getTestFile, sleep, getDbPath, generateMessage } = require('./utils');

async function testDeduplication() {
  console.log('TEST: Message Deduplication');
  
  let exitCode = 0;
  
  try {
    // Create a unique message
    const messageId = `dedup-test-${Date.now()}`;
    const message = generateMessage(messageId, {
      userText: 'Testing deduplication',
      assistantText: 'This message should only appear once'
    });
    
    const testFile = getTestFile();
    
    // Write the same message multiple times
    console.log('  Writing same message 3 times...');
    fs.writeFileSync(testFile, JSON.stringify(message) + '\n');
    await sleep(1000);
    
    fs.appendFileSync(testFile, JSON.stringify(message) + '\n');
    await sleep(1000);
    
    fs.appendFileSync(testFile, JSON.stringify(message) + '\n');
    await sleep(2000); // Give extra time for all syncs
    
    // Check database has only one entry
    const dbPath = getDbPath();
    let count = 0;
    
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.prepare('SELECT COUNT(*) as count FROM messages WHERE id = ?').get(messageId);
      count = result ? result.count : 0;
      db.close();
    } catch (e) {
      console.log('  Warning: Could not query database:', e.message);
    }
    
    if (count === 1) {
      console.log('✓ Deduplication working - only 1 copy in database');
    } else if (count === 0) {
      console.log('✗ Message not found in database - is sync daemon running?');
      exitCode = 1;
    } else {
      console.log(`✗ Found ${count} copies in database (expected 1)`);
      exitCode = 1;
    }
    
    // Test with slight variations
    console.log('\n  Testing timestamp variations...');
    const baseId = `dedup-timestamp-${Date.now()}`;
    const file2 = getTestFile();
    
    // Same ID but different timestamps
    const msg1 = generateMessage(baseId);
    await sleep(100);
    const msg2 = { ...msg1, timestamp: new Date().toISOString() };
    
    fs.writeFileSync(file2, JSON.stringify(msg1) + '\n');
    await sleep(1000);
    fs.appendFileSync(file2, JSON.stringify(msg2) + '\n');
    await sleep(2000);
    
    try {
      const db = new Database(dbPath, { readonly: true });
      const result = db.prepare('SELECT COUNT(*) as count FROM messages WHERE id = ?').get(baseId);
      const varCount = result ? result.count : 0;
      db.close();
      
      if (varCount === 1) {
        console.log('✓ ID-based deduplication works despite timestamp differences');
      } else if (varCount === 0) {
        console.log('  Message with variations not synced');
      } else {
        console.log(`✗ Found ${varCount} copies with timestamp variations (expected 1)`);
        exitCode = 1;
      }
    } catch (e) {
      console.log('  Could not verify timestamp deduplication');
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testDeduplication().then(process.exit);
}

module.exports = testDeduplication;
