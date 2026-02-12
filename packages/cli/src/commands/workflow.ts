// CLI commands for workflow management (server API client)

import * as fs from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { ApiClientConfig, ApiError, requestJson } from '../apiClient';

export interface CliConfig {
  api: ApiClientConfig;
}

export interface WorkflowListOptions {
  enabled?: boolean;
  limit?: number;
  offset?: number;
  json?: boolean;
}

export interface WorkflowApplyOptions {
  enabled?: boolean;
  json?: boolean;
  idOverride?: string;
}

export interface WorkflowGetOptions {
  json?: boolean;
}

export interface WorkflowDeleteOptions {
  json?: boolean;
}

export interface WorkflowTriggerOptions {
  json?: boolean;
  executionId?: string;
}

type WorkflowDto = {
  id: string;
  enabled: boolean;
  definition: any;
  createdAt: string;
  updatedAt: string;
};

type WorkflowTriggerResponseDto = {
  workflowId: string;
  executionId: string;
  status: 'ACCEPTED';
};

function toHumanLine(wf: WorkflowDto): string {
  return `${wf.id}\t${wf.enabled ? 'enabled' : 'disabled'}\tupdated ${wf.updatedAt}`;
}

export async function listWorkflows(config: CliConfig, options: WorkflowListOptions = {}): Promise<void> {
  const result = await requestJson<{
    workflows: WorkflowDto[];
    total: number;
    limit: number;
    offset: number;
  }>(config.api, 'GET', '/api/v1/workflows', {
    query: {
      enabled: options.enabled,
      limit: options.limit,
      offset: options.offset,
    },
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.total === 0) {
    console.log('No workflows found');
    return;
  }

  for (const wf of result.workflows) {
    console.log(toHumanLine(wf));
  }
}

export async function getWorkflow(config: CliConfig, id: string, options: WorkflowGetOptions = {}): Promise<{ found: boolean }>{
  try {
    const wf = await requestJson<WorkflowDto>(config.api, 'GET', `/api/v1/workflows/${encodeURIComponent(id)}`);
    if (options.json) {
      console.log(JSON.stringify({ workflow: wf }, null, 2));
    } else {
      console.log(`${wf.id} (${wf.enabled ? 'enabled' : 'disabled'})`);
    }
    return { found: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      if (options.json) {
        console.log(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Workflow '${id}' not found` } }, null, 2));
      } else {
        console.error(`Workflow '${id}' not found`);
      }
      return { found: false };
    }
    throw error;
  }
}

export async function applyWorkflow(
  config: CliConfig,
  filePath: string,
  options: WorkflowApplyOptions = {},
): Promise<{ id: string; created: boolean }> {
  const raw = await fs.readFile(filePath, 'utf8');
  const doc: any = parse(raw);
  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid workflow YAML (expected a mapping)');
  }

  const id = String(options.idOverride ?? doc.id ?? '').trim();
  if (!id) {
    throw new Error('Workflow id is required (set top-level `id:` or pass --id)');
  }
  doc.id = id;

  if (options.enabled !== undefined) {
    doc.enabled = options.enabled;
  }

  const yamlToSend = stringify(doc);

  let existed = false;
  try {
    await requestJson<WorkflowDto>(config.api, 'GET', `/api/v1/workflows/${encodeURIComponent(id)}`);
    existed = true;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      throw error;
    }
  }

  const applied = await requestJson<WorkflowDto>(config.api, 'PUT', `/api/v1/workflows/${encodeURIComponent(id)}`, {
    rawBody: yamlToSend,
    contentType: 'text/yaml',
  });

  const created = !existed;

  if (options.json) {
    console.log(JSON.stringify({ created, workflow: applied }, null, 2));
  } else {
    console.log(`Applied workflow '${id}'`);
  }

  return { id, created };
}

export async function deleteWorkflow(
  config: CliConfig,
  id: string,
  options: WorkflowDeleteOptions = {},
): Promise<{ deleted: boolean }> {
  try {
    await requestJson<void>(config.api, 'DELETE', `/api/v1/workflows/${encodeURIComponent(id)}`);

    if (options.json) {
      console.log(JSON.stringify({ deleted: true, id }, null, 2));
    } else {
      console.log(`Deleted workflow '${id}'`);
    }

    return { deleted: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      if (options.json) {
        console.log(
          JSON.stringify({ deleted: false, error: { code: 'NOT_FOUND', message: `Workflow '${id}' not found` } }, null, 2),
        );
      } else {
        console.error(`Workflow '${id}' not found`);
      }
      return { deleted: false };
    }
    throw error;
  }
}

export async function triggerWorkflow(
  config: CliConfig,
  id: string,
  options: WorkflowTriggerOptions = {},
): Promise<{ triggered: boolean; executionId?: string; reason?: 'not_found' | 'disabled' }> {
  try {
    const result = await requestJson<WorkflowTriggerResponseDto>(
      config.api,
      'POST',
      `/api/v1/workflows/${encodeURIComponent(id)}/trigger`,
      {
        body: options.executionId ? { executionId: options.executionId } : {},
      },
    );

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Triggered workflow '${id}' (execution: ${result.executionId})`);
    }

    return { triggered: true, executionId: result.executionId };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      if (options.json) {
        console.log(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Workflow '${id}' not found` } }, null, 2));
      } else {
        console.error(`Workflow '${id}' not found`);
      }
      return { triggered: false, reason: 'not_found' };
    }

    if (error instanceof ApiError && error.status === 409) {
      if (options.json) {
        console.log(JSON.stringify({ error: { code: 'WORKFLOW_DISABLED', message: `Workflow '${id}' is disabled` } }, null, 2));
      } else {
        console.error(`Workflow '${id}' is disabled`);
      }
      return { triggered: false, reason: 'disabled' };
    }

    throw error;
  }
}
