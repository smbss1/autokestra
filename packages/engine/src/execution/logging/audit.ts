import { Database } from 'bun:sqlite';

export interface AuditEvent {
  executionId: string;
  eventType: AuditEventType;
  timestamp: number;
  metadata: Record<string, any>;
}

export enum AuditEventType {
  CREATED = 'CREATED',
  STARTED = 'STARTED',
  STATE_CHANGE = 'STATE_CHANGE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

export interface AuditLoggerConfig {
  db: Database;
}

export class AuditLogger {
  private db: Database;

  constructor(config: AuditLoggerConfig) {
    this.db = config.db;
  }

  /**
   * Log an audit event
   */
  log(event: AuditEvent): void {
    try {
      this.db.prepare(`
        INSERT INTO execution_audit_events (execution_id, event_type, timestamp, metadata)
        VALUES (?, ?, ?, ?)
      `).run(
        event.executionId,
        event.eventType,
        event.timestamp,
        JSON.stringify(event.metadata)
      );
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not fail the operation
    }
  }

  /**
   * Emit CREATED event
   */
  emitCreated(executionId: string, workflowId: string, triggerType: string = 'manual'): void {
    this.log({
      executionId,
      eventType: AuditEventType.CREATED,
      timestamp: Date.now(),
      metadata: { workflowId, triggerType },
    });
  }

  /**
   * Emit STARTED event
   */
  emitStarted(executionId: string): void {
    this.log({
      executionId,
      eventType: AuditEventType.STARTED,
      timestamp: Date.now(),
      metadata: {},
    });
  }

  /**
   * Emit STATE_CHANGE event
   */
  emitStateChange(executionId: string, fromState: string, toState: string, reason?: string): void {
    this.log({
      executionId,
      eventType: AuditEventType.STATE_CHANGE,
      timestamp: Date.now(),
      metadata: { from: fromState, to: toState, reason },
    });
  }

  /**
   * Emit COMPLETED event
   */
  emitCompleted(executionId: string, duration: number): void {
    this.log({
      executionId,
      eventType: AuditEventType.COMPLETED,
      timestamp: Date.now(),
      metadata: { duration },
    });
  }

  /**
   * Emit FAILED event
   */
  emitFailed(executionId: string, reason: string, message?: string): void {
    this.log({
      executionId,
      eventType: AuditEventType.FAILED,
      timestamp: Date.now(),
      metadata: { reason, message },
    });
  }

  /**
   * Emit CANCELLED event
   */
  emitCancelled(executionId: string, reason: string): void {
    this.log({
      executionId,
      eventType: AuditEventType.CANCELLED,
      timestamp: Date.now(),
      metadata: { reason },
    });
  }

  /**
   * Emit TIMEOUT event
   */
  emitTimeout(executionId: string, duration: number): void {
    this.log({
      executionId,
      eventType: AuditEventType.TIMEOUT,
      timestamp: Date.now(),
      metadata: { duration },
    });
  }
}