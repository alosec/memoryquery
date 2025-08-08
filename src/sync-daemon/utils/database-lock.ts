/**
 * Database mutex utilities for coordinating writes between sync daemon and MCP server
 * Adapted from cafe-db-sync mutex patterns
 */

export class DatabaseMutex {
  private writeLock: Promise<void> = Promise.resolve();
  private sessionLocks: Map<string, Promise<void>> = new Map();

  /**
   * Execute operation with exclusive database write lock
   */
  async withDatabaseWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    // Chain onto existing lock to ensure sequential execution
    const currentLock = this.writeLock;
    
    let resolveLock!: () => void;
    this.writeLock = new Promise(resolve => {
      resolveLock = resolve;
    });

    try {
      // Wait for previous operations to complete
      await currentLock;
      
      // Execute the operation
      const result = await operation();
      return result;
    } finally {
      // Release the lock
      resolveLock();
    }
  }

  /**
   * Execute operation with session-specific lock
   */
  async withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const currentSessionLock = this.sessionLocks.get(sessionId) || Promise.resolve();
    
    let resolveSessionLock!: () => void;
    const newSessionLock = new Promise<void>(resolve => {
      resolveSessionLock = resolve;
    });
    
    this.sessionLocks.set(sessionId, newSessionLock);

    try {
      // Wait for previous session operations to complete
      await currentSessionLock;
      
      // Execute the operation
      const result = await operation();
      return result;
    } finally {
      // Release the session lock
      resolveSessionLock();
      
      // Clean up completed locks
      if (this.sessionLocks.get(sessionId) === newSessionLock) {
        this.sessionLocks.delete(sessionId);
      }
    }
  }

  /**
   * Check if database write is currently locked
   */
  isDatabaseWriteLocked(): boolean {
    return this.writeLock !== Promise.resolve();
  }

  /**
   * Get count of active session locks
   */
  getActiveLockCount(): number {
    return this.sessionLocks.size;
  }

  /**
   * Get list of locked session IDs
   */
  getLockedSessions(): string[] {
    return Array.from(this.sessionLocks.keys());
  }

  /**
   * Clear all locks (for testing/cleanup)
   */
  clearAllLocks(): void {
    this.writeLock = Promise.resolve();
    this.sessionLocks.clear();
  }
}

// Singleton instance for coordination across the application
export const databaseMutex = new DatabaseMutex();

/**
 * Convenience function for database write operations
 */
export function withDatabaseWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  return databaseMutex.withDatabaseWriteLock(operation);
}

/**
 * Convenience function for session-specific operations
 */
export function withSessionLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
  return databaseMutex.withSessionLock(sessionId, operation);
}