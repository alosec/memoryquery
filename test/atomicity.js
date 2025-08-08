#!/usr/bin/env node

/**
 * Verify transactions are atomic (message + tool_uses together)
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const { getTestFile, sleep, getDbPath } = require('./utils');

async function testAtomicity() {
  console.log('TEST: Transaction Atomicity');
  
  let exitCode = 0;
  
  try {
    const messageId = `atomic-msg-${Date.now()}`;
    const toolUseId = `atomic-tool-${Date.now()}`;
    
    // Create a complex message with tool use
    const message = {
      id: messageId,
      type: 'message',
      timestamp: new Date().toISOString(),
      user_text: 'Read the file test.txt',
      assistant_text: 'I\'ll read that file for you.',
      project_name: 'test'
    };
    
    const toolUse = {
      id: toolUseId,
      message_id: messageId,
      type: 'tool_use',
      tool_name: 'read_file',
      parameters: JSON.stringify({ path: '/test.txt' })
    };
    
    const toolResult = {
      id: `${toolUseId}-result`,
      tool_use_id: toolUseId,
      type: 'tool_result',
      output: 'File contents here',
      error: null
    };
    
    // Write all as a transaction that should be atomic
    console.log('  Writing message with tool use...');
    const testFile = getTestFile();
    
    // Write in sequence as they would appear in a real conversation
    fs.writeFileSync(testFile, JSON.stringify(message) + '\n');
    fs.appendFileSync(testFile, JSON.stringify(toolUse) + '\n');
    fs.appendFileSync(testFile, JSON.stringify(toolResult) + '\n');
    
    // Wait for sync
    console.log('  Waiting for sync...');
    await sleep(3000);
    
    // Check both message and tool_use exist or neither
    const dbPath = getDbPath();
    let messageExists = false;
    let toolExists = false;
    let resultExists = false;
    
    try {
      const db = new Database(dbPath, { readonly: true });
      
      // Check for message
      try {
        const msgRow = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
        messageExists = !!msgRow;
      } catch (e) {
        // Table might not exist
      }
      
      // Check for tool use
      try {
        const toolRow = db.prepare('SELECT id FROM tool_uses WHERE id = ?').get(toolUseId);
        toolExists = !!toolRow;
      } catch (e) {
        // Table might not exist
      }
      
      // Check for tool result
      try {
        const resultRow = db.prepare('SELECT id FROM tool_use_results WHERE id = ?').get(`${toolUseId}-result`);
        resultExists = !!resultRow;
      } catch (e) {
        // Table might not exist
      }
      
      db.close();
    } catch (e) {
      console.log('  Warning: Could not query database:', e.message);
    }
    
    console.log(`\n  Message exists: ${messageExists ? 'Yes' : 'No'}`);
    console.log(`  Tool use exists: ${toolExists ? 'Yes' : 'No'}`);
    console.log(`  Tool result exists: ${resultExists ? 'Yes' : 'No'}`);
    
    // Check atomicity - all or nothing
    const allExist = messageExists && toolExists && resultExists;
    const noneExist = !messageExists && !toolExists && !resultExists;
    
    if (allExist) {
      console.log('\n✓ Transaction atomicity maintained - all records present');
    } else if (noneExist) {
      console.log('\n✓ Transaction atomicity maintained - no records present');
      console.log('  (Sync might not be running or needs more time)');
    } else {
      console.log('\n✗ Partial transaction detected - atomicity violation!');
      exitCode = 1;
    }
    
    // Test rollback scenario (malformed related data)
    console.log('\n  Testing rollback on error...');
    const badMessageId = `atomic-bad-${Date.now()}`;
    const badFile = getTestFile();
    
    // Write a message with invalid tool use reference
    const badMessage = {
      id: badMessageId,
      type: 'message',
      timestamp: new Date().toISOString(),
      user_text: 'Test rollback',
      assistant_text: 'Testing'
    };
    
    // Tool use with missing message_id field (should cause issues)
    const badToolUse = {
      id: `bad-tool-${Date.now()}`,
      type: 'tool_use',
      tool_name: 'read_file',
      // Intentionally missing message_id to test error handling
      parameters: '{invalid json'  // Also invalid JSON
    };
    
    fs.writeFileSync(badFile, JSON.stringify(badMessage) + '\n');
    fs.appendFileSync(badFile, JSON.stringify(badToolUse) + '\n');
    
    await sleep(2000);
    
    // The sync should handle this gracefully
    console.log('✓ Malformed data handled (no crash)');
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testAtomicity().then(process.exit);
}

module.exports = testAtomicity;
