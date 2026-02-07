import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { AuditLogger, AuditEventType } from './audit';

describe('AuditLogger', () => {
  let db: Database;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    db = new Database(':memory:');
    // Create the audit events table
    db.exec(`
      CREATE TABLE execution_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT NOT NULL
      )
    `);

    auditLogger = new AuditLogger({ db });
  });

  afterEach(() => {
    db.close();
  });

  it('should log audit events', () => {
    auditLogger.log({
      executionId: 'exec-1',
      eventType: AuditEventType.CREATED,
      timestamp: Date.now(),
      metadata: { workflowId: 'wf-1' },
    });

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.execution_id).toBe('exec-1');
    expect(row.event_type).toBe('CREATED');
    expect(JSON.parse(row.metadata)).toEqual({ workflowId: 'wf-1' });
  });

  it('should emit CREATED event', () => {
    auditLogger.emitCreated('exec-1', 'wf-1', 'manual');

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.event_type).toBe('CREATED');
    expect(JSON.parse(row.metadata)).toEqual({ workflowId: 'wf-1', triggerType: 'manual' });
  });

  it('should emit STARTED event', () => {
    auditLogger.emitStarted('exec-1');

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.event_type).toBe('STARTED');
    expect(JSON.parse(row.metadata)).toEqual({});
  });

  it('should emit STATE_CHANGE event', () => {
    auditLogger.emitStateChange('exec-1', 'PENDING', 'RUNNING', 'started');

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.event_type).toBe('STATE_CHANGE');
    expect(JSON.parse(row.metadata)).toEqual({ from: 'PENDING', to: 'RUNNING', reason: 'started' });
  });

  it('should emit COMPLETED event', () => {
    auditLogger.emitCompleted('exec-1', 1500);

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.event_type).toBe('COMPLETED');
    expect(JSON.parse(row.metadata)).toEqual({ duration: 1500 });
  });

  it('should emit FAILED event', () => {
    auditLogger.emitFailed('exec-1', 'TASK_FAILED', 'Task timeout');

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.event_type).toBe('FAILED');
    expect(JSON.parse(row.metadata)).toEqual({ reason: 'TASK_FAILED', message: 'Task timeout' });
  });

  it('should emit CANCELLED event', () => {
    auditLogger.emitCancelled('exec-1', 'USER_REQUEST');

    const stmt = db.prepare('SELECT * FROM execution_audit_events');
    const row = stmt.get() as any;

    expect(row.event_type).toBe('CANCELLED');
    expect(JSON.parse(row.metadata)).toEqual({ reason: 'USER_REQUEST' });
  });

  it('should handle database errors gracefully', () => {
    // Drop the table to cause an error
    db.exec('DROP TABLE execution_audit_events');

    // This should not throw
    expect(() => {
      auditLogger.emitCreated('exec-1', 'wf-1');
    }).not.toThrow();
  });
});