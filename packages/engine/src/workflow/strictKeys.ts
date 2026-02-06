import type { WorkflowDiagnostic } from './diagnostics.js';

type PlainObject = Record<string, unknown>;

export function collectUnknownKeys(
  obj: unknown,
  allowedKeys: readonly string[],
  pathPrefix: string,
): WorkflowDiagnostic[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];

  const diagnostics: WorkflowDiagnostic[] = [];
  for (const key of Object.keys(obj as PlainObject)) {
    if (!allowedKeys.includes(key)) {
      diagnostics.push({
        severity: 'error',
        path: pathPrefix ? `${pathPrefix}.${key}` : key,
        message: `Unknown key '${key}' is not allowed`,
      });
    }
  }
  return diagnostics;
}
