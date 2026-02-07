import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseWorkflowFile, validateWorkflow, WorkflowValidationError, WorkflowLoadError, WorkflowParseError } from './workflow/index.js';

describe('Workflow DSL', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = join(tmpdir(), `workflow-${Date.now()}.yaml`);
  });

  afterEach(() => {
    try {
      unlinkSync(tempFile);
    } catch {
      // ignore
    }
  });

  describe('YAML loading errors', () => {
    it('should throw WorkflowLoadError for missing file', () => {
      expect(() => parseWorkflowFile('/nonexistent/file.yaml')).toThrow(WorkflowLoadError);
    });

    it('should throw WorkflowParseError for invalid YAML', () => {
      writeFileSync(tempFile, 'invalid: yaml: content: [');

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowParseError);
    });
  });

  describe('Schema validation failures', () => {
    it('should throw WorkflowValidationError for missing id', () => {
      const yaml = `
enabled: true
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for invalid task type format', () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: invalid-type
`;
      writeFileSync(tempFile, yaml);

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for forbidden secrets key', () => {
      const yaml = `
id: test-workflow
secrets:
  apiKey: secret-value
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowValidationError);
    });
  });

  describe('DAG validation failures', () => {
    it('should throw WorkflowValidationError for empty tasks', async () => {
      const yaml = `
id: test-workflow
tasks: []
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow)).rejects.toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for duplicate task ids', async () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow)).rejects.toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for unknown dependency', async () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
    needs: [missing-task]
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow)).rejects.toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for dependency cycle', async () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
    needs: [task2]
  - id: task2
    type: example/plugin.action
    needs: [task1]
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow)).rejects.toThrow(WorkflowValidationError);
    });
  });

  describe('Unknown keys rejection', () => {
    it('should throw WorkflowValidationError for unknown top-level key', () => {
      const yaml = `
id: test-workflow
unknownKey: value
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for unknown task key', () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
    unknownKey: value
`;
      writeFileSync(tempFile, yaml);

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowValidationError);
    });
  });

  describe('Version handling', () => {
    it('should default to v1 when no version specified', () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      expect(workflow.apiVersion).toBe('v1');
    });

    it('should use apiVersion when specified', () => {
      const yaml = `
apiVersion: v1
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      expect(workflow.apiVersion).toBe('v1');
    });

    it('should throw WorkflowValidationError for unsupported version', () => {
      const yaml = `
apiVersion: v2
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      expect(() => parseWorkflowFile(tempFile)).toThrow(WorkflowValidationError);
    });
  });

  describe('Plugin registry validation', () => {
    const mockRegistry = {
      hasTaskType: (type: string) => type === 'example/plugin.action',
    };

    it('should pass validation when task type exists in registry', async () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: example/plugin.action
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow, { pluginRegistry: mockRegistry })).resolves.toBeUndefined();
    });

    it('should throw WorkflowValidationError when task type does not exist in registry', async () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: unknown/plugin.action
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow, { pluginRegistry: mockRegistry })).rejects.toThrow(WorkflowValidationError);
    });

    it('should skip plugin validation when no registry provided', async () => {
      const yaml = `
id: test-workflow
tasks:
  - id: task1
    type: unknown/plugin.action
`;
      writeFileSync(tempFile, yaml);

      const workflow = parseWorkflowFile(tempFile);
      await expect(validateWorkflow(workflow)).resolves.toBeUndefined();
    });
  });
});
