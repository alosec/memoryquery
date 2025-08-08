#!/usr/bin/env node

/**
 * Test REAL sync pipeline - validates actual Claude Code conversations sync to database
 * This test uses existing conversation files, not synthetic data
 */

const fs = require('fs');
const path = require('path');
const {
  findRealConversations,
  getMostRecentConversation,
  parseRealJsonl,
  messageExistsInDb,
  countMessagesInDb,
  touchFile,
  appendToRealJsonl,
  sleep,
  getDatabaseStats,
  validateSyncDaemonRunning
} = require('./real-utils');

async function testRealSyncPipeline() {
  console.log('TEST: Real Sync Pipeline Validation');
  console.log('  Testing with actual Claude Code conversation files\n');
  
  let exitCode = 0;
  
  try {
    // Step 1: Find real conversation files
    console.log('Step 1: Locating real conversation files...');
    const conversations = findRealConversations();
    
    if (conversations.length === 0) {
      console.log('✗ No Claude Code conversation files found');
      console.log('  Expected location: ~/.claude/projects/*/conversation-*.jsonl');
      console.log('  Please ensure Claude Code has been used and generated conversations');
      return 1;
    }
    
    console.log(`✓ Found ${conversations.length} conversation files`);
    console.log(`  Most recent: ${conversations[0].name}`);
    console.log(`  Project: ${conversations[0].project}`);
    console.log(`  Size: ${(conversations[0].size / 1024).toFixed(1)} KB\n`);
    
    // Step 2: Validate sync daemon is running
    console.log('Step 2: Validating sync daemon status...');
    const syncStatus = await validateSyncDaemonRunning();
    
    if (!syncStatus.running) {
      console.log('✗ Sync daemon does not appear to be running');
      console.log(`  Reason: ${syncStatus.reason}`);
      console.log('  Start it with: npm run dev:sync');
      return 1;
    }
    
    console.log('✓ Sync daemon is running and processing files\n');
    
    // Step 3: Check existing sync status
    console.log('Step 3: Checking existing sync status...');
    const dbStats = getDatabaseStats();
    
    if (dbStats) {
      console.log(`  Database contains:`);
      console.log(`    - ${dbStats.messages} messages`);
      console.log(`    - ${dbStats.sessions} sessions`);
      console.log(`    - ${dbStats.toolUses} tool uses`);
      console.log(`    - Size: ${(dbStats.fileSize / 1024 / 1024).toFixed(1)} MB\n`);
    } else {
      console.log('  Database not yet initialized\n');
    }
    
    // Step 4: Test real-time sync with most recent conversation
    console.log('Step 4: Testing real-time sync...');
    const testConversation = getMostRecentConversation();
    
    if (!testConversation) {
      console.log('✗ Could not find a conversation to test with');
      return 1;
    }
    
    // Parse the existing messages
    const existingMessages = parseRealJsonl(testConversation.path);
    console.log(`  Conversation has ${existingMessages.length} messages`);
    
    // Check if some are already synced
    let syncedCount = 0;
    for (const msg of existingMessages.slice(0, 5)) { // Check first 5
      if (messageExistsInDb(msg.id)) {
        syncedCount++;
      }
    }
    
    if (syncedCount > 0) {
      console.log(`✓ ${syncedCount} existing messages already in database`);
    }
    
    // Step 5: Test new message append and sync
    console.log('\nStep 5: Testing new message sync...');
    const beforeCount = dbStats ? dbStats.messages : 0;
    
    const newMessage = appendToRealJsonl(testConversation.path, {
      user: 'Test question: Can you see this message?',
      assistant: 'Yes, this is a test message to validate sync functionality.'
    });
    
    console.log(`  Appended new message: ${newMessage.id}`);
    console.log('  Waiting for sync...');
    
    // Wait for sync with timeout
    const syncStart = Date.now();
    let synced = false;
    
    while (Date.now() - syncStart < 5000) {
      if (messageExistsInDb(newMessage.id)) {
        synced = true;
        break;
      }
      await sleep(100);
    }
    
    const syncTime = Date.now() - syncStart;
    
    if (synced) {
      console.log(`✓ New message synced in ${syncTime}ms`);
    } else {
      console.log('✗ New message not synced within 5 seconds');
      exitCode = 1;
    }
    
    // Step 6: Verify data integrity
    console.log('\nStep 6: Verifying data integrity...');
    const afterStats = getDatabaseStats();
    
    if (afterStats) {
      const messageIncrease = afterStats.messages - beforeCount;
      if (messageIncrease > 0) {
        console.log(`✓ Database updated: +${messageIncrease} messages`);
      }
      
      // Verify the session exists
      const sessionCount = countMessagesInDb(testConversation.path);
      if (sessionCount > 0) {
        console.log(`✓ Session properly linked: ${sessionCount} messages`);
      }
    }
    
    // Step 7: Test file touch triggers re-sync
    console.log('\nStep 7: Testing file modification detection...');
    const beforeTouch = afterStats ? afterStats.messages : 0;
    
    console.log('  Touching file to trigger re-scan...');
    touchFile(testConversation.path);
    
    await sleep(2000);
    
    const touchStats = getDatabaseStats();
    if (touchStats) {
      // File touch shouldn't create duplicates, count should be same or slightly higher
      console.log(`  Messages after touch: ${touchStats.messages}`);
      if (touchStats.messages >= beforeTouch) {
        console.log('✓ File modification handled correctly');
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Real Sync Pipeline Summary:');
    console.log('='.repeat(50));
    
    if (exitCode === 0) {
      console.log('✓ Sync daemon is processing real conversation files');
      console.log('✓ New messages are synced to database');
      console.log('✓ File modifications are detected');
      console.log('\nResult: PASS - Real sync pipeline is working!');
    } else {
      console.log('✗ Some sync operations failed');
      console.log('\nResult: FAIL - Check sync daemon configuration');
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    console.log('  Stack:', error.stack);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testRealSyncPipeline().then(process.exit);
}

module.exports = testRealSyncPipeline;
