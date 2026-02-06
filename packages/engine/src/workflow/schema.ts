import {
  array,
  boolean,
  literal,
  number,
  object,
  optional,
  regex,
  safeParse,
  string,
  union,
  minValue,
  integer,
  minLength,
  type BaseSchema,
  pipe,
  check,
} from 'valibot';

import type { Workflow, WorkflowTask, WorkflowTrigger } from './model.js';
import type { WorkflowDiagnostic } from './diagnostics.js';

export const DEFAULT_API_VERSION = 'v1';
export const SUPPORTED_API_VERSIONS = [DEFAULT_API_VERSION] as const;

const taskTypeRegex = /^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9-]+$/;

export const retrySchema = object({
  max: minValue(integer(number()), 1),
  backoffSeconds: optional(minValue(integer(number()), 0)),
});

export const taskSchema = object({
  id: minLength(string(), 1),
  type: pipe(string(), check((value) => taskTypeRegex.test(value), 'Task type must match namespace/plugin.action format')),
  needs: optional(array(minLength(string(), 1))),
  retry: optional(retrySchema),
});

export const cronTriggerSchema = object({
  type: literal('cron'),
  cron: minLength(string(), 1),
});

export const webhookTriggerSchema = object({
  type: literal('webhook'),
  path: minLength(string(), 1),
  method: optional(union([
    literal('GET'),
    literal('POST'),
    literal('PUT'),
    literal('PATCH'),
    literal('DELETE'),
  ])),
});

export const triggerSchema = union([cronTriggerSchema, webhookTriggerSchema]);

export const workflowSchema = object({
  id: minLength(string(), 1),
  enabled: optional(boolean()),
  trigger: optional(triggerSchema),
  tasks: array(taskSchema),
  apiVersion: optional(minLength(string(), 1)),
  version: optional(minLength(string(), 1)),
});

function toPathString(valibotPath: any[] | undefined): string {
  if (!valibotPath || valibotPath.length === 0) return '';

  let result = '';
  for (const segment of valibotPath) {
    const key = segment?.key;
    if (typeof key === 'number') {
      result += `[${key}]`;
    } else if (typeof key === 'string') {
      result += result ? `.${key}` : key;
    }
  }
  return result;
}

export function validateWorkflowShape(input: unknown): { success: true; output: any } | { success: false; diagnostics: WorkflowDiagnostic[] } {
  const result = safeParse(workflowSchema, input);
  if (result.success) {
    return { success: true, output: result.output };
  }

  const diagnostics: WorkflowDiagnostic[] = result.issues.map(issue => ({
    severity: 'error',
    path: toPathString(issue.path),
    message: issue.message,
  }));

  return { success: false, diagnostics };
}

export function getTaskTypePattern(): RegExp {
  return taskTypeRegex;
}

export type ValibotSchema<T> = BaseSchema<T, any, any>;

export function isSupportedApiVersion(value: string): value is (typeof SUPPORTED_API_VERSIONS)[number] {
  return (SUPPORTED_API_VERSIONS as readonly string[]).includes(value);
}

export function resolveApiVersion(parsed: any): string {
  const explicit = parsed?.apiVersion ?? parsed?.version;
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    return explicit;
  }
  return DEFAULT_API_VERSION;
}

export function normalizeWorkflow(parsed: any, filePath: string): Workflow {
  const apiVersion = resolveApiVersion(parsed);

  const trigger = parsed.trigger as WorkflowTrigger | undefined;
  const tasksRaw = (parsed.tasks ?? []) as WorkflowTask[];

  const tasks: WorkflowTask[] = tasksRaw.map(t => ({
    id: t.id,
    type: t.type,
    needs: Array.isArray((t as any).needs) ? (t as any).needs : [],
    retry: t.retry,
  }));

  return {
    apiVersion,
    id: parsed.id,
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
    trigger,
    tasks,
    source: { filePath },
  };
}
