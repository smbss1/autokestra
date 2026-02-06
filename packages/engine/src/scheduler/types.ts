export type TaskId = string;

export interface WorkflowTask {
  id: TaskId;
  type: string;
  needs: TaskId[];
  retry?: {
    max: number;
    backoffSeconds?: number;
  };
}

export interface WorkflowGraphNode {
  task: WorkflowTask;
  dependencies: TaskId[];
  dependents: TaskId[];
}

export interface WorkflowGraph {
  nodes: Map<TaskId, WorkflowGraphNode>;
  roots: TaskId[];
}

export type TaskRunStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TaskRunState {
  taskId: TaskId;
  status: TaskRunStatus;
  attemptCount: number;
  maxAttempts: number;
  nextEligibleAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}