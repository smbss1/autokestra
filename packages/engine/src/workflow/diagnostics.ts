export type DiagnosticSeverity = 'error' | 'warning';

export interface WorkflowDiagnostic {
  severity: DiagnosticSeverity;
  path: string;
  message: string;
}

export function formatDiagnostic(diagnostic: WorkflowDiagnostic, filePath?: string): string {
  const location = filePath ? `${filePath}: ` : '';
  const path = diagnostic.path ? `${diagnostic.path}: ` : '';
  return `${location}${path}${diagnostic.message}`;
}

export function formatDiagnostics(diagnostics: WorkflowDiagnostic[], filePath?: string): string {
  return diagnostics.map(d => formatDiagnostic(d, filePath)).join('\n');
}
