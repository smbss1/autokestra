import { formatDiagnostics } from './diagnostics.js';
import { WorkflowValidationError } from './errors.js';
import type { WorkflowDiagnostic } from './diagnostics.js';
import type { Workflow } from './model.js';
import type { WorkflowPluginRegistry } from './pluginRegistry.js';
import { validateWorkflowSemantics } from './semanticValidation.js';
import type { SecretStore } from '@autokestra/secrets';

export interface ValidateWorkflowOptions {
  pluginRegistry?: WorkflowPluginRegistry;
  secretStore?: SecretStore;
}

export function validateWorkflow(workflow: Workflow, options: ValidateWorkflowOptions = {}): void {
  const diagnostics: WorkflowDiagnostic[] = [];

  diagnostics.push(...validateWorkflowSemantics(workflow));

  if (options.pluginRegistry) {
    workflow.tasks.forEach((task, index) => {
      if (!options.pluginRegistry!.hasTaskType(task.type)) {
        diagnostics.push({
          severity: 'error',
          path: `tasks[${index}].type`,
          message: `Unknown task type '${task.type}'`,
        });
      }
    });
  }

  if (options.secretStore && workflow.secrets) {
    for (const secretName of workflow.secrets) {
      if (options.secretStore.get(secretName) === null && !process.env[secretName]) {
        diagnostics.push({
          severity: 'error',
          path: 'secrets',
          message: `Declared secret '${secretName}' not found in store or environment`,
        });
      }
    }
  }

  if (diagnostics.length > 0) {
    throw new WorkflowValidationError(
      `Workflow semantic validation failed:\n${formatDiagnostics(diagnostics, workflow.source.filePath)}`,
      workflow.source.filePath,
      diagnostics,
    );
  }
}
