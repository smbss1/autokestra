import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';

import { createApp } from './app';

import type {
  StateStore,
  StoredWorkflow,
  WorkflowQueryOptions,
  ExecutionQueryOptions,
  TaskRunQueryOptions,
  AttemptQueryOptions,
  QueryResult,
  TransactionCallback,
} from '@autokestra/engine/src/storage/types';

import type { Execution, TaskRun, Attempt } from '@autokestra/engine/src/execution/models';
import { createInitialExecution, createInitialTaskRun } from '@autokestra/engine/src/execution/models';
import { ExecutionState, TaskRunState } from '@autokestra/engine/src/execution/types';

class InMemoryStateStore implements StateStore {
  private workflows = new Map<string, StoredWorkflow>();
  private executions = new Map<string, Execution>();
  private taskRuns = new Map<string, TaskRun>();
  private attempts = new Map<string, Attempt[]>();

  async initialize(): Promise<void> {}
  async close(): Promise<void> {}

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    return await callback();
  }

  async saveWorkflow(workflow: StoredWorkflow): Promise<void> {
    this.workflows.set(workflow.id, workflow);
  }

  async getWorkflow(id: string): Promise<StoredWorkflow | null> {
    return this.workflows.get(id) ?? null;
  }

  async listWorkflows(options?: WorkflowQueryOptions): Promise<QueryResult<StoredWorkflow>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const itemsAll = Array.from(this.workflows.values()).sort((a, b) => a.id.localeCompare(b.id));
    const items = itemsAll.slice(offset, offset + limit);

    return { items, total: itemsAll.length, limit, offset };
  }

  async deleteWorkflow(id: string): Promise<void> {
    this.workflows.delete(id);
  }

  async createExecution(execution: Execution): Promise<void> {
    this.executions.set(execution.executionId, execution);
  }

  async updateExecution(execution: Execution): Promise<void> {
    this.executions.set(execution.executionId, execution);
  }

  async getExecution(executionId: string): Promise<Execution | null> {
    return this.executions.get(executionId) ?? null;
  }

  async listExecutions(options?: ExecutionQueryOptions): Promise<QueryResult<Execution>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let itemsAll = Array.from(this.executions.values());

    if (options?.workflowId) {
      itemsAll = itemsAll.filter((e) => e.workflowId === options.workflowId);
    }

    if (options?.state) {
      const states = Array.isArray(options.state) ? options.state : [options.state];
      itemsAll = itemsAll.filter((e) => states.includes(e.state));
    }

    itemsAll.sort((a, b) => b.timestamps.createdAt.getTime() - a.timestamps.createdAt.getTime());

    const items = itemsAll.slice(offset, offset + limit);
    return { items, total: itemsAll.length, limit, offset };
  }

  async createTaskRun(taskRun: TaskRun): Promise<void> {
    this.taskRuns.set(`${taskRun.executionId}:${taskRun.taskId}`, taskRun);
  }

  async updateTaskRun(taskRun: TaskRun): Promise<void> {
    this.taskRuns.set(`${taskRun.executionId}:${taskRun.taskId}`, taskRun);
  }

  async getTaskRun(executionId: string, taskId: string): Promise<TaskRun | null> {
    return this.taskRuns.get(`${executionId}:${taskId}`) ?? null;
  }

  async listTaskRuns(options?: TaskRunQueryOptions): Promise<QueryResult<TaskRun>> {
    const limit = options?.limit ?? 10_000;
    const offset = options?.offset ?? 0;

    let itemsAll = Array.from(this.taskRuns.values());

    if (options?.executionId) {
      itemsAll = itemsAll.filter((tr) => tr.executionId === options.executionId);
    }
    if (options?.taskId) {
      itemsAll = itemsAll.filter((tr) => tr.taskId === options.taskId);
    }
    if (options?.state) {
      const states = Array.isArray(options.state) ? options.state : [options.state];
      itemsAll = itemsAll.filter((tr) => states.includes(tr.state));
    }

    itemsAll.sort((a, b) => a.taskId.localeCompare(b.taskId));

    const items = itemsAll.slice(offset, offset + limit);
    return { items, total: itemsAll.length, limit, offset };
  }

  async createAttempt(attempt: Attempt): Promise<void> {
    const list = this.attempts.get(attempt.taskRunId) ?? [];
    list.push(attempt);
    this.attempts.set(attempt.taskRunId, list);
  }

  async getAttempts(taskRunId: string, _options?: AttemptQueryOptions): Promise<Attempt[]> {
    return this.attempts.get(taskRunId) ?? [];
  }

  async getActiveExecutions(): Promise<Execution[]> {
    return Array.from(this.executions.values()).filter((e) => e.state === ExecutionState.RUNNING);
  }

  async getPendingExecutions(): Promise<Execution[]> {
    return [];
  }

  async deleteExecutionsBefore(_date: Date, _states?: ExecutionState[]): Promise<number> {
    return 0;
  }

  async updateExecutionAndTaskRuns(execution: Execution, taskRuns: TaskRun[]): Promise<void> {
    await this.updateExecution(execution);
    for (const tr of taskRuns) {
      await this.updateTaskRun(tr);
    }
  }
}

