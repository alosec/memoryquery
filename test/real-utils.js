#!/usr/bin/env node

/**
 * Test utilities for real conversation sync validation
 * Tests against actual Claude Code JSONL files, not synthetic data
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

/**
 * Find real Claude Code conversation files
 */
function findRealConversations() {
  const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
  const conversations = [];
  
  if (!fs.existsSync(claudeProjectsPath)) {
    console.log('  Warning: Claude projects directory not found:', claudeProjectsPath);
    return conversations;
  }
  
  // Recursively find all .jsonl files
  function scanDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          const stats = fs.statSync(fullPath);
          conversations.push({
            path: fullPath,
            name: entry.name,
            size: stats.size,
            modified: stats.mtime,
            project: path.basename(path.dirname(fullPath))
          });
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
  }
  
  scanDir(claudeProjectsPath);
  return conversations.sort((a, b) => b.modified - a.modified); // Most recent first
}

/**
 * Get the most recent conversation file
 */
function getMostRecentConversation() {
  const conversations = findRealConversations();
  return conversations[0] || null;
}

/**
 * Parse a real JSONL file to extract message count
 */
function parseRealJsonl(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const messages = [];
    
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'message' && obj.id) {
          messages.push({
            id: obj.id,
            timestamp: obj.timestamp,
            hasUser: !!obj.user_text,
            hasAssistant: !!obj.assistant_text
          });
        }
      } catch (e) {
        // Skip malformed lines in real files
      }
    }
    
    return messages;
  } catch (e) {
    return [];
  }
}

/**
 * Get database path from environment or default
 */
function getDbPath() {
  return process.env.SIMPLE_MEMORY_DB_PATH || 
    path.join(os.homedir(), '.local/share/simple-memory/mcp.db');
}

/**
 * Check if a specific message exists in the database
 */
function messageExistsInDb(messageId) {
  const dbPath = getDbPath();
  
  if (!fs.existsSync(dbPath)) {
    return false;
  }
  
  try {
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT id FROM messages WHERE id = ?').get(messageId);
    db.close();
    return !!row;
  } catch (e) {
    return false;
  }
}

/**
 * Count messages in database for a session
 */
function countMessagesInDb(sessionPath) {
  const dbPath = getDbPath();
  
  if (!fs.existsSync(dbPath)) {
    return 0;
  }
  
  try {
    const db = new Database(dbPath, { readonly: true });
    // Match by session path or project name
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM messages m
      JOIN sessions s ON m.session_id = s.id
      WHERE s.path = ? OR s.path LIKE ?
    `).get(sessionPath, `%${path.basename(sessionPath)}%`);
    
    db.close();
    return result ? result.count : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Touch a file to trigger file watcher
 */
function touchFile(filePath) {
  const now = new Date();
  fs.utimesSync(filePath, now, now);
}

/**
 * Append a new message to an existing JSONL file
 */
function appendToRealJsonl(filePath, message) {
  const newMessage = {
    id: `test-append-${Date.now()}`,
    type: 'message',
    timestamp: new Date().toISOString(),
    user_text: message.user || 'Test user message',
    assistant_text: message.assistant || 'Test assistant response',
    project_name: path.basename(path.dirname(filePath))
  };
  
  fs.appendFileSync(filePath, '\n' + JSON.stringify(newMessage) + '\n');
  return newMessage;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Measure sync latency for a real file modification
 */
async function measureRealSyncLatency(filePath, timeout = 10000) {
  const startTime = Date.now();
  
  // Append a trackable message
  const testMessage = appendToRealJsonl(filePath, {
    user: `Latency test at ${new Date().toISOString()}`,
    assistant: 'Measuring sync latency'
  });
  
  // Poll for the message in the database
  while (Date.now() - startTime < timeout) {
    if (messageExistsInDb(testMessage.id)) {
      return Date.now() - startTime;
    }
    await sleep(50);
  }
  
  return -1; // Timeout
}

/**
 * Get database statistics
 */
function getDatabaseStats() {
  const dbPath = getDbPath();
  
  if (!fs.existsSync(dbPath)) {
    return null;
  }
  
  try {
    const db = new Database(dbPath, { readonly: true });
    
    const stats = {
      messages: db.prepare('SELECT COUNT(*) as count FROM messages').get().count,
      sessions: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
      toolUses: 0,
      fileSize: fs.statSync(dbPath).size
    };
    
    // Try to get tool uses if table exists
    try {
      stats.toolUses = db.prepare('SELECT COUNT(*) as count FROM tool_uses').get().count;
    } catch (e) {
      // Table might not exist
    }
    
    db.close();
    return stats;
  } catch (e) {
    return null;
  }
}

/**
 * Validate sync daemon is actually running
 */
async function validateSyncDaemonRunning() {
  const initialStats = getDatabaseStats();
  
  if (!initialStats) {
    return { running: false, reason: 'Database not found' };
  }
  
  // Find a recent conversation to test with
  const conversation = getMostRecentConversation();
  
  if (!conversation) {
    return { running: false, reason: 'No conversation files found' };
  }
  
  // Touch the file to trigger sync
  const beforeTouch = initialStats.messages;
  touchFile(conversation.path);
  
  // Wait a bit for sync
  await sleep(2000);
  
  const afterStats = getDatabaseStats();
  
  if (afterStats && afterStats.messages !== beforeTouch) {
    return { running: true, messagesChanged: afterStats.messages - beforeTouch };
  }
  
  // Try appending a message
  const testMessage = appendToRealJsonl(conversation.path, {
    user: 'Sync daemon validation test',
    assistant: 'Testing if sync is active'
  });
  
  await sleep(3000);
  
  if (messageExistsInDb(testMessage.id)) {
    return { running: true, newMessageSynced: true };
  }
  
  return { running: false, reason: 'No sync activity detected' };
}

module.exports = {
  findRealConversations,
  getMostRecentConversation,
  parseRealJsonl,
  getDbPath,
  messageExistsInDb,
  countMessagesInDb,
  touchFile,
  appendToRealJsonl,
  sleep,
  measureRealSyncLatency,
  getDatabaseStats,
  validateSyncDaemonRunning
};
