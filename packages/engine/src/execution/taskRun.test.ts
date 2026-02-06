import { describe, it, expect } from 'bun:test';
import { TaskRunState } from './types';
import { createInitialTaskRun } from './models';
import { transitionTaskRun, InvalidTransitionError } from './stateMachine';
import { TaskRunTransitionEvent } from './events';

describe('TaskRun State Machine', () => {
  describe('Allowed Transitions', () => {
    const testCases: Array<{
      initialState: TaskRunState;
      event: TaskRunTransitionEvent;
      expectedState: TaskRunState;
      description: string;
    }> = [
      {
        initialState: TaskRunState.PENDING,
        event: { type: 'TASK_STARTED' },
        expectedState: TaskRunState.RUNNING,
        description: 'PENDING -> RUNNING on TASK_STARTED',
      },
      {
        initialState: TaskRunState.RUNNING,
        event: { type: 'TASK_SUCCEEDED' },
        expectedState: TaskRunState.SUCCESS,
        description: 'RUNNING -> SUCCESS on TASK_SUCCEEDED',
      },
      {
        initialState: TaskRunState.RUNNING,
        event: { type: 'TASK_FAILED', reasonCode: 'ERROR' },
        expectedState: TaskRunState.FAILED,
        description: 'RUNNING -> FAILED on TASK_FAILED',
      },
      {
        initialState: TaskRunState.RUNNING,
        event: { type: 'TASK_CANCELLED', reasonCode: 'USER_CANCELLED' },
        expectedState: TaskRunState.CANCELLED,
        description: 'RUNNING -> CANCELLED on TASK_CANCELLED',
      },
      {
        initialState: TaskRunState.RUNNING,
        event: { type: 'TASK_TIMED_OUT' },
        expectedState: TaskRunState.FAILED,
        description: 'RUNNING -> FAILED on TASK_TIMED_OUT',
      },
      // WAITING transitions
      {
        initialState: TaskRunState.WAITING,
        event: { type: 'TASK_STARTED' },
        expectedState: TaskRunState.RUNNING,
        description: 'WAITING -> RUNNING on TASK_STARTED',
      },
      {
        initialState: TaskRunState.WAITING,
        event: { type: 'TASK_FAILED', reasonCode: 'DEPENDENCY_FAILED' },
        expectedState: TaskRunState.FAILED,
        description: 'WAITING -> FAILED on TASK_FAILED',
      },
      {
        initialState: TaskRunState.RUNNING,
        event: { type: 'TASK_WAITING', reasonCode: 'BACKOFF' },
        expectedState: TaskRunState.WAITING,
        description: 'RUNNING -> WAITING on TASK_WAITING',
      },
      {
        initialState: TaskRunState.PENDING,
        event: { type: 'TASK_WAITING', reasonCode: 'DEPENDENCY_FAILED' },
        expectedState: TaskRunState.WAITING,
        description: 'PENDING -> WAITING on TASK_WAITING',
      },
    ];

    testCases.forEach(({ initialState, event, expectedState, description }) => {
      it(description, () => {
        const taskRun = { ...createInitialTaskRun('exec1', 'task1'), state: initialState };
        const result = transitionTaskRun(taskRun, event);
        expect(result.state).toBe(expectedState);
      });
    });
  });

  describe('Disallowed Transitions', () => {
    const testCases: Array<{
      initialState: TaskRunState;
      event: TaskRunTransitionEvent;
      description: string;
    }> = [
      {
        initialState: TaskRunState.PENDING,
        event: { type: 'TASK_SUCCEEDED' },
        description: 'PENDING cannot succeed directly',
      },
      {
        initialState: TaskRunState.SUCCESS,
        event: { type: 'TASK_FAILED', reasonCode: 'ERROR' },
        description: 'Terminal SUCCESS is immutable',
      },
      {
        initialState: TaskRunState.FAILED,
        event: { type: 'TASK_STARTED' },
        description: 'Terminal FAILED is immutable',
      },
      {
        initialState: TaskRunState.CANCELLED,
        event: { type: 'TASK_SUCCEEDED' },
        description: 'Terminal CANCELLED is immutable',
      },
    ];

    testCases.forEach(({ initialState, event, description }) => {
      it(`rejects ${description}`, () => {
        const taskRun = { ...createInitialTaskRun('exec1', 'task1'), state: initialState };
        expect(() => transitionTaskRun(taskRun, event)).toThrow(InvalidTransitionError);
      });
    });
  });

  describe('WAITING Reason Requirements', () => {
    it('TASK_WAITING requires reasonCode', () => {
      const taskRun = createInitialTaskRun('exec1', 'task1');
      expect(() => transitionTaskRun(taskRun, { type: 'TASK_WAITING' } as TaskRunTransitionEvent)).toThrow(InvalidTransitionError);
    });

    it('TASK_WAITING accepts valid reasonCode', () => {
      const taskRun = createInitialTaskRun('exec1', 'task1');
      const result = transitionTaskRun(taskRun, { type: 'TASK_WAITING', reasonCode: 'BACKOFF' });
      expect(result.state).toBe(TaskRunState.WAITING);
      expect(result.reasonCode).toBe('BACKOFF');
    });
  });
});