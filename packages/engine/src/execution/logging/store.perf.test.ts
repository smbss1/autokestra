import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { LogStore, LogEntry, LogQueryFilters } from './store';
import { LogLevel } from './collector';

describe('LogStore Query Performance', () => {
  let db: Database;
  let store: LogStore;

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
      );
      CREATE INDEX idx_logs_execution ON execution_logs (execution_id, timestamp);
      CREATE INDEX idx_logs_task ON execution_logs (task_id, timestamp);
    `);

    store = new LogStore({ db });
  });

  afterEach(() => {
    db.close();
  });

  it('should query logs efficiently for execution with 100+ tasks', () => {
    const executionId = 'perf-exec-1';
    const taskCount = 120; // 120 tasks
    const logsPerTask = 5; // 5 logs per task = 600 total logs

    // Insert logs for 120 tasks
    const insertStmt = db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const startInsertTime = performance.now();

    for (let taskNum = 1; taskNum <= taskCount; taskNum++) {
      const taskId = `task-${taskNum.toString().padStart(3, '0')}`;

      for (let logNum = 1; logNum <= logsPerTask; logNum++) {
        insertStmt.run(
          executionId,
          taskId,
          Date.now() + (taskNum * 1000) + logNum, // Stagger timestamps
          logNum % 4 === 0 ? 'ERROR' :
          logNum % 4 === 1 ? 'WARN' :
          logNum % 4 === 2 ? 'INFO' : 'DEBUG',
          logNum % 2 === 0 ? 'scheduler' : 'worker',
          `Task ${taskId} log message ${logNum}`,
          logNum === 1 ? JSON.stringify({ attempt: logNum, duration: taskNum * 10 }) : null
        );
      }
    }

    const insertDuration = performance.now() - startInsertTime;
    console.log(`Inserted ${taskCount * logsPerTask} logs in ${insertDuration.toFixed(2)}ms`);

    // Test query performance - get all logs for execution
    const startQueryTime = performance.now();

    const logs = store.getLogsByExecution(executionId);

    const queryDuration = performance.now() - startQueryTime;
    console.log(`Queried ${logs.length} logs in ${queryDuration.toFixed(2)}ms`);

    // Performance requirements: should complete within 500ms
    expect(queryDuration).toBeLessThan(500);
    expect(logs.length).toBe(taskCount * logsPerTask);

    // Test filtered query performance - get only ERROR and WARN logs
    const startFilteredQueryTime = performance.now();

    const filteredLogs = store.getLogsByExecution(executionId, {
      level: ['ERROR', 'WARN']
    });

    const filteredQueryDuration = performance.now() - startFilteredQueryTime;
    console.log(`Queried ${filteredLogs.length} filtered logs in ${filteredQueryDuration.toFixed(2)}ms`);

    // Should be faster or equal performance
    expect(filteredQueryDuration).toBeLessThan(500);
    expect(filteredLogs.length).toBeGreaterThan(0);
    expect(filteredLogs.length).toBeLessThan(logs.length);

    // Test task-specific query performance
    const startTaskQueryTime = performance.now();

    const taskLogs = store.getLogsByExecution(executionId, {
      taskId: 'task-050' // Middle task
    });

    const taskQueryDuration = performance.now() - startTaskQueryTime;
    console.log(`Queried ${taskLogs.length} task-specific logs in ${taskQueryDuration.toFixed(2)}ms`);

    expect(taskQueryDuration).toBeLessThan(100); // Should be very fast
    expect(taskLogs.length).toBe(logsPerTask);
    expect(taskLogs.every(log => log.taskId === 'task-050')).toBe(true);
  });
});