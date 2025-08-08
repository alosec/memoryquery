#!/usr/bin/env node

/**
 * Test MCP tools return correct data
 */

const { spawn } = require('child_process');
const path = require('path');
const { readResponse, sleep } = require('./utils');

async function testMCPQuery() {
  console.log('TEST: MCP Tool Queries');
  
  let exitCode = 0;
  let mcp = null;
  
  try {
    // Start MCP server
    const mcpPath = path.join(__dirname, '..', 'dist', 'mcp-server', 'index.js');
    console.log('  Starting MCP server...');
    
    mcp = spawn('node', [mcpPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env
    });
    
    // Wait for server to initialize
    await sleep(2000);
    
    // Test 1: get_recent_conversations
    console.log('\n  Testing get_recent_conversations...');
    const request1 = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'get_recent_conversations',
        arguments: { limit: 5 }
      }
    };
    
    mcp.stdin.write(JSON.stringify(request1) + '\n');
    
    try {
      const response1 = await readResponse(mcp.stdout, 3000);
      
      if (response1.result && Array.isArray(response1.result.content)) {
        console.log(`✓ Retrieved conversations (found ${response1.result.content.length})`);
      } else if (response1.result) {
        console.log('✓ Tool responded (no conversations yet)');
      } else if (response1.error) {
        console.log('✗ Tool returned error:', response1.error.message);
        exitCode = 1;
      }
    } catch (e) {
      console.log('✗ Failed to get response:', e.message);
      exitCode = 1;
    }
    
    // Test 2: search_conversations
    console.log('\n  Testing search_conversations...');
    const request2 = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'search_conversations',
        arguments: { 
          query: 'test',
          limit: 10
        }
      }
    };
    
    mcp.stdin.write(JSON.stringify(request2) + '\n');
    
    try {
      const response2 = await readResponse(mcp.stdout, 3000);
      
      if (response2.result) {
        console.log('✓ Search tool responded');
      } else if (response2.error) {
        console.log('✗ Search returned error:', response2.error.message);
        exitCode = 1;
      }
    } catch (e) {
      console.log('✗ Failed to search:', e.message);
      exitCode = 1;
    }
    
    // Test 3: get_conversation_statistics
    console.log('\n  Testing get_conversation_statistics...');
    const request3 = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_conversation_statistics',
        arguments: {}
      }
    };
    
    mcp.stdin.write(JSON.stringify(request3) + '\n');
    
    try {
      const response3 = await readResponse(mcp.stdout, 3000);
      
      if (response3.result) {
        console.log('✓ Statistics tool responded');
      } else if (response3.error) {
        console.log('✗ Statistics returned error:', response3.error.message);
        exitCode = 1;
      }
    } catch (e) {
      console.log('✗ Failed to get statistics:', e.message);
      exitCode = 1;
    }
    
  } catch (error) {
    console.log('✗ Test failed with error:', error.message);
    exitCode = 1;
  } finally {
    // Clean up MCP server
    if (mcp) {
      mcp.kill('SIGTERM');
      await sleep(500);
      if (!mcp.killed) {
        mcp.kill('SIGKILL');
      }
    }
  }
  
  return exitCode;
}

// Run test if called directly
if (require.main === module) {
  testMCPQuery().then(process.exit);
}

module.exports = testMCPQuery;
