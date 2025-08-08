#!/usr/bin/env node

/**
 * Simple status check - reports sync daemon and MCP server status
 * WITHOUT triggering massive log generation
 */

const fs = require('fs');
const { exec } = require('child_process');
const { getDatabaseStats, validateSyncDaemonRunning, findRealConversations } = require('./real-utils');

async function checkStatus() {
  console.log('Simple Memory MCP - Status Check');
  console.log('=' + '='.repeat(40));
  
  try {
    // 1. Check database
    const dbStats = getDatabaseStats();
    
    if (dbStats) {
      console.log('Database: CONNECTED');
      console.log(`  Messages: ${dbStats.messages}`);
      console.log(`  Sessions: ${dbStats.sessions}`);
      console.log(`  Size: ${(dbStats.fileSize / 1024 / 1024).toFixed(1)} MB`);
    } else {
      console.log('Database: NOT FOUND');
      console.log('  Path: ~/.local/share/simple-memory/mcp.db');
    }
    
    // 2. Check conversation files
    const conversations = findRealConversations();
    console.log(`\nConversation Files: ${conversations.length} found`);
    if (conversations.length > 0) {
      console.log(`  Most recent: ${conversations[0].name}`);
      console.log(`  Modified: ${conversations[0].modified.toLocaleString()}`);
    }
    
    // 3. Check sync daemon (without triggering sync)
    console.log('\nSync Daemon: CHECKING...');
    const syncStatus = await validateSyncDaemonRunning();
    
    if (syncStatus.running) {
      console.log('Sync Daemon: RUNNING ✓');
      if (syncStatus.messagesChanged) {
        console.log(`  Activity: ${syncStatus.messagesChanged} messages processed`);
      }
    } else {
      console.log('Sync Daemon: NOT RUNNING');
      console.log(`  Reason: ${syncStatus.reason}`);
      console.log('  Start with: npm run dev:sync');
    }
    
    // 4. Check processes (simple)
    console.log('\nProcess Check:');
    
    // Check for node processes related to our services
    const checkProcess = (pattern) => {
      return new Promise((resolve) => {
        exec(`ps aux | grep -v grep | grep "${pattern}"`, (error, stdout) => {
          resolve(stdout.trim().length > 0);
        });
      });
    };
    
    const syncRunning = await checkProcess('sync-daemon');
    const mcpRunning = await checkProcess('mcp-server');
    
    console.log(`  Sync daemon process: ${syncRunning ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`  MCP server process: ${mcpRunning ? 'FOUND' : 'NOT FOUND'}`);
    
    // 5. Quick health summary
    console.log('\n' + '='.repeat(41));
    const healthy = dbStats && syncStatus.running;
    console.log(`Overall Health: ${healthy ? 'HEALTHY ✓' : 'NEEDS ATTENTION ✗'}`);
    
    if (!healthy) {
      console.log('\nTo fix:');
      if (!dbStats) {
        console.log('  1. Build project: npm run build');
        console.log('  2. Start sync daemon: npm run dev:sync');
      } else if (!syncStatus.running) {
        console.log('  1. Start sync daemon: npm run dev:sync');
      }
    }
    
    return healthy ? 0 : 1;
    
  } catch (error) {
    console.log('Error checking status:', error.message);
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  checkStatus().then(process.exit);
}

module.exports = checkStatus;
