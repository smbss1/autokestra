import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { LogCollector, LogEntry, LogLevel } from './collector';

describe('LogCollector Performance', () => {
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

    db.exec(`
      CREATE TABLE executions (
        execution_id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        state TEXT NOT NULL,
        reason_code TEXT,
        message TEXT,
        metadata TEXT,
        log_entry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        updated_at TEXT NOT NULL
      )
    `);

    const insertExecution = db.prepare(`
      INSERT INTO executions (execution_id, workflow_id, state, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);

    for (let i = 0; i < 10; i++) {
      insertExecution.run(`exec-${i}`, 'wf-1', 'PENDING');
    }

    // Use larger buffer for performance test
    collector = new LogCollector({ db, maxBufferSize: 1000, flushIntervalMs: 1000 });
  });

  afterEach(() => {
    collector.close();
    db.close();
  });

  it('should handle 10k log entries within performance limits', () => {
    const startTime = performance.now();

    // Generate 10k log entries
    const entries: LogEntry[] = [];
    for (let i = 0; i < 10000; i++) {
      entries.push({
        executionId: `exec-${i % 10}`, // 10 different executions
        taskId: i % 100 === 0 ? `task-${i % 100}` : undefined, // Some with task IDs
        timestamp: Date.now() + i,
        level: i % 4 === 0 ? LogLevel.ERROR :
               i % 4 === 1 ? LogLevel.WARN :
               i % 4 === 2 ? LogLevel.INFO : LogLevel.DEBUG,
        source: i % 2 === 0 ? 'scheduler' : 'worker',
        message: `Log message ${i}`,
        metadata: i % 10 === 0 ? { attempt: i % 3, duration: i * 10 } : undefined,
      });
    }

    // Log all entries
    for (const entry of entries) {
      collector.log(entry);
    }

    // Force final flush
    collector.flush();

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`10k log entries written in ${duration.toFixed(2)}ms`);

    // Performance requirements: should complete within 5 seconds
    expect(duration).toBeLessThan(5000);

    // Verify all entries were written
    const stmt = db.prepare('SELECT COUNT(*) as count FROM execution_logs');
    const result = stmt.get() as any;
    expect(result.count).toBe(10000);

    // Verify some entries have correct data
    const sampleStmt = db.prepare('SELECT * FROM execution_logs LIMIT 5');
    const samples = sampleStmt.all() as any[];
    expect(samples.length).toBe(5);
    expect(samples[0].execution_id).toBe('exec-0');
    expect(samples[0].message).toBe('Log message 0');
  });
});