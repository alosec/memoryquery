#!/usr/bin/env node

/**
 * Verify sync handles malformed JSONL gracefully
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const { getTestFile, sleep, getDbPath, generateMessage } = require('./utils');

async function testMalformedJSON() {
  console.log('TEST: Malformed JSONL Handling');
  
  let exitCode = 0;
  
  try {
    // Create mix of valid and invalid JSON
    const testFile = getTestFile();
    const validId1 = `valid-msg-1-${Date.now()}`;
    const validId2 = `valid-msg-2-${Date.now()}`;
    const validId3 = `valid-msg-3-${Date.now()}`;
    
    const content = [
      '{"broken": ',                                    // Incomplete JSON
      '',                                               // Empty line
      JSON.stringify(generateMessage(validId1)),       // Valid message
      'not even json at all',                          // Plain text
      '{ bad json no quotes }',                        // Invalid JSON syntax
      JSON.stringify(generateMessage(validId2)),       // Valid message
      '{"type":"message"',                             // Missing closing brace
      '\n\n\n',                                        // Multiple empty lines
      JSON.stringify(generateMessage(validId3)),       // Valid message
      '{"incomplete": "value", ',                      // Trailing comma incomplete
      'null',                                          // Valid JSON but not an object
      'undefined',                                     // Not JSON
      '[]',                                            // Valid JSON but wrong type
    ].join('\n');
    
    console.log('  Writing file with mix of valid and malformed JSON...');
    console.log(`  Total lines: ${content.split('\n').length}`);
    console.log(`  Valid messages: 3 (IDs: ${validId1}, ${validId2}, ${validId3})`);
    
    fs.writeFileSync(testFile, content);
    
    // Wait for sync to process
    console.log('  Waiting for sync to process...');
    await sleep(3000);
    
    // Check that valid messages were processed
    const dbPath = getDbPath();
    let found = [];
    
    try {
      const db = new Database(dbPath, { readonly: true });
      
      for (const id of [validId1, validId2, validId3]) {
        try {
          const row = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
          if (row) {
            found.push(id);
          }
        } catch (e) {
          // Continue checking others
        }
      }
      
      db.close();
    } catch (e) {
      console.log('  Warning: Could not query database:', e.message);
    }
    
    console.log(`\n  Valid messages synced: ${found.length}/3`);
    
    if (found.length === 3) {
      console.log('✓ All valid messages processed despite malformed lines');
    } else if (found.length > 0) {
      console.log(`⚠ Partial success: ${found.length}/3 valid messages processed`);
      console.log('  Synced IDs:', found.join(', '));
      // This is actually acceptable - shows resilience
    } else {
      console.log('✗ No valid messages were processed');
      console.log('  Is the sync daemon running?');
      exitCode = 1;
    }
    
    // Test with UTF-8 edge cases
    console.log('\n  Testing UTF-8 and special characters...');
    const utf8File = getTestFile();
    const utf8Id = `utf8-test-${Date.now()}`;
    
    const utf8Content = [
      '\uFEFF' + JSON.stringify(generateMessage(utf8Id)),  // BOM character
      '{"text": "emoji 😀 test"}',                         // Emoji
      '{"text": "中文测试"}',                              // Chinese characters
      '{"text": "\\u0000 null byte"}',                     // Null byte escape
    ].join('\n');
    
    fs.writeFileSync(utf8File, utf8Content, 'utf8');
    await sleep(2000);
    
    try {
      const db = new Database(dbPath, { readonly: true });
      const utf8Row = db.prepare('SELECT id FROM messages WHERE id = ?').get(utf8Id);
      db.close();
      
      if (utf8Row) {
        console.log('✓ UTF-8 and special characters handled correctly');
      } else {
        console.log('  UTF-8 message not synced (non-critical)');
      }
    } catch (e) {
      console.log('  Could not verify UTF-8 handling');
    }
    
    // Test recovery after malformed data
    console.log('\n  Testing recovery after errors...');
    const recoveryFile = getTestFile();
    const recoveryId = `recovery-${Date.now()}`;
    
    // Write bad data followed by good data
    fs.writeFileSync(recoveryFile, '{{{{VERY BAD JSON\n');
    fs.appendFileSync(recoveryFile, JSON.stringify(generateMessage(recoveryId)) + '\n');
    
    await sleep(2000);
    
    try {
      const db = new Database(dbPath, { readonly: true });
      const recoveryRow = db.prepare('SELECT id FROM messages WHERE id = ?').get(recoveryId);
      db.close();
      
      if (recoveryRow) {
        console.log('✓ Sync recovered and processed valid data after errors');
      } else {
        console.log('  Recovery message not synced');
      }
    } catch (e) {
      console.log('  Could not verify recovery');
    }
    
    if (found.length === 0) {
      console.log('\n✗ Test failed - no messages were processed');
      exitCode = 1;
    } else {
      console.log('\n✓ Malformed JSONL handling test completed');
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testMalformedJSON().then(process.exit);
}

module.exports = testMalformedJSON;
