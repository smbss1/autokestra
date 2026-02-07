import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { LogCollector, LogEntry, LogLevel } from './collector';

describe('LogCollector', () => {
  let db: Database;
  let collector: LogCollector;

  beforeEach(() => {
    db = new Database(':memory:');
    // Create the logs table
    db.exec(`
      CREATE TABLE execution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        task_id TEXT,
        timestamp INTEGER NOT NULL,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT
      )
    `);

    collector = new LogCollector({ db, maxBufferSize: 3, flushIntervalMs: 100 });
  });

  afterEach(() => {
    collector.close();
    db.close();
  });

  it('should buffer logs and flush when buffer is full', () => {
    const entries: LogEntry[] = [
      {
        executionId: 'exec-1',
        timestamp: Date.now(),
        level: LogLevel.INFO,
        source: 'test',
        message: 'Test message 1',
      },
      {
        executionId: 'exec-1',
        timestamp: Date.now(),
        level: LogLevel.DEBUG,
        source: 'test',
        message: 'Test message 2',
      },
      {
        executionId: 'exec-1',
        timestamp: Date.now(),
        level: LogLevel.WARN,
        source: 'test',
        message: 'Test message 3',
      },
    ];

    // Add entries (should trigger flush on 3rd)
    collector.log(entries[0]);
    collector.log(entries[1]);
    collector.log(entries[2]);

    // Check database
    const stmt = db.prepare('SELECT * FROM execution_logs ORDER BY id');
    const rows = stmt.all();

    expect(rows.length).toBe(3);
    expect(rows[0].execution_id).toBe('exec-1');
    expect(rows[0].level).toBe('INFO');
    expect(rows[0].message).toBe('Test message 1');
  });

  it('should handle metadata serialization', () => {
    const entry: LogEntry = {
      executionId: 'exec-1',
      taskId: 'task-1',
      timestamp: Date.now(),
      level: LogLevel.ERROR,
      source: 'worker',
      message: 'Task failed',
      metadata: { error: 'Connection timeout', code: 500 },
    };

    collector.log(entry);
    collector.flush(); // Force flush

    const stmt = db.prepare('SELECT * FROM execution_logs');
    const row = stmt.get() as any;

    expect(row.task_id).toBe('task-1');
    expect(row.metadata).toBe('{"error":"Connection timeout","code":500}');
  });

  it('should handle flush on close', () => {
    collector.log({
      executionId: 'exec-1',
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Test message',
    });

    // Don't flush manually, just close
    collector.close();

    const stmt = db.prepare('SELECT COUNT(*) as count FROM execution_logs');
    const result = stmt.get() as any;
    expect(result.count).toBe(1);
  });

  it('should handle transaction failures gracefully', () => {
    // Make database read-only to simulate failure
    db.exec('DROP TABLE execution_logs');

    collector.log({
      executionId: 'exec-1',
      timestamp: Date.now(),
      level: LogLevel.INFO,
      source: 'test',
      message: 'Test message',
    });

    // This should not throw, but log error
    collector.flush();

    // Should still have the entry in buffer (since flush failed)
    // We can't easily test the buffer directly, but at least it shouldn't crash
  });
});