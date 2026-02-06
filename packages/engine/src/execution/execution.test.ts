import { describe, it, expect } from 'bun:test';
import { ExecutionState, TaskRunState } from './types';
import { createInitialExecution, createInitialTaskRun } from './models';
import { transitionExecution, transitionTaskRun, InvalidTransitionError } from './stateMachine';
import { ExecutionTransitionEvent, TaskRunTransitionEvent } from './events';

describe('Execution State Machine', () => {
  describe('Allowed Transitions', () => {
    const testCases: Array<{
      initialState: ExecutionState;
      event: ExecutionTransitionEvent;
      expectedState: ExecutionState;
      description: string;
    }> = [
      {
        initialState: ExecutionState.PENDING,
        event: { type: 'EXECUTION_STARTED' },
        expectedState: ExecutionState.RUNNING,
        description: 'PENDING -> RUNNING on EXECUTION_STARTED',
      },
      {
        initialState: ExecutionState.RUNNING,
        event: { type: 'EXECUTION_SUCCEEDED' },
        expectedState: ExecutionState.SUCCESS,
        description: 'RUNNING -> SUCCESS on EXECUTION_SUCCEEDED',
      },
      {
        initialState: ExecutionState.RUNNING,
        event: { type: 'EXECUTION_FAILED', reasonCode: 'ERROR' },
        expectedState: ExecutionState.FAILED,
        description: 'RUNNING -> FAILED on EXECUTION_FAILED',
      },
      {
        initialState: ExecutionState.RUNNING,
        event: { type: 'EXECUTION_CANCELLED', reasonCode: 'USER_CANCELLED' },
        expectedState: ExecutionState.CANCELLED,
        description: 'RUNNING -> CANCELLED on EXECUTION_CANCELLED',
      },
      {
        initialState: ExecutionState.RUNNING,
        event: { type: 'EXECUTION_TIMED_OUT' },
        expectedState: ExecutionState.FAILED,
        description: 'RUNNING -> FAILED on EXECUTION_TIMED_OUT',
      },
      {
        initialState: ExecutionState.RUNNING,
        event: { type: 'CANCELLATION_REQUESTED' },
        expectedState: ExecutionState.CANCELLED,
        description: 'RUNNING -> CANCELLED on CANCELLATION_REQUESTED',
      },
      // WAITING transitions
      {
        initialState: ExecutionState.WAITING,
        event: { type: 'EXECUTION_SUCCEEDED' },
        expectedState: ExecutionState.SUCCESS,
        description: 'WAITING -> SUCCESS on EXECUTION_SUCCEEDED',
      },
      {
        initialState: ExecutionState.WAITING,
        event: { type: 'CANCELLATION_REQUESTED' },
        expectedState: ExecutionState.CANCELLED,
        description: 'WAITING -> CANCELLED on CANCELLATION_REQUESTED',
      },
    ];

    testCases.forEach(({ initialState, event, expectedState, description }) => {
      it(description, () => {
        const execution = { ...createInitialExecution('wf1', 'exec1'), state: initialState };
        const result = transitionExecution(execution, event);
        expect(result.state).toBe(expectedState);
      });
    });
  });

  describe('Disallowed Transitions', () => {
    const testCases: Array<{
      initialState: ExecutionState;
      event: ExecutionTransitionEvent;
      description: string;
    }> = [
      {
        initialState: ExecutionState.PENDING,
        event: { type: 'EXECUTION_SUCCEEDED' },
        description: 'PENDING cannot succeed directly',
      },
      {
        initialState: ExecutionState.SUCCESS,
        event: { type: 'EXECUTION_FAILED', reasonCode: 'ERROR' },
        description: 'Terminal SUCCESS is immutable',
      },
      {
        initialState: ExecutionState.FAILED,
        event: { type: 'EXECUTION_STARTED' },
        description: 'Terminal FAILED is immutable',
      },
      {
        initialState: ExecutionState.CANCELLED,
        event: { type: 'EXECUTION_SUCCEEDED' },
        description: 'Terminal CANCELLED is immutable',
      },
    ];

    testCases.forEach(({ initialState, event, description }) => {
      it(`rejects ${description}`, () => {
        const execution = { ...createInitialExecution('wf1', 'exec1'), state: initialState };
        expect(() => transitionExecution(execution, event)).toThrow(InvalidTransitionError);
      });
    });
  });

  describe('Terminal Immutability', () => {
    [ExecutionState.SUCCESS, ExecutionState.FAILED, ExecutionState.CANCELLED].forEach(terminalState => {
      it(`${terminalState} rejects any transition`, () => {
        const execution = { ...createInitialExecution('wf1', 'exec1'), state: terminalState };
        expect(() => transitionExecution(execution, { type: 'EXECUTION_STARTED' })).toThrow(InvalidTransitionError);
      });
    });
  });

  describe('Cancel Propagation and Timeout Behavior', () => {
    it('CANCELLATION_REQUESTED transitions RUNNING to CANCELLED', () => {
      const execution = { ...createInitialExecution('wf1', 'exec1'), state: ExecutionState.RUNNING };
      const result = transitionExecution(execution, { type: 'CANCELLATION_REQUESTED' });
      expect(result.state).toBe(ExecutionState.CANCELLED);
      expect(result.reasonCode).toBe('USER_CANCELLED');
    });

    it('EXECUTION_TIMED_OUT transitions to FAILED with TIMEOUT reason', () => {
      const execution = { ...createInitialExecution('wf1', 'exec1'), state: ExecutionState.RUNNING };
      const result = transitionExecution(execution, { type: 'EXECUTION_TIMED_OUT' });
      expect(result.state).toBe(ExecutionState.FAILED);
      expect(result.reasonCode).toBe('TIMEOUT');
    });
  });
});