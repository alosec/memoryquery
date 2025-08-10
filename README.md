# MemoryQuery

**SQL-powered session-based memory for Claude Code**

Provides unlimited SQL access to your Claude Code conversation history via MCP protocol. Query your development patterns, analyze project evolution, and maintain persistent memory across sessions.

## ⚡ Quick Start

### Option 1: Build from Source (Recommended)
```bash
# Clone and build
git clone https://github.com/alosec/memoryquery.git
cd memoryquery
npm install
npm run build

# Register with Claude Code
claude mcp add-json --scope user memoryquery '{
  "command": "node",
  "args": ["'$(pwd)'/dist/mcp-server/index.js"],
  "env": {
    "MEMQ_DB_PATH": "'$HOME'/.local/share/memoryquery/mcp.db"
  }
}'

# Start sync daemon
node dist/cli/index.js start
```

### Option 2: Install Script (Experimental)
```bash
curl -sSL https://raw.githubusercontent.com/alosec/memoryquery/main/install.sh | bash
```
*Note: Requires Node.js >=18, may timeout on resource-constrained systems*

## 🎯 What You Get

- **`query_memory` MCP tool** - Direct SQL access to all conversation history
- **Cross-session memory** - Remember context between Claude Code sessions  
- **Development intelligence** - Analyze your coding patterns and project evolution
- **Real-time sync** - Conversations automatically synced to searchable database

## 🔍 Example Queries

Ask Claude to run these SQL queries via the `query_memory` tool:

```sql
-- Find recent conversations about a project
SELECT * FROM messages WHERE project_name LIKE '%memoryquery%' 
ORDER BY timestamp DESC LIMIT 10;

-- Analyze your most productive hours
SELECT strftime('%H', timestamp) as hour, COUNT(*) as messages
FROM messages WHERE type = 'user' 
GROUP BY hour ORDER BY messages DESC;

-- Find conversations with specific errors
SELECT timestamp, user_text FROM messages 
WHERE user_text LIKE '%error%' OR assistant_text LIKE '%error%'
ORDER BY timestamp DESC;
```

## 🔧 How This Works

MemoryQuery watches Claude Code's extensive JSON logs of all conversations and transforms them to SQLite:

1. **File Watcher** - Monitors Claude Code's JSONL conversation files in real-time from ~/.claude/projects/
2. **Sync Daemon** - Parses new projects, sessions, messages, tool uses and stores them in SQLite database at ~/.local/share/memoryquery/mcp.db
3. **MCP Server** - Provides `query_memory` tool for direct SQL access to conversation history, providing a sanitized SELECT * function for Claude to agentically query conversation dataq
4. **Cross-Session Memory** - Remember context and decisions between Claude Code sessions "Hey Claude, what did we do yesterday?"

## 🏗️ Architecture

```
Claude Code ──┐
              │
   JSONL ──►  Sync Daemon  ──► SQLite DB ──► MCP Server ──► Claude Code
              │                    │              │
              └─ File Watcher      └─ SQL Queries └─ Memory Tools
```

## 📊 Database Schema

- **`messages`** - All user/assistant messages with timestamps
- **`sessions`** - Conversation sessions and project paths  
- **`tool_uses`** - Tool invocations and parameters
- **`tool_use_results`** - Tool outputs and results
- **`attachments`** - File attachments and content
- **`env_info`** - Environment context per message

## ⚙️ Management

If building from source, navigate to /path/to/memoryquery/ and run the 'npm' scripts there. If the installer is working for you, then you should have access to the CLI via 'memoryquery':

```bash
# Check system status
memoryquery status

# Start/stop services  
memoryquery start
memoryquery stop

# View service logs
memoryquery logs
```

## 🛠️ System Requirements

- **Node.js** >=18.0.0
- **Claude Code CLI** installed and configured
- **~50-100MB** disk space for database
- **Linux/macOS** (Windows untested)

## 🚨 Current Limitations

- **Resource intensive build** - Install script may fail on systems with <2GB RAM
- **Build from source recommended** - More reliable than experimental installer
- **Single tool support** - Only Claude Code currently supported
- **Beta software** - Expect occasional issues and breaking changes

## 📈 Roadmap

- [ ] **Optimize install script** - Reduce memory usage and improve reliability on resource-constrained systems
- [ ] **NPM package** - Publish to npm registry for `npm install -g memoryquery` installation
- [ ] **Multi-tool support** - Cline, Claude Desktop integration
- [ ] **Windows support** - Cross-platform compatibility

## 🤝 Contributing

This is beta software. If you encounter issues:

1. **Try build from source** before reporting installer problems
2. **Include system specs** (RAM, Node.js version, OS) in bug reports  
3. **Check existing issues** before creating new ones

## 📄 License

MIT - Use freely in personal and commercial projects.

---

**Memory Query**: Transform Claude Code from stateless conversations to persistent, queryable knowledge base with unlimited SQL access to your development history.
