/**
 * Error handling utilities for Claude Code memory server
 */

export interface ErrorResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError: boolean;
}

/**
 * Create a standardized error response for MCP tools
 */
export function createErrorResponse(error: unknown): ErrorResponse {
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    content: [{
      type: 'text',
      text: `Error: ${message}`
    }],
    isError: true
  };
}

/**
 * Create an error handler function that returns MCP-compatible error responses
 */
export function createErrorHandler(): (error: unknown) => ErrorResponse {
  return (error: unknown) => createErrorResponse(error);
}

/**
 * Wrap a function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorHandler: (error: unknown) => any = createErrorHandler()
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorHandler(error);
    }
  }) as T;
}