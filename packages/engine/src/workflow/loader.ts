import { readFileSync } from 'fs';
import { parse } from 'yaml';

import { formatDiagnostics } from './diagnostics.js';
import { WorkflowLoadError, WorkflowParseError, WorkflowValidationError } from './errors.js';
import { collectUnknownKeys } from './strictKeys.js';
import { isSupportedApiVersion, normalizeWorkflow, resolveApiVersion, validateWorkflowShape } from './schema.js';
import type { Workflow } from './model.js';
import type { WorkflowDiagnostic } from './diagnostics.js';

const ALLOWED_TOP_LEVEL_KEYS = ['apiVersion', 'version', 'id', 'enabled', 'trigger', 'tasks'] as const;
const ALLOWED_TRIGGER_KEYS = ['type', 'cron', 'path', 'method'] as const;
const ALLOWED_TASK_KEYS = ['id', 'type', 'needs', 'retry'] as const;
const ALLOWED_RETRY_KEYS = ['max', 'backoffSeconds'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function strictKeyDiagnostics(parsed: unknown): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = [];

  diagnostics.push(...collectUnknownKeys(parsed, ALLOWED_TOP_LEVEL_KEYS, ''));

  if (isPlainObject(parsed) && 'trigger' in parsed) {
    const trigger = (parsed as any).trigger;
    if (trigger != null) {
      diagnostics.push(...collectUnknownKeys(trigger, ALLOWED_TRIGGER_KEYS, 'trigger'));
    }
  }

  if (isPlainObject(parsed) && Array.isArray((parsed as any).tasks)) {
    const tasks = (parsed as any).tasks as unknown[];
    tasks.forEach((task, index) => {
      diagnostics.push(...collectUnknownKeys(task, ALLOWED_TASK_KEYS, `tasks[${index}]`));
      if (isPlainObject(task) && isPlainObject((task as any).retry)) {
        diagnostics.push(...collectUnknownKeys((task as any).retry, ALLOWED_RETRY_KEYS, `tasks[${index}].retry`));
      }
    });
  }

  if (isPlainObject(parsed) && 'secrets' in parsed) {
    diagnostics.push({
      severity: 'error',
      path: 'secrets',
      message: 'Forbidden key: secrets must not be defined in workflow YAML',
    });
  }

  return diagnostics;
}

export function parseWorkflowYaml(fileContent: string, filePath: string): unknown {
  try {
    return parse(fileContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WorkflowParseError(`YAML parse error: ${message}`, filePath, error as Error);
  }
}

export function parseWorkflowFile(filePath: string): Workflow {
  let fileContent: string;
  try {
    fileContent = readFileSync(filePath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new WorkflowLoadError(`Failed to read workflow file: ${message}`, filePath, error as Error);
  }

  const parsed = parseWorkflowYaml(fileContent, filePath);

  if (!parsed || typeof parsed !== 'object') {
    throw new WorkflowValidationError('Workflow YAML must be a mapping/object at the top level', filePath, [
      { severity: 'error', path: '', message: 'Expected an object at the top level' },
    ]);
  }

  const diagnostics: WorkflowDiagnostic[] = [];
  diagnostics.push(...strictKeyDiagnostics(parsed));

  const shape = validateWorkflowShape(parsed);
  if (!shape.success) {
    diagnostics.push(...shape.diagnostics);
  }

  const apiVersion = resolveApiVersion(parsed);
  if (!isSupportedApiVersion(apiVersion)) {
    diagnostics.push({
      severity: 'error',
      path: 'apiVersion',
      message: `Unsupported workflow apiVersion '${apiVersion}'. Supported: ${SUPPORTED_VERSIONS_FOR_MESSAGE()}`,
    });
  }

  if (diagnostics.length > 0) {
    throw new WorkflowValidationError(`Workflow validation failed:\n${formatDiagnostics(diagnostics, filePath)}`,
      filePath,
      diagnostics,
    );
  }

  return normalizeWorkflow(shape.success ? shape.output : parsed, filePath);
}

function SUPPORTED_VERSIONS_FOR_MESSAGE(): string {
  // avoid importing constants to keep loader focused
  return 'v1';
}
