import type { WorkflowDiagnostic } from './diagnostics.js';

export class WorkflowLoadError extends Error {
  constructor(message: string, public readonly filePath: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WorkflowLoadError';
  }
}

export class WorkflowParseError extends Error {
  constructor(message: string, public readonly filePath: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WorkflowParseError';
  }
}

export class WorkflowValidationError extends Error {
  constructor(message: string, public readonly filePath: string, public readonly diagnostics: WorkflowDiagnostic[]) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}
