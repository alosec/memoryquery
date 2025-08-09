#!/usr/bin/env node

/**
 * Timestamp-based sync latency measurement
 * Compares latest JSONL timestamps with latest database timestamps
 * Based on cafe-db-sync reference implementation
 */

const fs = require('fs');
const path = require('path');
const { homedir } = require('os');
const Database = require('better-sqlite3');

// Configuration
const PROJECTS_PATH = process.env.CLAUDE_PROJECTS_PATH || 
  path.join(homedir(), '.claude', 'projects');

const DB_PATH = process.env.SIMPLE_MEMORY_DB_PATH || 
  path.join(homedir(), '.local', 'share', 'simple-memory', 'mcp.db');

/**
 * Get latest timestamp from all JSONL files
 */
function getLatestJsonlTimestamp() {
  let latestTimestamp = null;
  let latestFile = null;
  
  try {
    if (!fs.existsSync(PROJECTS_PATH)) {
      console.log(`  Projects directory not found: ${PROJECTS_PATH}`);
      return { timestamp: null, file: null };
    }

    const projects = fs.readdirSync(PROJECTS_PATH);
    
    for (const project of projects) {
      const projectDir = path.join(PROJECTS_PATH, project);
      
      try {
        const stat = fs.statSync(projectDir);
        if (!stat.isDirectory()) continue;
        
        const files = fs.readdirSync(projectDir);
        
        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;
          
          const filePath = path.join(projectDir, file);
          
          try {
            const content = fs.readFileSync(filePath, 'utf8').trim();
            if (!content) continue;
            
            const lines = content.split('\n');
            const lastLine = lines[lines.length - 1];
            
            if (!lastLine.trim()) continue;
            
            const message = JSON.parse(lastLine);
            if (!message.timestamp) continue;
            
            const timestamp = new Date(message.timestamp);
            
            if (!latestTimestamp || timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
              latestFile = filePath;
            }
            
          } catch (error) {
            // Skip malformed files
            continue;
          }
        }
      } catch (error) {
        // Skip inaccessible projects
        continue;
      }
    }
  } catch (error) {
    console.log(`  Error scanning JSONL files: ${error.message}`);
    return { timestamp: null, file: null };
  }
  
  return { 
    timestamp: latestTimestamp, 
    file: latestFile ? path.basename(latestFile) : null 
  };
}

/**
 * Get latest timestamp from database
 */
function getLatestDatabaseTimestamp() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log(`  Database not found: ${DB_PATH}`);
      return null;
    }
    
    const db = new Database(DB_PATH, { readonly: true });
    
    try {
      const result = db.prepare(`
        SELECT timestamp 
        FROM messages 
        ORDER BY timestamp DESC 
        LIMIT 1
      `).get();
      
      return result ? new Date(result.timestamp) : null;
    } finally {
      db.close();
    }
  } catch (error) {
    console.log(`  Error querying database: ${error.message}`);
    return null;
  }
}

/**
 * Calculate sync lag in seconds
 */
function calculateSyncLag(jsonlTime, dbTime) {
  if (!jsonlTime || !dbTime) {
    return -1; // Missing data
  }
  
  return Math.abs(jsonlTime.getTime() - dbTime.getTime()) / 1000;
}

/**
 * Classify sync status
 */
function classifySyncStatus(lagSeconds) {
  if (lagSeconds < 0) return 'missing_data';
  if (lagSeconds <= 3) return 'healthy';
  if (lagSeconds <= 10) return 'delayed';
  return 'stale';
}

/**
 * Get database statistics
 */
function getDatabaseStats() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return null;
    }
    
    const db = new Database(DB_PATH, { readonly: true });
    
    try {
      const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
      const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
      const fileSize = fs.statSync(DB_PATH).size;
      
      return {
        messages: messageCount.count,
        sessions: sessionCount.count,
        fileSize: fileSize
      };
    } finally {
      db.close();
    }
  } catch (error) {
    return null;
  }
}

/**
 * Main latency test
 */
