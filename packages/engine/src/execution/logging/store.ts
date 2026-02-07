import { Database } from 'bun:sqlite';

export interface LogQueryFilters {
  level?: string[]; // Array of log levels to include
  since?: number; // Duration in milliseconds to look back
  taskId?: string; // Filter by specific task
  source?: string; // Filter by log source
}

export interface LogQueryOptions {
  limit?: number; // Default: 1000
  offset?: number; // For pagination
  streaming?: boolean; // For follow mode
}

export interface LogEntry {
  id: number;
  executionId: string;
  taskId?: string;
  timestamp: number;
  level: string;
  source: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface AuditEvent {
  id: number;
  executionId: string;
  eventType: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface LogStoreConfig {
  db: Database;
}

export class LogStore {
  private db: Database;

  constructor(config: LogStoreConfig) {
    this.db = config.db;
  }

  /**
   * Get logs for a specific execution
   */
  getLogsByExecution(
    executionId: string,
    filters: LogQueryFilters = {},
    options: LogQueryOptions = {}
  ): LogEntry[] {
    const limit = options.limit || 1000;
    const offset = options.offset || 0;

    let query = `
      SELECT id, execution_id, task_id, timestamp, level, source, message, metadata
      FROM execution_logs
      WHERE execution_id = ?
    `;
    const params: any[] = [executionId];

    // Add filters
    if (filters.level && filters.level.length > 0) {
      const placeholders = filters.level.map(() => '?').join(',');
      query += ` AND level IN (${placeholders})`;
      params.push(...filters.level);
    }

    if (filters.since) {
      const sinceTimestamp = Date.now() - filters.since;
      query += ` AND timestamp >= ?`;
      params.push(sinceTimestamp);
    }

    if (filters.taskId) {
      query += ` AND task_id = ?`;
      params.push(filters.taskId);
    }

    if (filters.source) {
      query += ` AND source = ?`;
      params.push(filters.source);
    }

    query += ` ORDER BY timestamp ASC, id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      timestamp: row.timestamp,
      level: row.level,
      source: row.source,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Get logs for a specific task
   */
  getLogsByTask(
    taskId: string,
    filters: LogQueryFilters = {},
    options: LogQueryOptions = {}
  ): LogEntry[] {
    const limit = options.limit || 1000;
    const offset = options.offset || 0;

    let query = `
      SELECT id, execution_id, task_id, timestamp, level, source, message, metadata
      FROM execution_logs
      WHERE task_id = ?
    `;
    const params: any[] = [taskId];

    // Add filters
    if (filters.level && filters.level.length > 0) {
      const placeholders = filters.level.map(() => '?').join(',');
      query += ` AND level IN (${placeholders})`;
      params.push(...filters.level);
    }

    if (filters.since) {
      const sinceTimestamp = Date.now() - filters.since;
      query += ` AND timestamp >= ?`;
      params.push(sinceTimestamp);
    }

    if (filters.source) {
      query += ` AND source = ?`;
      params.push(filters.source);
    }

    query += ` ORDER BY timestamp ASC, id ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      executionId: row.execution_id,
      taskId: row.task_id,
      timestamp: row.timestamp,
      level: row.level,
      source: row.source,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  /**
   * Stream logs for real-time following
   */
  async *streamLogsByExecution(
    executionId: string,
    filters: LogQueryFilters = {},
    pollIntervalMs: number = 100
  ): AsyncGenerator<LogEntry> {
    let lastTimestamp = filters.since ? Date.now() - filters.since : 0;
    let lastId = 0;

    while (true) {
      let query = `
        SELECT id, execution_id, task_id, timestamp, level, source, message, metadata
        FROM execution_logs
        WHERE execution_id = ?
          AND (timestamp > ? OR (timestamp = ? AND id > ?))
      `;
      const params: any[] = [executionId, lastTimestamp, lastTimestamp, lastId];

      if (filters.level && filters.level.length > 0) {
        const placeholders = filters.level.map(() => '?').join(',');
        query += ` AND level IN (${placeholders})`;
        params.push(...filters.level);
      }

      if (filters.taskId) {
        query += ` AND task_id = ?`;
        params.push(filters.taskId);
      }

      if (filters.source) {
        query += ` AND source = ?`;
        params.push(filters.source);
      }

      query += ` ORDER BY timestamp ASC, id ASC LIMIT 1000`;

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      const logs = rows.map(row => ({
        id: row.id,
        executionId: row.execution_id,
        taskId: row.task_id,
        timestamp: row.timestamp,
        level: row.level,
        source: row.source,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

      for (const log of logs) {
        yield log;
        lastTimestamp = log.timestamp;
        lastId = log.id;
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Get audit trail for an execution
   */
  getAuditTrail(executionId: string): AuditEvent[] {
    const stmt = this.db.prepare(`
      SELECT id, execution_id, event_type, timestamp, metadata
      FROM execution_audit_events
      WHERE execution_id = ?
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(executionId) as any[];

    return rows.map(row => ({
      id: row.id,
      executionId: row.execution_id,
      eventType: row.event_type,
      timestamp: row.timestamp,
      metadata: JSON.parse(row.metadata),
    }));
  }
}