function authHeaders(key = 'k1'): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.run(`
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
  `);
  db.run(`CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);`);
  db.run(`CREATE INDEX idx_execution_logs_execution_timestamp ON execution_logs(execution_id, timestamp DESC, id DESC);`);
  return db;
}

const VALID_WORKFLOW_YAML = `apiVersion: v1
id: wf-1
enabled: true
tasks:
  - id: task-1
    type: example/plugin.action
    needs: []
`;

describe('Server API v1', () => {
  let store: InMemoryStateStore;
  let db: Database;

  beforeEach(() => {
    store = new InMemoryStateStore();
    db = createTestDb();
  });

  it('GET /health is public', async () => {
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
    expect(typeof body.timestamp).toBe('string');
  });

  it('auth rejects missing and invalid keys', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const missing = await app.fetch(new Request('http://localhost/api/v1/status'));
    expect(missing.status).toBe(401);
    expect((await missing.json()).error.code).toBe('UNAUTHORIZED');

    const invalid = await app.fetch(
      new Request('http://localhost/api/v1/status', { headers: authHeaders('nope') }),
    );
    expect(invalid.status).toBe(401);

    const bothHeaders = await app.fetch(
      new Request('http://localhost/api/v1/status', {
        headers: {
          Authorization: 'Bearer wrong',
          'X-API-Key': 'k1',
        },
      }),
    );
    expect(bothHeaders.status).toBe(401);
  });

  it('auth accepts valid key', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const res = await app.fetch(new Request('http://localhost/api/v1/status', { headers: authHeaders() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe('operational');
  });

  it('workflow CRUD: PUT/GET/LIST/PATCH/DELETE', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const put = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'text/yaml' },
        body: VALID_WORKFLOW_YAML,
      }),
    );
    expect([200, 201]).toContain(put.status);

    const get = await app.fetch(new Request('http://localhost/api/v1/workflows/wf-1', { headers: authHeaders() }));
    expect(get.status).toBe(200);
    const wf = await get.json();
    expect(wf.id).toBe('wf-1');
    expect(wf.enabled).toBe(true);

    const list = await app.fetch(new Request('http://localhost/api/v1/workflows?limit=10&offset=0', { headers: authHeaders() }));
    expect(list.status).toBe(200);
    const listed = await list.json();
    expect(listed.total).toBe(1);
    expect(listed.workflows[0].id).toBe('wf-1');

    const patch = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      }),
    );
    expect(patch.status).toBe(200);
    expect((await patch.json()).enabled).toBe(false);

    const del = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', { method: 'DELETE', headers: authHeaders() }),
    );
    expect(del.status).toBe(204);

    const missing = await app.fetch(new Request('http://localhost/api/v1/workflows/wf-1', { headers: authHeaders() }));
    expect(missing.status).toBe(404);
  });

  it('workflow apply enforces YAML and id match', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const wrongType = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
    expect(wrongType.status).toBe(415);

    const mismatch = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'text/yaml' },
        body: VALID_WORKFLOW_YAML.replace('id: wf-1', 'id: other'),
      }),
    );
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).error.code).toBe('WORKFLOW_ID_MISMATCH');
  });

  it('workflow trigger returns accepted with execution id', async () => {
    let triggered: { workflowId: string; executionId: string } | undefined;

    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
      triggerWorkflowExecution: async (input) => {
        triggered = input;
      },
    });

    const put = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'text/yaml' },
        body: VALID_WORKFLOW_YAML,
      }),
    );
    expect([200, 201]).toContain(put.status);

    const trigger = await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1/trigger', {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ executionId: 'exec-manual-1' }),
      }),
    );

    expect(trigger.status).toBe(202);
    const body = await trigger.json();
    expect(body.workflowId).toBe('wf-1');
    expect(body.executionId).toBe('exec-manual-1');
    expect(body.status).toBe('ACCEPTED');

    expect(triggered?.workflowId).toBe('wf-1');
    expect(triggered?.executionId).toBe('exec-manual-1');
  });

  it('plugin prepare endpoint returns prepared plugin list', async () => {
    let requestedName: string | undefined;

    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
      preparePluginDependencies: async ({ name }) => {
        requestedName = name;
        return { prepared: ['sample-plugin'], skipped: [], found: true };
      },
    });

    const res = await app.fetch(
      new Request('http://localhost/api/v1/plugins/prepare', {
        method: 'POST',
        headers: { ...authHeaders(), 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'sample-plugin' }),
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prepared).toBe(1);
    expect(body.plugins).toEqual(['sample-plugin']);
    expect(requestedName).toBe('sample-plugin');
  });

  it('executions list/inspect/logs work and logs are newest-first', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    // Need workflow for inspector task type mapping.
    await app.fetch(
      new Request('http://localhost/api/v1/workflows/wf-1', {
        method: 'PUT',
        headers: { ...authHeaders(), 'content-type': 'text/yaml' },
        body: VALID_WORKFLOW_YAML,
      }),
    );

    const exec = createInitialExecution('wf-1', 'exec-1');
    exec.state = ExecutionState.RUNNING;
    exec.metadata = { token: 'super-secret', safe: 'ok' };
    await store.createExecution(exec);

    const tr = createInitialTaskRun('exec-1', 'task-1');
    tr.state = TaskRunState.RUNNING;
    await store.createTaskRun(tr);

    const list = await app.fetch(new Request('http://localhost/api/v1/executions?limit=10&offset=0', { headers: authHeaders() }));
    expect(list.status).toBe(200);
    const listed = await list.json();
    expect(listed.total).toBe(1);
    expect(listed.executions[0].executionId).toBe('exec-1');

    const inspect = await app.fetch(new Request('http://localhost/api/v1/executions/exec-1', { headers: authHeaders() }));
    expect(inspect.status).toBe(200);
    const ins = await inspect.json();
    expect(ins.overview.executionId).toBe('exec-1');
    expect(ins.overview.workflowId).toBe('wf-1');
    expect(ins.overview.metadata.token).toBe('***MASKED***');
    expect(ins.tasks.length).toBe(1);
    expect(ins.tasks[0].taskId).toBe('task-1');

    const olderTs = 1000;
    const newerTs = 2000;

    db.prepare(
      `INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('exec-1', 'task-1', olderTs, 'INFO', 'worker', 'older', JSON.stringify({}));

    db.prepare(
      `INSERT INTO execution_logs (execution_id, task_id, timestamp, level, source, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('exec-1', 'task-1', newerTs, 'ERROR', 'worker', 'newer', JSON.stringify({ reason: 'boom' }));

    const logs = await app.fetch(
      new Request('http://localhost/api/v1/executions/exec-1/logs?limit=10&offset=0', { headers: authHeaders() }),
    );
    expect(logs.status).toBe(200);
    const logsBody = await logs.json();
    expect(logsBody.items.length).toBe(2);
    expect(logsBody.items[0].message).toBe('newer');
    expect(logsBody.items[0].timestamp).toBe(newerTs);

    const filtered = await app.fetch(
      new Request('http://localhost/api/v1/executions/exec-1/logs?level=ERROR', { headers: authHeaders() }),
    );
    expect(filtered.status).toBe(200);
    const filteredBody = await filtered.json();
    expect(filteredBody.items.length).toBe(1);
    expect(filteredBody.items[0].level).toBe('ERROR');
  });

  it('cancel transitions execution to CANCELLED', async () => {
    const app = createApp({
      version: 'test',
      startedAt: Date.now() - 5,
      apiKeys: ['k1'],
      stateStore: store,
      db,
    });

    const exec = createInitialExecution('wf-1', 'exec-2');
    exec.state = ExecutionState.RUNNING;
    await store.createExecution(exec);

    const res = await app.fetch(
      new Request('http://localhost/api/v1/executions/exec-2/cancel', { method: 'POST', headers: authHeaders() }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.executionId).toBe('exec-2');
    expect(body.state).toBe(ExecutionState.CANCELLED);

    const updated = await store.getExecution('exec-2');
    expect(updated?.state).toBe(ExecutionState.CANCELLED);
  });
});
