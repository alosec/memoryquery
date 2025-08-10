# MemoryQuery - Project Brief

## Purpose
A unified package that provides seamless access to Claude Code conversation history through MCP protocol integration. The **primary focus is the MCP server** - a production-ready tool for conversation history access with SQL query capabilities. The sync daemon serves as a **supporting component** to ensure the MCP server has real-time access to current conversation data.

## Strategic Focus
**MCP Server as Core Product**: The conversation history access tools are the main deliverable. The sync daemon exists solely to support MCP functionality by maintaining fresh data access - not as a general-purpose sync system.

## Core Requirements
- **Single Install**: One command sets up everything automatically
- **MCP Server Integration**: Full suite of conversation history tools for Claude Code
- **Real-Time Sync**: Automatic JSONL file monitoring and database synchronization
- **Clean Architecture**: Well-organized codebase without technical debt from previous iterations
- **Zero-Configuration**: Install script handles all setup including MCP registration
- **Service Management**: Built-in CLI for starting/stopping/monitoring services

## Architecture Philosophy
**Clean Slate Approach**: Rather than refactoring existing repositories with technical debt, this project is designed from scratch:

### Unified Components
1. **MCP Server** (`src/mcp-server/`): Database queries and conversation access tools
2. **Sync Daemon** (`src/sync-daemon/`): Real-time JSONL file monitoring and SQLite updates  
3. **Management CLI** (`src/cli/`): Service control and health monitoring
4. **Installation System** (`scripts/`): Install script with auto-configuration

## Success Criteria
1. **One-Command Install**: `curl -sSL install-url | bash` sets up everything
2. **Automatic Registration**: MCP server registers with Claude Code during install
3. **Service Coordination**: Sync daemon and MCP server work together seamlessly
4. **Good UX**: Clear status, error handling, and documentation
5. **Clean Codebase**: Maintainable architecture without legacy technical debt
6. **Cross-Platform**: Works on Linux, macOS with consistent behavior

## Scope Definition
**In Scope:**
- **Primary**: MCP tools for Claude Code conversation history (8 production-ready tools)
- **Supporting**: JSONL file synchronization to maintain data freshness for MCP server
- **Integration**: Installation and service management for unified MCP + sync system
- **Architecture**: Clean, maintainable codebase focused on MCP server reliability

**Explicitly Out of Scope:**
- General-purpose sync engines or complex pipeline systems
- Terminal UI frontends or additional consumer applications  
- Multi-database support beyond what MCP server requires
- Advanced analytics beyond what supports MCP tool functionality
- Sync capabilities beyond maintaining MCP server data freshness

## Key Differentiators from Previous Attempts
1. **Unified Package**: Designed as a single installable solution, not separate developer tools
2. **Clean Git History**: Fresh repository without inherited technical debt
3. **Focused Scope**: Claude Code memory tools only, no additional pipeline complexity
4. **Installation-First Design**: Built around the user install experience
5. **Service Integration**: MCP + sync designed to work together, not separate tools

This represents a complete reboot of the memory tools concept with clean architecture and user-focused design.