/**
 * MCP tool schema definitions for Claude Code memory server
 */

export const TOOL_SCHEMAS = [
  {
    name: 'query_memory',
    description: 'Query your conversation memory using SQL. Access past Claude Code chat sessions, messages, and context. Use SELECT statements to recall conversations, search topics, analyze patterns across our chat history.\n\nAvailable tables:\n- sessions: id, path, created_at, last_activity_at\n- messages: id, session_id, type, timestamp, user_text, assistant_text, project_name\n- tool_uses: id, message_id, tool_name, parameters\n- tool_use_results: id, tool_use_id, output, error\n- attachments: id, message_id, filename, content\n- env_info: id, message_id, working_dir, git_branch, platform\n\nExample queries:\n- Recent conversations: SELECT * FROM messages WHERE timestamp > datetime(\'now\', \'-7 days\') ORDER BY timestamp DESC\n- Search topics: SELECT m.*, s.path FROM messages m JOIN sessions s ON m.session_id = s.id WHERE m.user_text LIKE \'%vim%\' OR m.assistant_text LIKE \'%vim%\'\n- Project activity: SELECT s.path, COUNT(*) as msg_count FROM sessions s JOIN messages m ON s.id = m.session_id GROUP BY s.path',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SELECT query to execute against conversation database. Only SELECT statements are allowed for safety.'
        },
        limit: {
          type: 'number',
          description: 'Maximum rows to return (default: 100, max: 1000)',
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: ['sql']
    }
  }
] as const;