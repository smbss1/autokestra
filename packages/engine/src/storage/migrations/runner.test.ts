import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { MigrationRunner } from './runner';
import { unlinkSync, existsSync } from 'fs';

describe('MigrationRunner', () => {
  const testDbPath = './test-migrations.db';
  let db: Database;
  let runner: MigrationRunner;

  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    db.run('PRAGMA foreign_keys = ON'); // Enable foreign key constraints
    runner = new MigrationRunner(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('should create schema_version table', async () => {
    await runner.runPendingMigrations(db);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
    `).all();

    expect(tables.length).toBe(1);
  });

  it('should apply initial migration', async () => {
    await runner.runPendingMigrations(db);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('workflows');
    expect(tableNames).toContain('executions');
    expect(tableNames).toContain('task_runs');
    expect(tableNames).toContain('attempts');
    expect(tableNames).toContain('outputs');
  });

  it('should record migration version', async () => {
    await runner.runPendingMigrations(db);

    const status = runner.getStatus(db);
    expect(status.length).toBe(2);
    expect(status[0].version).toBe(1);
    expect(status[0].name).toBe('initial_schema');
    expect(status[1].version).toBe(2);
    expect(status[1].name).toBe('add_logging_tables');
  });

  it('should not re-apply already applied migrations', async () => {
    await runner.runPendingMigrations(db);
    
    const statusBefore = runner.getStatus(db);
    
    // Run again
    await runner.runPendingMigrations(db);
    
    const statusAfter = runner.getStatus(db);
    
    // Should be the same
    expect(statusBefore.length).toBe(statusAfter.length);
  });

  it('should create indexes', async () => {
    await runner.runPendingMigrations(db);

    const indexes = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'
    `).all() as Array<{ name: string }>;

    expect(indexes.length).toBeGreaterThan(0);
    
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_executions_workflow_created');
    expect(indexNames).toContain('idx_executions_state_created');
    expect(indexNames).toContain('idx_task_runs_execution');
  });

  it('should enforce foreign key constraints', async () => {
    await runner.runPendingMigrations(db);

    // Try to insert a task run without parent execution
    expect(() => {
      db.prepare(`
        INSERT INTO task_runs (execution_id, task_id, state, created_at, updated_at)
        VALUES ('nonexistent', 'task1', 'PENDING', datetime('now'), datetime('now'))
      `).run();
    }).toThrow();
  });
});
