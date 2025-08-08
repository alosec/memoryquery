/**
 * Cursor utility functions for timestamp-based pagination
 */

export interface CursorData {
  timestamp: string;
  id?: string; // Optional unique identifier for tie-breaking
}

/**
 * Encode cursor data to base64 string
 */
export function encodeCursor(data: CursorData): string {
  const json = JSON.stringify(data);
  return Buffer.from(json, 'utf8').toString('base64');
}

/**
 * Decode base64 cursor string to cursor data
 */
export function decodeCursor(cursor: string): CursorData {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid cursor format: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create cursor from message data
 */
export function createMessageCursor(timestamp: string, id?: string): string {
  return encodeCursor({ timestamp, id });
}

/**
 * Build SQL conditions for cursor-based pagination
 */
export function buildCursorConditions(
  cursor?: string,
  direction: 'before' | 'after' = 'before',
  timestampField: string = 'm.timestamp',
  idField?: string
): { condition: string; params: any[] } {
  if (!cursor) {
    return { condition: '', params: [] };
  }

  const cursorData = decodeCursor(cursor);
  const operator = direction === 'before' ? '<' : '>';
  const tieBreaker = idField && cursorData.id 
    ? ` OR (${timestampField} = ? AND ${idField} ${operator} ?)`
    : '';

  return {
    condition: `AND (${timestampField} ${operator} ?${tieBreaker})`,
    params: tieBreaker 
      ? [cursorData.timestamp, cursorData.timestamp, cursorData.id]
      : [cursorData.timestamp]
  };
}

/**
 * Get ordering clause for cursor-based queries
 */
export function getCursorOrdering(
  direction: 'before' | 'after' = 'before',
  timestampField: string = 'm.timestamp',
  idField?: string
): string {
  const order = direction === 'before' ? 'DESC' : 'ASC';
  const secondaryOrder = idField ? `, ${idField} ${order}` : '';
  return `ORDER BY ${timestampField} ${order}${secondaryOrder}`;
}