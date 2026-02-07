import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export interface AppliedMigration {
  version: number;
  name: string;
  appliedAt: Date;
}

export class MigrationRunner {
  private dbPath: string;
  private migrationsDir: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    // Migrations are in the same directory as this file
    this.migrationsDir = join(__dirname, '.');
  }

  private ensureSchemaVersionTable(db: Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
  }

  private getAppliedVersions(db: Database): Set<number> {
    this.ensureSchemaVersionTable(db);
    const stmt = db.prepare('SELECT version FROM schema_version ORDER BY version');
    const rows = stmt.all() as Array<{ version: number }>;
    return new Set(rows.map(r => r.version));
  }

  private loadMigrations(): Migration[] {
    const migrations: Migration[] = [];
    
    // Load built-in migrations
    migrations.push({
      version: 1,
      name: 'initial_schema',
      up: this.getInitialSchema(),
    });

    return migrations.sort((a, b) => a.version - b.version);
  }

  async runPendingMigrations(db: Database): Promise<void> {
    const applied = this.getAppliedVersions(db);
    const migrations = this.loadMigrations();

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue; // Skip already applied
      }

      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      
      try {
        db.transaction(() => {
          // Execute migration
          db.exec(migration.up);

          // Record migration
          const stmt = db.prepare(`
            INSERT INTO schema_version (version, name, applied_at)
            VALUES (?, ?, ?)
          `);
          stmt.run(migration.version, migration.name, new Date().toISOString());
        })();

        console.log(`✓ Applied migration ${migration.version}`);
      } catch (error) {
        console.error(`✗ Failed to apply migration ${migration.version}:`, error);
        throw error;
      }
    }
  }

  async rollback(db: Database, targetVersion?: number): Promise<void> {
    const applied = Array.from(this.getAppliedVersions(db)).sort((a, b) => b - a);
    const migrations = this.loadMigrations();

    for (const version of applied) {
      if (targetVersion !== undefined && version <= targetVersion) {
        break;
      }

      const migration = migrations.find(m => m.version === version);
      if (!migration || !migration.down) {
        throw new Error(`Cannot rollback migration ${version}: no down migration`);
      }

      console.log(`Rolling back migration ${version}: ${migration.name}`);

      try {
        db.transaction(() => {
          // Execute rollback
          db.exec(migration.down!);

          // Remove migration record
          const stmt = db.prepare('DELETE FROM schema_version WHERE version = ?');
          stmt.run(version);
        })();

        console.log(`✓ Rolled back migration ${version}`);
      } catch (error) {
        console.error(`✗ Failed to rollback migration ${version}:`, error);
        throw error;
      }
    }
  }

  getStatus(db: Database): AppliedMigration[] {
    this.ensureSchemaVersionTable(db);
    const stmt = db.prepare(`
      SELECT version, name, applied_at
      FROM schema_version
      ORDER BY version
    `);
    const rows = stmt.all() as Array<{ version: number; name: string; applied_at: string }>;
    
    return rows.map(row => ({
      version: row.version,
      name: row.name,
      appliedAt: new Date(row.applied_at),
    }));
  }

  private getInitialSchema(): string {
    return `
      -- Workflows table
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        definition TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Executions table
      CREATE TABLE IF NOT EXISTS executions (
        execution_id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        state TEXT NOT NULL,
        reason_code TEXT,
        message TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );

      -- Task runs table
      CREATE TABLE IF NOT EXISTS task_runs (
        execution_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        state TEXT NOT NULL,
        reason_code TEXT,
        message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (execution_id, task_id),
        FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE CASCADE
      );

      -- Attempts table
      CREATE TABLE IF NOT EXISTS attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_run_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        status TEXT,
        result_ref TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (execution_id, task_id, attempt_number),
        FOREIGN KEY (execution_id, task_id) REFERENCES task_runs(execution_id, task_id) ON DELETE CASCADE
      );

      -- Outputs table (for task outputs/logs)
      CREATE TABLE IF NOT EXISTS outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT NOT NULL,
        task_id TEXT,
        output_type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (execution_id) REFERENCES executions(execution_id) ON DELETE CASCADE
      );

      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_executions_workflow_created 
        ON executions(workflow_id, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_executions_state_created 
        ON executions(state, created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_task_runs_execution 
        ON task_runs(execution_id);
      
      CREATE INDEX IF NOT EXISTS idx_attempts_task_run 
        ON attempts(execution_id, task_id);
      
      CREATE INDEX IF NOT EXISTS idx_outputs_execution 
        ON outputs(execution_id, created_at DESC);
    `;
  }
}
