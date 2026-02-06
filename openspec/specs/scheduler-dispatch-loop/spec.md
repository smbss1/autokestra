## ADDED Requirements

### Requirement: Dispatch runnable tasks to workers
The system MUST provide a scheduler loop that:
1) computes runnable tasks,
2) selects a subset to dispatch based on available capacity,
3) publishes work items to the worker subsystem.

#### Scenario: Dispatch initial runnable tasks
- **WHEN** an execution starts with multiple runnable root tasks
- **THEN** the scheduler dispatches tasks up to the available capacity

### Requirement: Enforce concurrency limits
The scheduler MUST respect configured concurrency limits, including at least:
- a global in-flight limit, and
- a per-execution in-flight limit.

#### Scenario: No dispatch when at capacity
- **WHEN** the number of in-flight tasks equals the configured limit
- **THEN** the scheduler does not dispatch additional tasks

### Requirement: Deterministic selection when multiple runnable tasks exist
When more runnable tasks exist than capacity, the scheduler MUST choose tasks deterministically using a stable tie-breaker (e.g., lexical order of `taskId`).

#### Scenario: Deterministic selection under contention
- **WHEN** three tasks are runnable and capacity allows dispatching only two
- **THEN** the same two tasks are selected each time given the same inputs

### Requirement: Scheduler ticks are idempotent
A scheduler tick MUST NOT result in duplicate dispatch of the same task if the underlying state has not changed.

#### Scenario: Repeated ticks do not double-dispatch
- **WHEN** the scheduler runs twice without any task state transitions between ticks
- **THEN** no task is dispatched more than once
