import { Hono } from 'hono';
import { logger } from 'hono/logger';

import type { Database } from 'bun:sqlite';
import type { StateStore, StoredWorkflow } from '@autokestra/engine/src/storage/types';
import { ExecutionState } from '@autokestra/engine/src/execution/types';
import { ExecutionInspector } from '@autokestra/engine/src/execution/inspector';
import { LogStore } from '@autokestra/engine/src/execution/logging/store';
import { parseWorkflowContent } from '@autokestra/engine/src/workflow/loader';
import { WorkflowParseError, WorkflowValidationError } from '@autokestra/engine/src/workflow/errors';

import type { SecretStore } from '@autokestra/secrets';

import { createApiKeyAuthMiddleware } from './auth';
import { apiError } from './errors';

export interface ServerContext {
  version: string;
  startedAt: number;
  apiKeys: string[];
  stateStore: StateStore;
  db: Database;
  secretStore: SecretStore;
  triggerWorkflowExecution?: (input: { workflowId: string; executionId: string }) => Promise<void>;
  preparePluginDependencies?: (input: { name?: string }) => Promise<{ prepared: string[]; skipped: string[]; found: boolean }>;
}

function toWorkflowDto(workflow: StoredWorkflow) {
  return {
    id: workflow.id,
    enabled: workflow.enabled,
    definition: workflow.definition,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

function parseOptionalBooleanParam(url: URL, name: string): boolean | undefined {
  const raw = url.searchParams.get(name);
  if (raw == null) return undefined;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`Invalid ${name}`);
}

function parseLimitOffset(url: URL, defaults: { limit: number; maxLimit: number }) {
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');

  let limit = defaults.limit;
  let offset = 0;

  if (limitRaw != null) {
    const value = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Invalid limit');
    }
    limit = Math.min(value, defaults.maxLimit);
  }

  if (offsetRaw != null) {
    const value = Number.parseInt(offsetRaw, 10);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Invalid offset');
    }
    offset = value;
  }

  return { limit, offset };
}

function getLevels(url: URL): string[] | undefined {
  const levels = url.searchParams.getAll('level').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  return levels.length > 0 ? levels : undefined;
}

