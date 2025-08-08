const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get a test JSONL file path
 */
function getTestFile() {
  const dir = path.join(os.homedir(), '.claude/projects/test');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `test-${Date.now()}.jsonl`);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean up all test files
 */
function cleanupTestFiles() {
  const dir = path.join(os.homedir(), '.claude/projects/test');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

/**
 * Get the database path from environment or default
 */
function getDbPath() {
  return process.env.SIMPLE_MEMORY_DB_PATH || 
    path.join(os.homedir(), '.local/share/simple-memory/mcp.db');
}

/**
 * Generate a test message
 */
function generateMessage(id, options = {}) {
  return {
    id: id || `msg-${Date.now()}`,
    type: 'message',
    timestamp: new Date().toISOString(),
    user_text: options.userText || 'Test user message',
    assistant_text: options.assistantText || 'Test assistant response',
    project_name: options.projectName || 'test',
    ...options.extra
  };
}

/**
 * Read response from a stream with timeout
 */
async function readResponse(stream, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let data = '';
    const timer = setTimeout(() => {
      reject(new Error('Response timeout'));
    }, timeout);
    
    stream.on('data', chunk => {
      data += chunk.toString();
      if (data.includes('\n')) {
        clearTimeout(timer);
        try {
          const lines = data.trim().split('\n');
          const response = JSON.parse(lines[0]);
          resolve(response);
        } catch (e) {
          reject(e);
        }
      }
    });
    
    stream.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

module.exports = {
  getTestFile,
  sleep,
  cleanupTestFiles,
  getDbPath,
  generateMessage,
  readResponse
};
