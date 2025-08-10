/**
 * Project path mapping utilities for converting between different path formats
 * Handles conversion between real filesystem paths, encoded Claude Code directory names, and simple project names
 */

export class ProjectPathMapper {
  /**
   * Convert real filesystem path to Claude Code encoded directory name
   * Example: /path/to/memory-sql-mcp → path-to-memory-sql-mcp
   */
  static realPathToEncoded(realPath: string): string {
    if (!realPath || typeof realPath !== 'string') {
      return '';
    }
    
    // Remove leading slash and replace remaining slashes with dashes
    return realPath.replace(/^\//, '').replace(/\//g, '-');
  }

  /**
   * Convert Claude Code encoded directory name to real filesystem path
   * Example: path-to-memory-sql-mcp → /path/to/memory-sql-mcp
   */
  static encodedToRealPath(encodedPath: string): string {
    if (!encodedPath || typeof encodedPath !== 'string') {
      return '';
    }
    
    // Add leading slash and replace dashes with slashes
    return '/' + encodedPath.replace(/-/g, '/');
  }

  /**
   * Extract simple project name from any path format
   * Works with encoded paths, real paths, or already simple names
   */
  static extractSimpleName(path: string): string {
    if (!path || typeof path !== 'string') {
      return '';
    }
    
    // If it looks like an encoded path, extract the last segment
    if (path.startsWith('-') && path.includes('-')) {
      const parts = path.split('-');
      return parts[parts.length - 1];
    }
    
    // If it looks like a real path, extract the last segment
    if (path.includes('/')) {
      const parts = path.split('/');
      return parts[parts.length - 1];
    }
    
    // Already a simple name
    return path;
  }

  /**
   * Detect the format of the input project path
   */
  static detectPathFormat(input: string): 'encoded' | 'real' | 'simple' {
    if (!input || typeof input !== 'string') {
      return 'simple';
    }
    
    // Encoded format: starts with dash and contains multiple dashes
    if (input.startsWith('-') && input.split('-').length > 2) {
      return 'encoded';
    }
    
    // Real path format: starts with slash or contains slashes
    if (input.startsWith('/') || input.includes('/')) {
      return 'real';
    }
    
    // Simple name format
    return 'simple';
  }

  /**
   * Normalize project path input to support multiple formats
   * Returns the best format for database querying based on input
   */
  static normalizeProjectPath(input: string): {
    encoded: string;
    real: string;
    simple: string;
    format: 'encoded' | 'real' | 'simple';
    queryPattern: string;
  } {
    if (!input || typeof input !== 'string') {
      return {
        encoded: '',
        real: '',
        simple: '',
        format: 'simple',
        queryPattern: ''
      };
    }

    const format = this.detectPathFormat(input);
    let encoded = '';
    let real = '';
    let simple = '';

    switch (format) {
      case 'encoded':
        encoded = input;
        real = this.encodedToRealPath(input);
        simple = this.extractSimpleName(input);
        break;
      
      case 'real':
        real = input;
        encoded = this.realPathToEncoded(input);
        simple = this.extractSimpleName(input);
        break;
      
      case 'simple':
        simple = input;
        // For simple names, we'll use partial matching since we don't know the full path
        encoded = '';
        real = '';
        break;
    }

    // Create query pattern based on the most specific available format
    let queryPattern = '';
    if (encoded) {
      queryPattern = encoded; // Exact match for encoded paths
    } else if (simple) {
      queryPattern = `%${simple}%`; // Partial match for simple names
    }

    return {
      encoded,
      real,
      simple,
      format,
      queryPattern
    };
  }

  /**
   * Create appropriate SQL WHERE clause for project path filtering
   */
  static buildProjectPathFilter(projectPath: string): {
    whereClause: string;
    params: string[];
  } {
    if (!projectPath) {
      return {
        whereClause: '',
        params: []
      };
    }

    const normalized = this.normalizeProjectPath(projectPath);
    
    if (!normalized.queryPattern) {
      return {
        whereClause: '',
        params: []
      };
    }

    // For encoded paths, use exact matching
    if (normalized.format === 'encoded') {
      return {
        whereClause: 'AND s.path = ?',
        params: [normalized.encoded]
      };
    }

    // For simple names and real paths converted to encoded, use LIKE matching
    return {
      whereClause: 'AND s.path LIKE ?',
      params: [normalized.queryPattern]
    };
  }
}