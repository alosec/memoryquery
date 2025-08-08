#!/usr/bin/env node

/**
 * Test data integrity of real conversations in database
 * Validates that synced data matches source JSONL files
 */

const fs = require('fs');
const Database = require('better-sqlite3');
const {
  findRealConversations,
  parseRealJsonl,
  getDbPath,
  sleep
} = require('./real-utils');

async function testDataIntegrity() {
  console.log('TEST: Real Data Integrity Validation');
  console.log('  Comparing source JSONL files with database content\n');
  
  let exitCode = 0;
  
  try {
    // Find real conversations
    const conversations = findRealConversations();
    
    if (conversations.length === 0) {
      console.log('✗ No conversation files found to validate');
      return 1;
    }
    
    console.log(`Found ${conversations.length} conversations to validate\n`);
    
    // Open database
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      console.log('✗ Database not found - sync daemon needs to run first');
      return 1;
    }
    
    const db = new Database(dbPath, { readonly: true });
    
    // Test up to 5 most recent conversations
    const testConversations = conversations.slice(0, 5);
    let totalMessages = 0;
    let syncedMessages = 0;
    let missingMessages = [];
    let dataIntegrityIssues = [];
    
    for (const conv of testConversations) {
      console.log(`Validating: ${conv.name}`);
      console.log(`  Project: ${conv.project}`);
      
      // Parse source JSONL
      const sourceMessages = parseRealJsonl(conv.path);
      totalMessages += sourceMessages.length;
      
      console.log(`  Source messages: ${sourceMessages.length}`);
      
      // Check each message in database
      let foundCount = 0;
      let integrityErrors = 0;
      
      for (const sourceMsg of sourceMessages) {
        try {
          const dbMsg = db.prepare(`
            SELECT id, user_text, assistant_text, timestamp 
            FROM messages 
            WHERE id = ?
          `).get(sourceMsg.id);
          
          if (dbMsg) {
            foundCount++;
            syncedMessages++;
            
            // Validate timestamp matches (roughly)
            if (sourceMsg.timestamp) {
              const sourceTime = new Date(sourceMsg.timestamp).getTime();
              const dbTime = new Date(dbMsg.timestamp).getTime();
              const timeDiff = Math.abs(sourceTime - dbTime);
              
              if (timeDiff > 1000) { // More than 1 second difference
                integrityErrors++;
                dataIntegrityIssues.push({
                  id: sourceMsg.id,
                  issue: 'Timestamp mismatch',
                  source: sourceMsg.timestamp,
                  database: dbMsg.timestamp
                });
              }
            }
            
            // Check content presence (not exact match due to potential encoding)
            if (sourceMsg.hasUser && !dbMsg.user_text) {
              integrityErrors++;
              dataIntegrityIssues.push({
                id: sourceMsg.id,
                issue: 'Missing user_text in database'
              });
            }
            
            if (sourceMsg.hasAssistant && !dbMsg.assistant_text) {
              integrityErrors++;
              dataIntegrityIssues.push({
                id: sourceMsg.id,
                issue: 'Missing assistant_text in database'
              });
            }
          } else {
            missingMessages.push({
              conversation: conv.name,
              messageId: sourceMsg.id
            });
          }
        } catch (e) {
          // Query error
        }
      }
      
      const syncRate = (foundCount / sourceMessages.length * 100).toFixed(1);
      console.log(`  Synced: ${foundCount}/${sourceMessages.length} (${syncRate}%)`);
      
      if (integrityErrors > 0) {
        console.log(`  ⚠ Integrity issues: ${integrityErrors}`);
      }
      
      if (foundCount === sourceMessages.length) {
        console.log('  ✓ All messages synced correctly');
      } else if (foundCount > 0) {
        console.log(`  ⚠ Partial sync: ${sourceMessages.length - foundCount} messages missing`);
      } else {
        console.log('  ✗ No messages from this conversation in database');
      }
      
      console.log('');
    }
    
    // Check for duplicates
    console.log('Checking for duplicate messages...');
    const duplicates = db.prepare(`
      SELECT id, COUNT(*) as count 
      FROM messages 
      GROUP BY id 
      HAVING count > 1
    `).all();
    
    if (duplicates.length > 0) {
      console.log(`✗ Found ${duplicates.length} duplicate message IDs`);
      exitCode = 1;
    } else {
      console.log('✓ No duplicate messages found');
    }
    
    // Check for orphaned records
    console.log('\nChecking for orphaned records...');
    const orphanedToolUses = db.prepare(`
      SELECT COUNT(*) as count 
      FROM tool_uses 
      WHERE message_id NOT IN (SELECT id FROM messages)
    `).get().count;
    
    if (orphanedToolUses > 0) {
      console.log(`⚠ Found ${orphanedToolUses} orphaned tool uses`);
    } else {
      console.log('✓ No orphaned tool uses');
    }
    
    db.close();
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Data Integrity Summary:');
    console.log('='.repeat(50));
    console.log(`  Total messages in files: ${totalMessages}`);
    console.log(`  Messages in database: ${syncedMessages}`);
    console.log(`  Sync rate: ${(syncedMessages / totalMessages * 100).toFixed(1)}%`);
    
    if (missingMessages.length > 0) {
      console.log(`  Missing messages: ${missingMessages.length}`);
      if (missingMessages.length <= 5) {
        missingMessages.forEach(m => {
          console.log(`    - ${m.messageId} from ${m.conversation}`);
        });
      }
    }
    
    if (dataIntegrityIssues.length > 0) {
      console.log(`\n  Data integrity issues: ${dataIntegrityIssues.length}`);
      dataIntegrityIssues.slice(0, 3).forEach(issue => {
        console.log(`    - ${issue.id}: ${issue.issue}`);
      });
    }
    
    if (syncedMessages === totalMessages && dataIntegrityIssues.length === 0) {
      console.log('\n✓ Perfect data integrity - all messages synced correctly!');
    } else if (syncedMessages / totalMessages > 0.95) {
      console.log('\n✓ Good data integrity - >95% messages synced');
    } else if (syncedMessages / totalMessages > 0.80) {
      console.log('\n⚠ Acceptable data integrity - >80% messages synced');
    } else {
      console.log('\n✗ Poor data integrity - significant sync issues');
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
  testDataIntegrity().then(process.exit);
}

module.exports = testDataIntegrity;
