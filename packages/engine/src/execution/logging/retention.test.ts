import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { LogRetentionManager } from './retention';

describe('LogRetentionManager', () => {
  let db: Database;
  let retentionManager: LogRetentionManager;

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

    retentionManager = new LogRetentionManager({ db, retentionDays: 7 });
  });

  afterEach(() => {
    db.close();
  });

  it('should cleanup old logs', async () => {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

    // Insert old logs
    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-1', twoWeeksAgo, 'INFO', 'test', 'Old log');

    // Insert recent logs
    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-2', weekAgo + 1000, 'INFO', 'test', 'Recent log');

    const result = await retentionManager.cleanup();

    expect(result.logsDeleted).toBe(1);
    expect(result.auditEventsDeleted).toBe(0);

    const remainingLogs = db.prepare('SELECT COUNT(*) as count FROM execution_logs').get() as any;
    expect(remainingLogs.count).toBe(1);
  });

  it('should cleanup old audit events', async () => {
    const now = Date.now();
    const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

    // Insert old audit events
    db.prepare(`
      INSERT INTO execution_audit_events (execution_id, event_type, timestamp, metadata)
      VALUES (?, ?, ?, ?)
    `).run('exec-1', 'CREATED', twoWeeksAgo, '{}');

    const result = await retentionManager.cleanup();

    expect(result.logsDeleted).toBe(0);
    expect(result.auditEventsDeleted).toBe(1);

    const remainingEvents = db.prepare('SELECT COUNT(*) as count FROM execution_audit_events').get() as any;
    expect(remainingEvents.count).toBe(0);
  });

  it('should handle batch cleanup', async () => {
    const now = Date.now();
    const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

    // Insert many old logs (more than batch size)
    for (let i = 0; i < 1500; i++) {
      db.prepare(`
        INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
        VALUES (?, ?, ?, ?, ?)
      `).run(`exec-${i}`, twoWeeksAgo, 'INFO', 'test', `Log ${i}`);
    }

    const result = await retentionManager.cleanup();

    expect(result.logsDeleted).toBe(1500);
    const remainingLogs = db.prepare('SELECT COUNT(*) as count FROM execution_logs').get() as any;
    expect(remainingLogs.count).toBe(0);
  });

  it('should get stats', () => {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Insert some logs
    db.prepare(`
      INSERT INTO execution_logs (execution_id, timestamp, level, source, message)
      VALUES (?, ?, ?, ?, ?)
    `).run('exec-1', weekAgo, 'INFO', 'test', 'Test log');

    // Insert some audit events
    db.prepare(`
      INSERT INTO execution_audit_events (execution_id, event_type, timestamp, metadata)
      VALUES (?, ?, ?, ?)
    `).run('exec-1', 'CREATED', weekAgo, '{}');

    const stats = retentionManager.getStats();

    expect(stats.logCount).toBe(1);
    expect(stats.auditEventCount).toBe(1);
    expect(stats.oldestLog).toBeDefined();
    expect(stats.oldestAuditEvent).toBeDefined();
    expect(stats.estimatedLogSizeMB).toBeGreaterThan(0);
    expect(stats.estimatedAuditSizeMB).toBeGreaterThan(0);
    expect(stats.totalEstimatedSizeMB).toBeGreaterThan(0);
  });
});