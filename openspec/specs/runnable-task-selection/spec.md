## ADDED Requirements

### Requirement: Compute runnable tasks from graph and execution state
The system MUST compute the set of runnable tasks based on:
- the resolved workflow graph,
- the current per-task execution state.

A task is runnable if:
- it has not started yet, AND
- all its direct dependencies are in a terminal success state.

#### Scenario: Initial runnable tasks are roots
- **WHEN** an execution starts and no task has started
- **THEN** the runnable set contains exactly the tasks with zero dependencies

#### Scenario: Dependent task becomes runnable after dependencies succeed
- **WHEN** task `A` is a dependency of task `B` and `A` transitions to SUCCESS
- **THEN** `B` becomes runnable if all of its dependencies are SUCCESS

### Requirement: Do not return tasks blocked by failed dependencies
If any dependency of a task is in a terminal failure state, the task MUST NOT be returned as runnable.

#### Scenario: Failed dependency blocks dependent
- **WHEN** task `A` is a dependency of task `B` and `A` transitions to FAILED
- **THEN** `B` is not included in the runnable set

### Requirement: Deterministic ordering of runnable tasks
The runnable task list MUST be ordered deterministically. When multiple tasks are runnable at the same time, the tie-breaker MUST be stable (e.g., lexical order of `taskId`).

#### Scenario: Runnable ordering is stable
- **WHEN** multiple tasks are runnable simultaneously
- **THEN** the system returns them in a stable deterministic order

### Requirement: Support time-gated retries in runnable selection
When a task has FAILED but is retryable, the system MUST make it runnable again only if:
- the retry attempt count is below the configured maximum, AND
- the current time is greater than or equal to the next eligible retry time (backoff).

#### Scenario: Retry is not runnable before backoff
- **WHEN** a task has FAILED and has a next eligible retry time in the future
- **THEN** the task is not included in the runnable set

#### Scenario: Retry becomes runnable after backoff
- **WHEN** a task has FAILED and the current time reaches the next eligible retry time
- **THEN** the task is included in the runnable set (subject to dependency constraints)
