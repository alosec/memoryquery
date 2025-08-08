/**
 * Database connection management for Claude Code memory
 */

const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

export class DatabaseConnection {
  private db: any;
  private dbAll: (sql: string, params?: any[]) => Promise<any[]>;
  private dbGet: (sql: string, params?: any[]) => Promise<any>;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
  }

  /**
   * Execute a SELECT query that returns multiple rows
   */
  async all(sql: string, params?: any[]): Promise<any[]> {
    return await this.dbAll(sql, params);
  }

  /**
   * Execute a SELECT query that returns a single row
   */
  async get(sql: string, params?: any[]): Promise<any> {
    return await this.dbGet(sql, params);
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Create and return a database connection instance
 */
export function createDatabaseConnection(dbPath: string): DatabaseConnection {
  return new DatabaseConnection(dbPath);
}