async function testSyncLatency() {
  console.log('TEST: Sync Latency (Timestamp Comparison)');
  console.log('  Measuring JSONL vs Database timestamp gap');
  console.log('  Target: Healthy (<3s), Acceptable (3-10s)');
  console.log('');
  
  try {
    // Get database stats
    const dbStats = getDatabaseStats();
    if (!dbStats) {
      console.log('✗ Database not accessible');
      console.log('  Start sync daemon: npm run dev:sync');
      return 1;
    }
    
    console.log('Database Status:');
    console.log(`  Messages: ${dbStats.messages.toLocaleString()}`);
    console.log(`  Sessions: ${dbStats.sessions.toLocaleString()}`);
    console.log(`  Size: ${(dbStats.fileSize / 1024 / 1024).toFixed(1)} MB`);
    console.log('');
    
    // Get latest timestamps
    console.log('Scanning timestamps...');
    const jsonlResult = getLatestJsonlTimestamp();
    const dbTimestamp = getLatestDatabaseTimestamp();
    
    console.log(`  Latest JSONL: ${jsonlResult.timestamp ? jsonlResult.timestamp.toISOString() : 'None'}`);
    if (jsonlResult.file) {
      console.log(`    File: ${jsonlResult.file}`);
    }
    
    console.log(`  Latest DB: ${dbTimestamp ? dbTimestamp.toISOString() : 'None'}`);
    console.log('');
    
    // Calculate lag
    const lagSeconds = calculateSyncLag(jsonlResult.timestamp, dbTimestamp);
    const status = classifySyncStatus(lagSeconds);
    
    // Results
    console.log('='.repeat(50));
    console.log('Sync Latency Analysis:');
    console.log('='.repeat(50));
    
    if (lagSeconds < 0) {
      console.log('Status: MISSING DATA ✗');
      if (!jsonlResult.timestamp) {
        console.log('  Issue: No JSONL files found with timestamps');
        console.log('  Solution: Use Claude Code to create conversations');
      }
      if (!dbTimestamp) {
        console.log('  Issue: No messages in database');
        console.log('  Solution: Start sync daemon to process files');
      }
      return 1;
    }
    
    console.log(`Sync Lag: ${lagSeconds.toFixed(1)} seconds`);
    
    switch (status) {
      case 'healthy':
        console.log('Status: HEALTHY ✓');
        console.log('  Sync is working well (<3s lag)');
        break;
      case 'delayed':
        console.log('Status: DELAYED ⚠');
        console.log('  Sync is working but slow (3-10s lag)');
        break;
      case 'stale':
        console.log('Status: STALE ✗');
        console.log('  Sync is not keeping up (>10s lag)');
        console.log('  Check: sync daemon logs for errors');
        break;
    }
    
    console.log('');
    
    // Additional analysis
    if (lagSeconds > 60) {
      console.log('⚠ Large gap detected (>1 minute)');
      console.log('  Possible causes:');
      console.log('    - Sync daemon stopped or crashed');
      console.log('    - Database lock or corruption');
      console.log('    - File system issues');
    } else if (lagSeconds > 30) {
      console.log('⚠ Moderate gap detected (>30 seconds)');
      console.log('  Possible causes:');
      console.log('    - High system load');
      console.log('    - Large backlog processing');
      console.log('    - Database performance issues');
    }
    
    // Performance recommendations
    if (status === 'stale' || lagSeconds > 30) {
      console.log('');
      console.log('Recommendations:');
      console.log('  1. Restart sync daemon: npm run stop && npm start');
      console.log('  2. Check system resources (CPU, disk I/O)');
      console.log('  3. Review sync daemon logs for errors');
      console.log('  4. Consider optimizing database indexes');
    }
    
    // Return appropriate exit code
    return status === 'healthy' ? 0 : (status === 'delayed' ? 1 : 2);
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    return 3;
  }
}

// Run test if called directly
if (require.main === module) {
  testSyncLatency().then(process.exit);
}

module.exports = testSyncLatency;