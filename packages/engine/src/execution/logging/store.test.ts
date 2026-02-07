import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { LogStore } from './store';

describe('LogStore', () => {
  let db: Database;
  let logStore: LogStore;

  beforeEach(() => {
    db = new Database(':memory:');
    // Create the tables
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
      CREATE TABLE execution_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT NOT NULL
      )
    `);

    logStore = new LogStore({ db });
  });

  afterEach(() => {
    db.close();
  });

  it('should get logs by execution', () => {
    const now = Date.now();

    // Insert test logs
    db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('exec-1', 'task-1', now, 'INFO', 'worker', 'Task started', '{"key": "value"}');

    db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('exec-1', 'task-2', now + 1000, 'ERROR', 'worker', 'Task failed', null);

    const logs = logStore.getLogsByExecution('exec-1');

    expect(logs.length).toBe(2);
    expect(logs[0].executionId).toBe('exec-1');
    expect(logs[0].taskId).toBe('task-1'); // Should be ordered by timestamp ASC
    expect(logs[0].level).toBe('INFO');
    expect(logs[1].taskId).toBe('task-2');
    expect(logs[1].level).toBe('ERROR');
    expect(logs[1].metadata).toEqual({ key: 'value' });
  });

  it('should filter logs by level', () => {
    const now = Date.now();

    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-1', now, 'INFO', 'scheduler', 'Execution started');

    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-1', now + 1000, 'ERROR', 'worker', 'Task failed');

    const errorLogs = logStore.getLogsByExecution('exec-1', { level: ['ERROR'] });

    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].level).toBe('ERROR');
  });

  it('should filter logs by time range', () => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-1', fiveMinutesAgo - 1000, 'INFO', 'scheduler', 'Old log');

    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-1', now, 'INFO', 'scheduler', 'Recent log');

    const recentLogs = logStore.getLogsByExecution('exec-1', { since: 5 * 60 * 1000 });

    expect(recentLogs.length).toBe(1);
    expect(recentLogs[0].message).toBe('Recent log');
  });

  it('should filter logs by task', () => {
    const now = Date.now();

    db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('exec-1', 'task-1', now, 'INFO', 'worker', 'Task 1 log');

    db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('exec-1', 'task-2', now + 1000, 'INFO', 'worker', 'Task 2 log');

    const taskLogs = logStore.getLogsByExecution('exec-1', { taskId: 'task-1' });

    expect(taskLogs.length).toBe(1);
    expect(taskLogs[0].taskId).toBe('task-1');
  });

  it('should get logs by task', () => {
    const now = Date.now();

    db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('exec-1', 'task-1', now, 'INFO', 'worker', 'Log 1');

    db.prepare(`
      INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('exec-2', 'task-1', now + 1000, 'ERROR', 'worker', 'Log 2');

    const logs = logStore.getLogsByTask('task-1');

    expect(logs.length).toBe(2);
    expect(logs[0].executionId).toBe('exec-1'); // Ordered by timestamp ASC
    expect(logs[1].executionId).toBe('exec-2');
  });

  it('should get audit trail', () => {
    const now = Date.now();

    db.prepare(`
      INSERT INTO execution_audit_events (execution_id, event_type, timestamp, metadata)
      VALUES (?, ?, ?, ?)
    `).run('exec-1', 'CREATED', now, '{"workflowId": "wf-1"}');

    db.prepare(`
      INSERT INTO execution_audit_events (execution_id, event_type, timestamp, metadata)
      VALUES (?, ?, ?, ?)
    `).run('exec-1', 'STARTED', now + 1000, '{}');

    const auditTrail = logStore.getAuditTrail('exec-1');

    expect(auditTrail.length).toBe(2);
    expect(auditTrail[0].eventType).toBe('CREATED'); // Ordered by timestamp ASC
    expect(auditTrail[1].eventType).toBe('STARTED');
    expect(auditTrail[0].metadata).toEqual({ workflowId: 'wf-1' });
  });

  it('should support pagination', () => {
    const now = Date.now();

    // Insert 5 logs
    for (let i = 0; i < 5; i++) {
      db.prepare(`
        INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
        VALUES (?, ?, ?, ?, ?)
      `).run('exec-1', now + i, 'INFO', 'test', `Log ${i}`);
    }

    const firstPage = logStore.getLogsByExecution('exec-1', {}, { limit: 2, offset: 0 });
    const secondPage = logStore.getLogsByExecution('exec-1', {}, { limit: 2, offset: 2 });

    expect(firstPage.length).toBe(2);
    expect(secondPage.length).toBe(2);
    expect(firstPage[0].message).toBe('Log 0'); // ASC order
    expect(firstPage[1].message).toBe('Log 1');
    expect(secondPage[0].message).toBe('Log 2');
    expect(secondPage[1].message).toBe('Log 3');
  });
});