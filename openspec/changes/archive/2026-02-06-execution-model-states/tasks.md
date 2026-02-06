## 1. Core types & enums

- [x] 1.1 Define execution/task run state enums (PENDING/RUNNING/WAITING/SUCCESS/FAILED/CANCELLED)
- [x] 1.2 Define reason code conventions (string union or enum) and required fields for terminal states
- [x] 1.3 Define timestamp fields and update rules (createdAt/startedAt/endedAt/updatedAt)

## 2. Data model (Execution / TaskRun / Attempt)

- [x] 2.1 Define `Execution` model (workflowId, executionId, state, timestamps, reasonCode/message, metadata)
- [x] 2.2 Define `TaskRun` model (executionId, taskId, state, timestamps, reasonCode/message)
- [x] 2.3 Define `Attempt` model (taskRunId, attemptNumber, timestamps, status/result references)
- [x] 2.4 Add constructors/helpers to create initial PENDING execution and task runs

## 3. State machine & invariants

- [x] 3.1 Define transition event types (ExecutionStarted, ExecutionSucceeded, ExecutionFailed, CancellationRequested, TimeoutFired, TaskStarted, TaskSucceeded, TaskFailed, etc.)
- [x] 3.2 Implement pure transition function for executions enforcing allowed transitions
- [x] 3.3 Implement pure transition function for task runs enforcing allowed transitions
- [x] 3.4 Enforce terminal state immutability for SUCCESS/FAILED/CANCELLED
- [x] 3.5 Enforce idempotence for duplicate/replayed events (same resulting state)
- [x] 3.6 Require WAITING transitions to carry a reason code

## 4. Lifecycle controls (cancel/timeout)

- [x] 4.1 Implement cancellation request handling for execution (idempotent)
- [x] 4.2 Define and implement propagation rules to active task runs
- [x] 4.3 Implement timeout handling at execution level (transition + reason)
- [x] 4.4 Implement timeout handling at task-run level (transition + reason)

## 5. Diagnostics & CLI integration touchpoints (minimal)

- [x] 5.1 Define a stable inspectable representation (JSON) for execution/task run states (paths, reasonCode, timestamps)
- [x] 5.2 Define error types for invalid transitions and include details for CLI display
- [x] 5.3 Add minimal engine entrypoints (e.g., `transitionExecution`, `transitionTaskRun`) for use by server/CLI

## 6. Tests

- [x] 6.1 Add table-driven tests for allowed/disallowed transitions (execution)
- [x] 6.2 Add table-driven tests for allowed/disallowed transitions (task run)
- [x] 6.3 Add tests for terminal immutability
- [x] 6.4 Add tests for idempotence on duplicate events
- [x] 6.5 Add tests for cancel propagation and timeout behavior
- [x] 6.6 Add tests for WAITING reason requirements
