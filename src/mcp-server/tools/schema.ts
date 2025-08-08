/**
 * MCP tool schema definitions for Claude Code memory server
 */

export const TOOL_SCHEMAS = [
  {
    name: 'get_database_schema',
    description: 'Get the raw SQLite schema for Claude Code conversation database',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_session_messages',
    description: 'Get full conversation thread for specific sessions (use get_session_list first to find session IDs)',
    inputSchema: {
      type: 'object',
      properties: {
        session_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of session IDs to retrieve'
        },
        limit: {
          type: 'number',
          description: 'Number of messages to return (default: 100)',
          default: 100
        },
        cursor: {
          type: 'string',
          description: 'Optional: cursor for pagination (base64 encoded timestamp)'
        },
        direction: {
          type: 'string',
          enum: ['before', 'after'],
          description: 'Navigate before or after cursor (default: before)',
          default: 'before'
        }
      },
      required: ['session_ids']
    }
  },
  {
    name: 'find_string_in_history',
    description: 'Search for strings across conversation history',
    inputSchema: {
      type: 'object',
      properties: {
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of search strings (AND logic)'
        },
        session_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: limit search to specific sessions'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
          default: 10
        },
        cursor: {
          type: 'string',
          description: 'Optional: cursor for pagination (base64 encoded timestamp)'
        },
        direction: {
          type: 'string',
          enum: ['before', 'after'],
          description: 'Navigate before or after cursor (default: before)',
          default: 'before'
        }
      },
      required: ['queries']
    }
  },
  {
    name: 'get_session_list',
    description: 'STEP 1: List conversation sessions to get session IDs. Use session IDs with get_session_messages to retrieve full conversation threads',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: {
          type: 'string',
          description: 'Optional: filter sessions by project path'
        },
        limit: {
          type: 'number',
          description: 'Maximum sessions to return (default: 10)',
          default: 10
        },
        cursor: {
          type: 'string',
          description: 'Optional: cursor for pagination (base64 encoded timestamp)'
        },
        direction: {
          type: 'string',
          enum: ['before', 'after'],
          description: 'Navigate before or after cursor (default: before)',
          default: 'before'
        }
      },
      required: []
    }
  },
  {
    name: 'get_tool_usage_history', 
    description: 'Get history of tool usage with parameters and results',
    inputSchema: {
      type: 'object',
      properties: {
        tool_names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: filter by specific tool names'
        },
        session_ids: {
          type: 'array', 
          items: { type: 'string' },
          description: 'Optional: filter by specific sessions'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 5)',
          default: 5
        },
        cursor: {
          type: 'string',
          description: 'Optional: cursor for pagination (base64 encoded timestamp)'
        },
        direction: {
          type: 'string',
          enum: ['before', 'after'],
          description: 'Navigate before or after cursor (default: before)',
          default: 'before'
        }
      },
      required: []
    }
  },
  {
    name: 'get_file_history',
    description: 'Get history of file operations (Read, Write, Edit, MultiEdit)',
    inputSchema: {
      type: 'object',
      properties: {
        file_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: filter by file paths (partial match)'
        },
        session_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: filter by specific sessions'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 5)', 
          default: 5
        },
        cursor: {
          type: 'string',
          description: 'Optional: cursor for pagination (base64 encoded timestamp)'
        },
        direction: {
          type: 'string',
          enum: ['before', 'after'],
          description: 'Navigate before or after cursor (default: before)',
          default: 'before'
        }
      },
      required: []
    }
  },
  {
    name: 'get_recent_messages',
    description: 'Get recent messages across all projects or filtered by project with cursor pagination',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of messages to return (default: 10)',
          default: 10
        },
        cursor: {
          type: 'string',
          description: 'Optional: cursor for pagination (base64 encoded timestamp)'
        },
        direction: {
          type: 'string',
          enum: ['before', 'after'],
          description: 'Navigate before or after cursor (default: before)',
          default: 'before'
        },
        project_path: {
          type: 'string',
          description: 'Optional: filter by project path'
        },
        message_types: {
          type: 'array',
          items: { 
            type: 'string',
            enum: ['user', 'assistant', 'summary']
          },
          description: 'Optional: filter by message types'
        },
        include_tool_use: {
          type: 'boolean',
          description: 'Include tool usage data (default: true)',
          default: true
        }
      },
      required: []
    }
  },
  {
    name: 'get_recent_messages_by_project',
    description: 'Get recent messages for a specific project (simple version)',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: {
          type: 'string',
          description: 'Project path to filter by'
        },
        limit: {
          type: 'number',
          description: 'Number of messages to return (default: 10)',
          default: 10
        }
      },
      required: ['project_path']
    }
  }
] as const;