export function createApp(ctx: ServerContext) {
  const app = new Hono();

  app.use('*', logger());

  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth only for API v1.
  app.use('/api/v1/*', createApiKeyAuthMiddleware(ctx.apiKeys));

  app.get('/api/v1/status', (c) => {
    return c.json({
      state: 'operational',
      version: ctx.version,
      uptimeMs: Date.now() - ctx.startedAt,
    });
  });

  // Secrets
  app.get('/api/v1/secrets', async (c) => {
    try {
      const items = ctx.secretStore.list();
      return c.json({
        secrets: items.map((s) => ({
          name: s.name,
          createdAt: new Date(s.created_at).toISOString(),
          updatedAt: new Date(s.updated_at).toISOString(),
        })),
        total: items.length,
      });
    } catch (error) {
      return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to list secrets'), 500);
    }
  });

  app.put('/api/v1/secrets/:name', async (c) => {
    const name = c.req.param('name');
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError('BAD_REQUEST', 'Expected JSON body'), 400);
    }

    const value = (body as any)?.value;
    if (typeof value !== 'string' || value.trim().length === 0) {
      return c.json(apiError('VALIDATION_ERROR', 'Body must be { "value": string } (non-empty)'), 400);
    }

    try {
      await ctx.secretStore.set(name, value);
      return c.body(null, 204);
    } catch (error) {
      return c.json(apiError('BAD_REQUEST', error instanceof Error ? error.message : 'Failed to set secret'), 400);
    }
  });

  app.get('/api/v1/secrets/:name', async (c) => {
    const name = c.req.param('name');
    try {
      const value = await ctx.secretStore.get(name);
      if (value === null) {
        return c.json(apiError('NOT_FOUND', `Secret '${name}' not found`), 404);
      }
      return c.json({ name, value });
    } catch (error) {
      return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to get secret'), 500);
    }
  });

  app.delete('/api/v1/secrets/:name', async (c) => {
    const name = c.req.param('name');
    try {
      const deleted = ctx.secretStore.delete(name);
      if (!deleted) {
        return c.json(apiError('NOT_FOUND', `Secret '${name}' not found`), 404);
      }
      return c.body(null, 204);
    } catch (error) {
      return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to delete secret'), 500);
    }
  });

  // Workflows
  app.get('/api/v1/workflows', async (c) => {
    try {
      const url = new URL(c.req.url);
      const { limit, offset } = parseLimitOffset(url, { limit: 50, maxLimit: 200 });

      const enabled = parseOptionalBooleanParam(url, 'enabled');

      const result = await ctx.stateStore.listWorkflows({ enabled, limit, offset });
      return c.json({
        workflows: result.items.map(toWorkflowDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    } catch (error) {
      return c.json(apiError('BAD_REQUEST', error instanceof Error ? error.message : 'Bad request'), 400);
    }
  });

  app.get('/api/v1/workflows/:id', async (c) => {
    const id = c.req.param('id');
    const workflow = await ctx.stateStore.getWorkflow(id);
    if (!workflow) {
      return c.json(apiError('NOT_FOUND', `Workflow '${id}' not found`), 404);
    }
    return c.json(toWorkflowDto(workflow));
  });

  app.put('/api/v1/workflows/:id', async (c) => {
    const id = c.req.param('id');

    const contentType = (c.req.header('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'text/yaml' && contentType !== 'application/yaml') {
      return c.json(apiError('UNSUPPORTED_MEDIA_TYPE', 'Expected Content-Type text/yaml or application/yaml'), 415);
    }

    const body = await c.req.text();
    try {
      const workflow = parseWorkflowContent(body, `api:${id}`);
      if (workflow.id !== id) {
        return c.json(
          apiError('WORKFLOW_ID_MISMATCH', `URL id '${id}' does not match YAML id '${workflow.id}'`),
          400,
        );
      }

      const existing = await ctx.stateStore.getWorkflow(id);
      const now = new Date();

      await ctx.stateStore.saveWorkflow({
        id,
        definition: workflow,
        enabled: workflow.enabled,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });

      const stored = await ctx.stateStore.getWorkflow(id);
      return c.json(toWorkflowDto(stored!), existing ? 200 : 201);
    } catch (error) {
      if (error instanceof WorkflowParseError) {
        return c.json(apiError('WORKFLOW_PARSE_ERROR', error.message), 400);
      }
      if (error instanceof WorkflowValidationError) {
        return c.json(apiError('WORKFLOW_VALIDATION_ERROR', error.message, { diagnostics: error.diagnostics }), 400);
      }
      return c.json(apiError('INTERNAL_ERROR', 'Failed to apply workflow'), 500);
    }
  });

  app.delete('/api/v1/workflows/:id', async (c) => {
    const id = c.req.param('id');
    const existing = await ctx.stateStore.getWorkflow(id);
    if (!existing) {
      return c.json(apiError('NOT_FOUND', `Workflow '${id}' not found`), 404);
    }

    await ctx.stateStore.deleteWorkflow(id);
    return c.body(null, 204);
  });

  app.patch(
    '/api/v1/workflows/:id',
    async (c) => {
      const id = c.req.param('id');
      const existing = await ctx.stateStore.getWorkflow(id);
      if (!existing) {
        return c.json(apiError('NOT_FOUND', `Workflow '${id}' not found`), 404);
      }

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json(apiError('BAD_REQUEST', 'Expected JSON body'), 400);
      }

      const enabled = (body as any)?.enabled;
      if (typeof enabled !== 'boolean') {
        return c.json(apiError('VALIDATION_ERROR', 'Body must be { "enabled": boolean }'), 400);
      }
      const now = new Date();

      await ctx.stateStore.saveWorkflow({
        ...existing,
        enabled,
        updatedAt: now,
      });

      const stored = await ctx.stateStore.getWorkflow(id);
      return c.json(toWorkflowDto(stored!));
    },
  );

  app.post('/api/v1/workflows/:id/trigger', async (c) => {
    const workflowId = c.req.param('id');
    const workflow = await ctx.stateStore.getWorkflow(workflowId);
    if (!workflow) {
      return c.json(apiError('NOT_FOUND', `Workflow '${workflowId}' not found`), 404);
    }

    if (!workflow.enabled) {
      return c.json(apiError('WORKFLOW_DISABLED', `Workflow '${workflowId}' is disabled`), 409);
    }

    if (!ctx.triggerWorkflowExecution) {
      return c.json(apiError('NOT_IMPLEMENTED', 'Workflow triggering is not available in this server mode'), 501);
    }

    let executionId = crypto.randomUUID();
    try {
      const contentType = c.req.header('content-type') || '';
      if (contentType.toLowerCase().includes('application/json')) {
        const body = await c.req.json();
        const candidate = (body as any)?.executionId;
        if (candidate !== undefined) {
          if (typeof candidate !== 'string' || candidate.trim().length === 0) {
            return c.json(apiError('VALIDATION_ERROR', 'executionId must be a non-empty string when provided'), 400);
          }
          executionId = candidate.trim();
        }
      }
    } catch {
      return c.json(apiError('BAD_REQUEST', 'Expected JSON body when Content-Type is application/json'), 400);
    }

    try {
      await ctx.triggerWorkflowExecution({ workflowId, executionId });
    } catch (error) {
      return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to trigger workflow'), 500);
    }

    return c.json({ workflowId, executionId, status: 'ACCEPTED' }, 202);
  });

  app.post('/api/v1/plugins/prepare', async (c) => {
    if (!ctx.preparePluginDependencies) {
      return c.json(apiError('NOT_IMPLEMENTED', 'Plugin preparation is not available in this server mode'), 501);
    }

    let body: any = {};
    try {
      const contentType = (c.req.header('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      }
    } catch {
      return c.json(apiError('BAD_REQUEST', 'Expected JSON body when Content-Type is application/json'), 400);
    }

    const nameRaw = body?.name;
    if (nameRaw !== undefined && (typeof nameRaw !== 'string' || nameRaw.trim().length === 0)) {
      return c.json(apiError('VALIDATION_ERROR', 'name must be a non-empty string when provided'), 400);
    }

    const name = typeof nameRaw === 'string' ? nameRaw.trim() : undefined;

    try {
      const result = await ctx.preparePluginDependencies({ name });
      if (!result.found) {
        return c.json(apiError('NOT_FOUND', name ? `Plugin '${name}' not found` : 'No plugins found'), 404);
      }
      return c.json({ prepared: result.prepared.length, plugins: result.prepared, skipped: result.skipped });
    } catch (error) {
      return c.json(apiError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to prepare plugins'), 500);
    }
  });

  // Executions
  app.get('/api/v1/executions', async (c) => {
    try {
      const url = new URL(c.req.url);
      const { limit, offset } = parseLimitOffset(url, { limit: 50, maxLimit: 200 });

      const workflowId = url.searchParams.get('workflowId') ?? undefined;
      const stateParam = url.searchParams.get('state');
      const state = stateParam
        ? stateParam.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      const result = await ctx.stateStore.listExecutions({
        workflowId,
        state: state && state.length === 1 ? (state[0] as any) : (state as any),
        limit,
        offset,
      });

      return c.json({
        executions: result.items.map((e) => ({
          executionId: e.executionId,
          workflowId: e.workflowId,
          state: e.state,
          reasonCode: e.reasonCode,
          message: e.message,
          createdAt: e.timestamps.createdAt.toISOString(),
          startedAt: e.timestamps.startedAt?.toISOString(),
          endedAt: e.timestamps.endedAt?.toISOString(),
          updatedAt: e.timestamps.updatedAt.toISOString(),
        })),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    } catch (error) {
      return c.json(apiError('BAD_REQUEST', error instanceof Error ? error.message : 'Bad request'), 400);
    }
  });

  app.get('/api/v1/executions/:executionId', async (c) => {
    const executionId = c.req.param('executionId');

    const url = new URL(c.req.url);
    const includeInputsOutputs = parseOptionalBooleanParam(url, 'includeInputsOutputs') ?? false;
    const includeAuditTrail = parseOptionalBooleanParam(url, 'includeAuditTrail') ?? false;
    const includeTimeline = parseOptionalBooleanParam(url, 'includeTimeline') ?? false;
    const taskId = url.searchParams.get('taskId') ?? undefined;

    const logStore = new LogStore({ db: ctx.db });
    const inspector = new ExecutionInspector(ctx.stateStore, logStore);

    const overview = await inspector.getExecutionOverview(executionId);
    if (!overview) {
      return c.json(apiError('NOT_FOUND', `Execution '${executionId}' not found`), 404);
    }

    const tasks = await inspector.getTaskDetails(executionId);

    const response: any = { overview, tasks };
    if (includeInputsOutputs) {
      response.inputsOutputs = await inspector.getTaskInputsOutputs(executionId, taskId);
    }
    if (includeAuditTrail) {
      response.auditTrail = inspector.getAuditTrail(executionId);
    }
    if (includeTimeline) {
      response.timeline = await inspector.getTimeline(executionId);
    }

    return c.json(response);
  });

  app.post('/api/v1/executions/cleanup', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError('BAD_REQUEST', 'Expected JSON body'), 400);
    }

    const daysRaw = (body as any)?.days;
    const dryRun = Boolean((body as any)?.dryRun);
    const statesRaw = (body as any)?.states;

    const days = daysRaw == null ? 30 : Number(daysRaw);
    if (!Number.isFinite(days) || days <= 0) {
      return c.json(apiError('VALIDATION_ERROR', 'days must be a positive number'), 400);
    }

    let states: ExecutionState[] | undefined;
    if (statesRaw != null) {
      if (!Array.isArray(statesRaw) || !statesRaw.every((s) => typeof s === 'string')) {
        return c.json(apiError('VALIDATION_ERROR', 'states must be an array of strings'), 400);
      }
      states = statesRaw as ExecutionState[];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Math.floor(days));

    if (dryRun) {
      const result = await ctx.stateStore.listExecutions({
        createdBefore: cutoffDate,
        state: states as any,
        limit: 1,
        offset: 0,
      });
      return c.json({
        dryRun: true,
        cutoffDate: cutoffDate.toISOString(),
        states,
        wouldDelete: result.total,
      });
    }

    const deleted = await ctx.stateStore.deleteExecutionsBefore(cutoffDate, states);
    return c.json({
      dryRun: false,
      cutoffDate: cutoffDate.toISOString(),
      states,
      deleted,
    });
  });

  app.get('/api/v1/executions/:executionId/logs', async (c) => {
    const executionId = c.req.param('executionId');
    const execution = await ctx.stateStore.getExecution(executionId);
    if (!execution) {
      return c.json(apiError('NOT_FOUND', `Execution '${executionId}' not found`), 404);
    }

    try {
      const url = new URL(c.req.url);
      const { limit, offset } = parseLimitOffset(url, { limit: 100, maxLimit: 1000 });
      const taskId = url.searchParams.get('taskId') ?? undefined;
      const levels = getLevels(url);

      // Query newest-first with offset/limit based from newest.
      let query = `
        SELECT id, execution_id, task_id, timestamp, level, source, message, metadata
        FROM execution_logs
        WHERE execution_id = ?
      `;
      const params: any[] = [executionId];

      if (taskId) {
        query += ` AND task_id = ?`;
        params.push(taskId);
      }

      if (levels && levels.length > 0) {
        const placeholders = levels.map(() => '?').join(',');
        query += ` AND level IN (${placeholders})`;
        params.push(...levels);
      }

      query += ` ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`;
      params.push(limit + 1, offset);

      const stmt = ctx.db.prepare(query);
      const rows = stmt.all(...params) as any[];
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);

      const items = page.map((row) => ({
        id: row.id,
        executionId: row.execution_id,
        taskId: row.task_id ?? undefined,
        timestamp: row.timestamp,
        level: row.level,
        source: row.source,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

      return c.json({ items, limit, offset, hasMore });
    } catch (error) {
      return c.json(apiError('BAD_REQUEST', error instanceof Error ? error.message : 'Bad request'), 400);
    }
  });

  app.post('/api/v1/executions/:executionId/cancel', async (c) => {
    const executionId = c.req.param('executionId');
    const existing = await ctx.stateStore.getExecution(executionId);
    if (!existing) {
      return c.json(apiError('NOT_FOUND', `Execution '${executionId}' not found`), 404);
    }

    const now = new Date();
    const cancelled = {
      ...existing,
      state: ExecutionState.CANCELLED,
      reasonCode: 'USER_CANCELLED' as const,
      message: existing.message ?? 'Cancelled by API request',
      timestamps: {
        ...existing.timestamps,
        endedAt: now,
        updatedAt: now,
      },
    };

    await ctx.stateStore.updateExecution(cancelled);

    return c.json({
      executionId,
      state: cancelled.state,
      reasonCode: cancelled.reasonCode,
      endedAt: cancelled.timestamps.endedAt?.toISOString(),
    });
  });

  app.onError((err, c) => {
    // Avoid leaking details by default.
    return c.json(apiError('INTERNAL_ERROR', 'Internal server error'), 500);
  });

  app.notFound((c) => {
    return c.json(apiError('NOT_FOUND', 'Route not found'), 404);
  });

  return app;
}
