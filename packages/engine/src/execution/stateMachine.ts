import { Execution, TaskRun } from './models';
import { ExecutionState, TaskRunState, ReasonCode } from './types';
import { ExecutionTransitionEvent, TaskRunTransitionEvent } from './events';

// Error for invalid transitions
export class InvalidTransitionError extends Error {
  constructor(
    public entityType: 'execution' | 'taskRun',
    public currentState: string,
    public eventType: string,
    public reason: string
  ) {
    super(`Invalid transition: ${entityType} in ${currentState} cannot handle ${eventType} - ${reason}`);
  }
}

// Pure transition function for executions
export function transitionExecution(
  execution: Execution,
  event: ExecutionTransitionEvent
): Execution {
  const now = new Date();

  // Terminal states are immutable
  if ([ExecutionState.SUCCESS, ExecutionState.FAILED, ExecutionState.CANCELLED].includes(execution.state)) {
    throw new InvalidTransitionError('execution', execution.state, event.type, 'terminal state is immutable');
  }

  switch (execution.state) {
    case ExecutionState.PENDING:
      if (event.type === 'EXECUTION_STARTED') {
        return {
          ...execution,
          state: ExecutionState.RUNNING,
          timestamps: {
            ...execution.timestamps,
            startedAt: now,
            updatedAt: now,
          },
        };
      }
      break;

    case ExecutionState.RUNNING:
      if (event.type === 'EXECUTION_SUCCEEDED') {
        return {
          ...execution,
          state: ExecutionState.SUCCESS,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'SUCCESS',
        };
      } else if (event.type === 'EXECUTION_FAILED') {
        return {
          ...execution,
          state: ExecutionState.FAILED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'EXECUTION_CANCELLED') {
        return {
          ...execution,
          state: ExecutionState.CANCELLED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'EXECUTION_TIMED_OUT') {
        return {
          ...execution,
          state: ExecutionState.FAILED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'TIMEOUT',
        };
      } else if (event.type === 'CANCELLATION_REQUESTED') {
        // Transition to CANCELLED immediately for executions
        return {
          ...execution,
          state: ExecutionState.CANCELLED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'USER_CANCELLED',
        };
      }
      break;

    case ExecutionState.WAITING:
      // Similar to RUNNING, but WAITING might have specific transitions
      if (event.type === 'EXECUTION_SUCCEEDED') {
        return {
          ...execution,
          state: ExecutionState.SUCCESS,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'SUCCESS',
        };
      } else if (event.type === 'EXECUTION_FAILED') {
        return {
          ...execution,
          state: ExecutionState.FAILED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'EXECUTION_CANCELLED') {
        return {
          ...execution,
          state: ExecutionState.CANCELLED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'EXECUTION_TIMED_OUT') {
        return {
          ...execution,
          state: ExecutionState.FAILED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'TIMEOUT',
        };
      } else if (event.type === 'CANCELLATION_REQUESTED') {
        // Transition to CANCELLED immediately for executions
        return {
          ...execution,
          state: ExecutionState.CANCELLED,
          timestamps: {
            ...execution.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'USER_CANCELLED',
        };
      }
      break;
  }

  throw new InvalidTransitionError('execution', execution.state, event.type, 'transition not allowed');
}

// Pure transition function for task runs
export function transitionTaskRun(
  taskRun: TaskRun,
  event: TaskRunTransitionEvent
): TaskRun {
  const now = new Date();

  // Terminal states are immutable
  if ([TaskRunState.SUCCESS, TaskRunState.FAILED, TaskRunState.CANCELLED].includes(taskRun.state)) {
    throw new InvalidTransitionError('taskRun', taskRun.state, event.type, 'terminal state is immutable');
  }

  switch (taskRun.state) {
    case TaskRunState.PENDING:
      if (event.type === 'TASK_STARTED') {
        return {
          ...taskRun,
          state: TaskRunState.RUNNING,
          timestamps: {
            ...taskRun.timestamps,
            startedAt: now,
            updatedAt: now,
          },
        };
      }
      break;

    case TaskRunState.RUNNING:
      if (event.type === 'TASK_SUCCEEDED') {
        return {
          ...taskRun,
          state: TaskRunState.SUCCESS,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'SUCCESS',
        };
      } else if (event.type === 'TASK_FAILED') {
        return {
          ...taskRun,
          state: TaskRunState.FAILED,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'TASK_CANCELLED') {
        return {
          ...taskRun,
          state: TaskRunState.CANCELLED,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'TASK_TIMED_OUT') {
        return {
          ...taskRun,
          state: TaskRunState.FAILED,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'TIMEOUT',
        };
      }
      break;

    case TaskRunState.WAITING:
      if (event.type === 'TASK_STARTED') {
        return {
          ...taskRun,
          state: TaskRunState.RUNNING,
          timestamps: {
            ...taskRun.timestamps,
            startedAt: now,
            updatedAt: now,
          },
        };
      } else if (event.type === 'TASK_FAILED') {
        return {
          ...taskRun,
          state: TaskRunState.FAILED,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'TASK_CANCELLED') {
        return {
          ...taskRun,
          state: TaskRunState.CANCELLED,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: event.reasonCode,
          message: event.message,
        };
      } else if (event.type === 'TASK_TIMED_OUT') {
        return {
          ...taskRun,
          state: TaskRunState.FAILED,
          timestamps: {
            ...taskRun.timestamps,
            endedAt: now,
            updatedAt: now,
          },
          reasonCode: 'TIMEOUT',
        };
      }
      break;
  }

  // WAITING transition
  if (event.type === 'TASK_WAITING') {
    if (!event.reasonCode) {
      throw new InvalidTransitionError('taskRun', taskRun.state, event.type, 'WAITING requires reasonCode');
    }
    return {
      ...taskRun,
      state: TaskRunState.WAITING,
      timestamps: {
        ...taskRun.timestamps,
        updatedAt: now,
      },
      reasonCode: event.reasonCode,
      message: event.message,
    };
  }

  throw new InvalidTransitionError('taskRun', taskRun.state, event.type, 'transition not allowed');
}