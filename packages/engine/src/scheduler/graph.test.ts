import { describe, it, expect } from 'bun:test';
import { buildWorkflowGraph, GraphValidationError, topologicalSort } from './graph.js';
import type { WorkflowTask } from './types.js';

describe('DAG Resolution', () => {
  describe('Task ID validation', () => {
    it('should throw on duplicate task ids', () => {
      const tasks: WorkflowTask[] = [
        { id: 'task1', type: 'test', needs: [] },
        { id: 'task1', type: 'test', needs: [] },
      ];
      expect(() => buildWorkflowGraph(tasks)).toThrow(GraphValidationError);
    });

    it('should throw on self-dependency', () => {
      const tasks: WorkflowTask[] = [
        { id: 'task1', type: 'test', needs: ['task1'] },
      ];
      expect(() => buildWorkflowGraph(tasks)).toThrow(GraphValidationError);
    });
  });

  describe('Dependency validation', () => {
    it('should throw on missing dependency', () => {
      const tasks: WorkflowTask[] = [
        { id: 'task1', type: 'test', needs: ['missing'] },
      ];
      expect(() => buildWorkflowGraph(tasks)).toThrow(GraphValidationError);
    });
  });

  describe('Cycle detection', () => {
    it('should throw on cycle', () => {
      const tasks: WorkflowTask[] = [
        { id: 'task1', type: 'test', needs: ['task2'] },
        { id: 'task2', type: 'test', needs: ['task1'] },
      ];
      expect(() => buildWorkflowGraph(tasks)).toThrow(GraphValidationError);
    });
  });

  describe('Topological ordering', () => {
    it('should produce deterministic ordering', () => {
      const tasks: WorkflowTask[] = [
        { id: 'task1', type: 'test', needs: [] },
        { id: 'task2', type: 'test', needs: ['task1'] },
        { id: 'task3', type: 'test', needs: ['task1'] },
      ];
      const graph = buildWorkflowGraph(tasks);
      const order = topologicalSort(graph);
      expect(order).toEqual(['task1', 'task2', 'task3']);
    });

    it('should handle multiple roots', () => {
      const tasks: WorkflowTask[] = [
        { id: 'a', type: 'test', needs: [] },
        { id: 'b', type: 'test', needs: [] },
        { id: 'c', type: 'test', needs: ['a', 'b'] },
      ];
      const graph = buildWorkflowGraph(tasks);
      const order = topologicalSort(graph);
      expect(order).toEqual(['a', 'b', 'c']);
    });
  });
});