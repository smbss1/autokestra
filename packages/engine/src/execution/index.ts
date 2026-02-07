// Execution state machine module exports
export * from './types';
export * from './models';
export * from './events';
export * from './stateMachine';
export * from './inspection';
export * from './inspector';

// Entrypoints for engine use
export function transitionExecution(execution: import('./models').Execution, event: import('./events').ExecutionTransitionEvent): import('./models').Execution {
  return require('./stateMachine').transitionExecution(execution, event);
}

export function transitionTaskRun(taskRun: import('./models').TaskRun, event: import('./events').TaskRunTransitionEvent): import('./models').TaskRun {
  return require('./stateMachine').transitionTaskRun(taskRun, event);
}