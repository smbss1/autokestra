import { Database } from 'bun:sqlite';

export interface LogEntry {
  executionId: string;
  taskId?: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, any>;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogCollectorConfig {
  db: Database;
  maxBufferSize?: number; // Default: 100
  flushIntervalMs?: number; // Default: 1000
}

export class LogCollector {
  private db: Database;
  private buffer: LogEntry[] = [];
  private maxBufferSize: number;
  private flushIntervalMs: number;
  private flushTimer?: Timer;
  private isFlushing = false;

  constructor(config: LogCollectorConfig) {
    this.db = config.db;
    this.maxBufferSize = config.maxBufferSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 1000;

    this.startFlushTimer();
  }

  /**
   * Log a structured log entry
   */
  log(entry: LogEntry): void {
    this.buffer.push(entry);

    if (this.buffer.length >= this.maxBufferSize) {
      console.warn(`Log buffer overflow: flushing ${this.buffer.length} entries early`);
      this.flush();
    }
  }

  /**
   * Flush buffered logs to database
   */
  flush(): void {
    if (this.buffer.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const entriesToFlush = [...this.buffer];
    this.buffer = [];

    try {
      this.db.transaction(() => {
        const stmt = this.db.prepare(`
          INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const executionCounts = new Map<string, number>();

        for (const entry of entriesToFlush) {
          stmt.run(
            entry.executionId,
            entry.taskId || null,
            entry.timestamp,
            entry.level,
            entry.source,
            entry.message,
            entry.metadata ? JSON.stringify(entry.metadata) : null
          );

          executionCounts.set(
            entry.executionId,
            (executionCounts.get(entry.executionId) || 0) + 1
          );
        }

        if (executionCounts.size > 0) {
          const updateStmt = this.db.prepare(`
            UPDATE executions
            SET log_entry_count = COALESCE(log_entry_count, 0) + ?
            WHERE execution_id = ?
          `);

          for (const [executionId, count] of executionCounts.entries()) {
            updateStmt.run(count, executionId);
          }
        }
      })();
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Put entries back in buffer for retry
      this.buffer.unshift(...entriesToFlush);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Flush all buffered logs (called on execution completion)
   */
  flushAll(): void {
    this.flush();
  }

  /**
   * Close the collector and flush any remaining logs
   */
  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flushAll();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }
}