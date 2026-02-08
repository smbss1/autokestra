import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { createApp } from './app';

import { SQLiteStateStore } from '@autokestra/engine/src/storage/sqlite';
import { MigrationRunner } from '@autokestra/engine/src/storage/migrations/runner';
import { createInitialExecution, createInitialTaskRun } from '@autokestra/engine/src/execution/models';

function authHeaders(key = 'k1'): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

const WORKFLOW_YAML = `apiVersion: v1
id: v01-happy
enabled: true
tasks:
  - id: t1
    type: example/plugin.action
    needs: []
`;

describe('DoD v0.1 - Server API + SQLite integration', () => {
  let dir: string;
  let dbPath: string;
  let db: Database;
  let store: SQLiteStateStore;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'autokestra-dod-'));
    dbPath = join(dir, 'autokestra.sqlite');

    db = new Database(dbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    const runner = new MigrationRunner(dbPath);
    await runner.runPendingMigrations(db);

    store = new SQLiteStateStore({ path: dbPath });
    await store.initialize();
  });

  afterEach(async () => {
    try {
      await store.close();
    } catch {
      // ignore
    }
    try {
      db.close();
    } catch {
      // ignore
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it('2.1 starts with temp SQLite and serves GET /health (public)', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const res = await app.fetch(new Request('http://localhost/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('2.2 applies a workflow via API and can list/describe it', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const put = await app.fetch(
      new Request('http://localhost/api/v1/workflows/v01-happy', {
        method: 'PUT',
        headers: {
          ...authHeaders(),
          'content-type': 'text/yaml',
        },
        body: WORKFLOW_YAML,
      }),
    );

    expect([200, 201]).toContain(put.status);

    const list = await app.fetch(new Request('http://localhost/api/v1/workflows', { headers: authHeaders() }));
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.total).toBeGreaterThanOrEqual(1);
    expect(listBody.workflows.some((w: any) => w.id === 'v01-happy')).toBe(true);

    const get = await app.fetch(new Request('http://localhost/api/v1/workflows/v01-happy', { headers: authHeaders() }));
    expect(get.status).toBe(200);
    const wf = await get.json();
    expect(wf.id).toBe('v01-happy');
  });

  it('2.4 retrieves logs newest-first and inspection masks secrets', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    // Apply workflow so inspector can map task ids/types.
    await app.fetch(
      new Request('http://localhost/api/v1/workflows/v01-happy', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'text/yaml' },
        body: WORKFLOW_YAML,
      }),
    );

    const executionId = 'exec-dod-1';
    const execution = createInitialExecution('v01-happy', executionId);
    execution.metadata = {
      apiKey: 'SUPER_SECRET',
      nested: { token: 'TOP_SECRET' },
    };
    await store.createExecution(execution);

    const taskRun = createInitialTaskRun(executionId, 't1');
    await store.createTaskRun(taskRun);

    // Insert logs with known timestamps.
    const insert = db.prepare(
      `INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    insert.run(executionId, 't1', 1000, 'INFO', 'worker', 'older', JSON.stringify({ tag: 'older' }));
    insert.run(executionId, 't1', 2000, 'ERROR', 'worker', 'newer', JSON.stringify({ tag: 'newer' }));

    const logsRes = await app.fetch(
      new Request(`http://localhost/api/v1/executions/${executionId}/logs?limit=10&offset=0`, { headers: authHeaders() }),
    );
    expect(logsRes.status).toBe(200);
    const logsBody = await logsRes.json();
    expect(logsBody.items.length).toBe(2);
    expect(logsBody.items[0].message).toBe('newer');
    expect(logsBody.items[1].message).toBe('older');

    const errorOnly = await app.fetch(
      new Request(`http://localhost/api/v1/executions/${executionId}/logs?level=ERROR`, { headers: authHeaders() }),
    );
    expect(errorOnly.status).toBe(200);
    const errorBody = await errorOnly.json();
    expect(errorBody.items.length).toBe(1);
    expect(errorBody.items[0].level).toBe('ERROR');

    const inspect = await app.fetch(new Request(`http://localhost/api/v1/executions/${executionId}`, { headers: authHeaders() }));
    expect(inspect.status).toBe(200);
    const inspected = await inspect.json();
    expect(inspected.overview.metadata.apiKey).toBe('***MASKED***');
    expect(inspected.overview.metadata.nested.token).toBe('***MASKED***');
  });

  it('2.5 persists workflows/executions across restart with the same SQLite path', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    await app.fetch(
      new Request('http://localhost/api/v1/workflows/v01-happy', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'text/yaml' },
        body: WORKFLOW_YAML,
      }),
    );

    const executionId = 'exec-dod-restart';
    await store.createExecution(createInitialExecution('v01-happy', executionId));

    await store.close();
    db.close();

    // "Restart" with the same db path.
    db = new Database(dbPath);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');

    store = new SQLiteStateStore({ path: dbPath });
    await store.initialize();

    const app2 = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const list = await app2.fetch(new Request('http://localhost/api/v1/workflows', { headers: authHeaders() }));
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.workflows.some((w: any) => w.id === 'v01-happy')).toBe(true);

    const executions = await app2.fetch(new Request('http://localhost/api/v1/executions', { headers: authHeaders() }));
    expect(executions.status).toBe(200);
    const execBody = await executions.json();
    expect(execBody.executions.some((e: any) => e.executionId === executionId)).toBe(true);
  });
});
