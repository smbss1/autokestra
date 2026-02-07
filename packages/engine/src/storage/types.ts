import { Execution, TaskRun, Attempt } from '../execution/models';
import { ExecutionState, TaskRunState } from '../execution/types';

// Query options for filtering and pagination
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface WorkflowQueryOptions extends QueryOptions {
  enabled?: boolean;
}

export interface ExecutionQueryOptions extends QueryOptions {
  workflowId?: string;
  state?: ExecutionState | ExecutionState[];
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface TaskRunQueryOptions extends QueryOptions {
  executionId?: string;
  taskId?: string;
  state?: TaskRunState | TaskRunState[];
}

export interface AttemptQueryOptions extends QueryOptions {
  taskRunId?: string;
}

// Result types with pagination metadata
export interface QueryResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

// Workflow storage model
export interface StoredWorkflow {
  id: string;
  definition: any; // YAML parsed object
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction callback type
export type TransactionCallback<T> = () => T | Promise<T>;

// StateStore interface - abstract persistence layer
export interface StateStore {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Transactions
  transaction<T>(callback: TransactionCallback<T>): Promise<T>;

  // Workflows
  saveWorkflow(workflow: StoredWorkflow): Promise<void>;
  getWorkflow(id: string): Promise<StoredWorkflow | null>;
  listWorkflows(options?: WorkflowQueryOptions): Promise<QueryResult<StoredWorkflow>>;
  deleteWorkflow(id: string): Promise<void>;

  // Executions
  createExecution(execution: Execution): Promise<void>;
  updateExecution(execution: Execution): Promise<void>;
  getExecution(executionId: string): Promise<Execution | null>;
  listExecutions(options?: ExecutionQueryOptions): Promise<QueryResult<Execution>>;

  // Task Runs
  createTaskRun(taskRun: TaskRun): Promise<void>;
  updateTaskRun(taskRun: TaskRun): Promise<void>;
  getTaskRun(executionId: string, taskId: string): Promise<TaskRun | null>;
  listTaskRuns(options?: TaskRunQueryOptions): Promise<QueryResult<TaskRun>>;

  // Attempts
  createAttempt(attempt: Attempt): Promise<void>;
  getAttempts(taskRunId: string): Promise<Attempt[]>;

  // Recovery
  getActiveExecutions(): Promise<Execution[]>;
  getPendingExecutions(): Promise<Execution[]>;

  // Retention
  deleteExecutionsBefore(date: Date, states?: ExecutionState[]): Promise<number>;

  // Atomic batch operations
  updateExecutionAndTaskRuns(
    execution: Execution,
    taskRuns: TaskRun[]
  ): Promise<void>;
}
