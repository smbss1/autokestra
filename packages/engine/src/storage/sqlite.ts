import { Database } from 'bun:sqlite';
import {
  StateStore,
  StoredWorkflow,
  WorkflowQueryOptions,
  ExecutionQueryOptions,
  TaskRunQueryOptions,
  QueryResult,
  TransactionCallback,
} from './types';
import { Execution, TaskRun, Attempt } from '../execution/models';
import { ExecutionState, TaskRunState } from '../execution/types';
import { MigrationRunner } from './migrations/runner';

export interface SQLiteConfig {
  path: string;
  retentionDays?: number;
}

export class SQLiteStateStore implements StateStore {
  private db: Database | null = null;
  private config: SQLiteConfig;
  private migrationRunner: MigrationRunner;

  constructor(config: SQLiteConfig) {
    this.config = config;
    this.migrationRunner = new MigrationRunner(config.path);
  }

  async initialize(): Promise<void> {
    // Open database connection
    this.db = new Database(this.config.path);

    // Enable WAL mode for better concurrency
    this.db.run('PRAGMA journal_mode = WAL');

    // Enable foreign key constraints
    this.db.run('PRAGMA foreign_keys = ON');

    // Run migrations
    await this.migrationRunner.runPendingMigrations(this.db);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const db = this.getDb();
    // Bun SQLite doesn't have a transaction wrapper, so we do it manually
    db.run('BEGIN');
    try {
      const result = await callback();
      db.run('COMMIT');
      return result;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  // Workflow methods
  async saveWorkflow(workflow: StoredWorkflow): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO workflows (id, definition, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        definition = excluded.definition,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      workflow.id,
      JSON.stringify(workflow.definition),
      workflow.enabled ? 1 : 0,
      workflow.createdAt.toISOString(),
      workflow.updatedAt.toISOString()
    );
  }

  async getWorkflow(id: string): Promise<StoredWorkflow | null> {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM workflows WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      definition: JSON.parse(row.definition),
      enabled: row.enabled === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async listWorkflows(options: WorkflowQueryOptions = {}): Promise<QueryResult<StoredWorkflow>> {
    const db = this.getDb();
    const { limit = 50, offset = 0, enabled } = options;

    let whereClause = '';
    const params: any[] = [];

    if (enabled !== undefined) {
      whereClause = 'WHERE enabled = ?';
      params.push(enabled ? 1 : 0);
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM workflows ${whereClause}`);
    const countRow = countStmt.get(...params) as any;
    const total = countRow.count;

    const stmt = db.prepare(`
      SELECT * FROM workflows ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];

    const items = rows.map(row => ({
      id: row.id,
      definition: JSON.parse(row.definition),
      enabled: row.enabled === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    return { items, total, offset, limit };
  }

  async deleteWorkflow(id: string): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM workflows WHERE id = ?');
    stmt.run(id);
  }

  // Execution methods
  async createExecution(execution: Execution): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO executions (
        execution_id, workflow_id, state, reason_code, message, metadata,
        created_at, started_at, ended_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      execution.executionId,
      execution.workflowId,
      execution.state,
      execution.reasonCode || null,
      execution.message || null,
      execution.metadata ? JSON.stringify(execution.metadata) : null,
      execution.timestamps.createdAt.toISOString(),
      execution.timestamps.startedAt?.toISOString() || null,
      execution.timestamps.endedAt?.toISOString() || null,
      execution.timestamps.updatedAt.toISOString()
    );
  }

  async updateExecution(execution: Execution): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE executions SET
        state = ?,
        reason_code = ?,
        message = ?,
        metadata = ?,
        started_at = ?,
        ended_at = ?,
        updated_at = ?
      WHERE execution_id = ?
    `);

    stmt.run(
      execution.state,
      execution.reasonCode || null,
      execution.message || null,
      execution.metadata ? JSON.stringify(execution.metadata) : null,
      execution.timestamps.startedAt?.toISOString() || null,
      execution.timestamps.endedAt?.toISOString() || null,
      execution.timestamps.updatedAt.toISOString(),
      execution.executionId
    );
  }

  async getExecution(executionId: string): Promise<Execution | null> {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM executions WHERE execution_id = ?');
    const row = stmt.get(executionId) as any;

    if (!row) return null;

    return {
      workflowId: row.workflow_id,
      executionId: row.execution_id,
      state: row.state as ExecutionState,
      reasonCode: row.reason_code,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    };
  }

  async listExecutions(options: ExecutionQueryOptions = {}): Promise<QueryResult<Execution>> {
    const db = this.getDb();
    const { limit = 50, offset = 0, workflowId, state, createdAfter, createdBefore } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (workflowId) {
      whereClauses.push('workflow_id = ?');
      params.push(workflowId);
    }

    if (state) {
      if (Array.isArray(state)) {
        whereClauses.push(`state IN (${state.map(() => '?').join(', ')})`);
        params.push(...state);
      } else {
        whereClauses.push('state = ?');
        params.push(state);
      }
    }

    if (createdAfter) {
      whereClauses.push('created_at >= ?');
      params.push(createdAfter.toISOString());
    }

    if (createdBefore) {
      whereClauses.push('created_at <= ?');
      params.push(createdBefore.toISOString());
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM executions ${whereClause}`);
    const countRow = countStmt.get(...params) as any;
    const total = countRow.count;

    // Get paginated results
    const stmt = db.prepare(`
      SELECT * FROM executions ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];

    const items = rows.map(row => ({
      workflowId: row.workflow_id,
      executionId: row.execution_id,
      state: row.state as ExecutionState,
      reasonCode: row.reason_code,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    }));

    return { items, total, offset, limit };
  }

  // Task Run methods
  async createTaskRun(taskRun: TaskRun): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO task_runs (
        execution_id, task_id, state, reason_code, message,
        created_at, started_at, ended_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      taskRun.executionId,
      taskRun.taskId,
      taskRun.state,
      taskRun.reasonCode || null,
      taskRun.message || null,
      taskRun.timestamps.createdAt.toISOString(),
      taskRun.timestamps.startedAt?.toISOString() || null,
      taskRun.timestamps.endedAt?.toISOString() || null,
      taskRun.timestamps.updatedAt.toISOString()
    );
  }

  async updateTaskRun(taskRun: TaskRun): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE task_runs SET
        state = ?,
        reason_code = ?,
        message = ?,
        started_at = ?,
        ended_at = ?,
        updated_at = ?
      WHERE execution_id = ? AND task_id = ?
    `);

    stmt.run(
      taskRun.state,
      taskRun.reasonCode || null,
      taskRun.message || null,
      taskRun.timestamps.startedAt?.toISOString() || null,
      taskRun.timestamps.endedAt?.toISOString() || null,
      taskRun.timestamps.updatedAt.toISOString(),
      taskRun.executionId,
      taskRun.taskId
    );
  }

  async getTaskRun(executionId: string, taskId: string): Promise<TaskRun | null> {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM task_runs WHERE execution_id = ? AND task_id = ?');
    const row = stmt.get(executionId, taskId) as any;

    if (!row) return null;

    return {
      executionId: row.execution_id,
      taskId: row.task_id,
      state: row.state as TaskRunState,
      reasonCode: row.reason_code,
      message: row.message,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    };
  }

  async listTaskRuns(options: TaskRunQueryOptions = {}): Promise<QueryResult<TaskRun>> {
    const db = this.getDb();
    const { limit = 100, offset = 0, executionId, taskId, state } = options;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (executionId) {
      whereClauses.push('execution_id = ?');
      params.push(executionId);
    }

    if (taskId) {
      whereClauses.push('task_id = ?');
      params.push(taskId);
    }

    if (state) {
      if (Array.isArray(state)) {
        whereClauses.push(`state IN (${state.map(() => '?').join(', ')})`);
        params.push(...state);
      } else {
        whereClauses.push('state = ?');
        params.push(state);
      }
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM task_runs ${whereClause}`);
    const countRow = countStmt.get(...params) as any;
    const total = countRow.count;

    const stmt = db.prepare(`
      SELECT * FROM task_runs ${whereClause}
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as any[];

    const items = rows.map(row => ({
      executionId: row.execution_id,
      taskId: row.task_id,
      state: row.state as TaskRunState,
      reasonCode: row.reason_code,
      message: row.message,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    }));

    return { items, total, offset, limit };
  }

  // Attempt methods
  async createAttempt(attempt: Attempt): Promise<void> {
    const db = this.getDb();
    
    // Parse taskRunId to get executionId and taskId
    const [executionId, taskId] = attempt.taskRunId.split(':');
    
    const stmt = db.prepare(`
      INSERT INTO attempts (
        task_run_id, execution_id, task_id, attempt_number, status, result_ref,
        created_at, started_at, ended_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      attempt.taskRunId,
      executionId,
      taskId,
      attempt.attemptNumber,
      attempt.status || null,
      attempt.resultRef || null,
      attempt.timestamps.createdAt.toISOString(),
      attempt.timestamps.startedAt?.toISOString() || null,
      attempt.timestamps.endedAt?.toISOString() || null,
      attempt.timestamps.updatedAt.toISOString()
    );
  }

  async getAttempts(taskRunId: string): Promise<Attempt[]> {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM attempts
      WHERE task_run_id = ?
      ORDER BY attempt_number ASC
    `);

    const rows = stmt.all(taskRunId) as any[];

    return rows.map(row => ({
      taskRunId: row.task_run_id,
      attemptNumber: row.attempt_number,
      status: row.status,
      resultRef: row.result_ref,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    }));
  }

  // Recovery methods
  async getActiveExecutions(): Promise<Execution[]> {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM executions
      WHERE state = 'RUNNING'
      ORDER BY created_at ASC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      workflowId: row.workflow_id,
      executionId: row.execution_id,
      state: row.state as ExecutionState,
      reasonCode: row.reason_code,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    }));
  }

  async getPendingExecutions(): Promise<Execution[]> {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM executions
      WHERE state IN ('PENDING', 'WAITING')
      ORDER BY created_at ASC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      workflowId: row.workflow_id,
      executionId: row.execution_id,
      state: row.state as ExecutionState,
      reasonCode: row.reason_code,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamps: {
        createdAt: new Date(row.created_at),
        startedAt: row.started_at ? new Date(row.started_at) : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
        updatedAt: new Date(row.updated_at),
      },
    }));
  }

  // Retention methods
  async deleteExecutionsBefore(date: Date, states?: ExecutionState[]): Promise<number> {
    const db = this.getDb();
    
    let whereClause = 'WHERE created_at < ?';
    const params: any[] = [date.toISOString()];

    if (states && states.length > 0) {
      whereClause += ` AND state IN (${states.map(() => '?').join(', ')})`;
      params.push(...states);
    }

    // Delete executions (cascade will handle task_runs and attempts)
    const stmt = db.prepare(`DELETE FROM executions ${whereClause}`);
    const result = stmt.run(...params);
    
    return result.changes;
  }

  // Atomic batch operations
  async updateExecutionAndTaskRuns(
    execution: Execution,
    taskRuns: TaskRun[]
  ): Promise<void> {
    await this.transaction(async () => {
      await this.updateExecution(execution);
      for (const taskRun of taskRuns) {
        await this.updateTaskRun(taskRun);
      }
    });
  }
}
