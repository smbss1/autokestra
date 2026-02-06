## ADDED Requirements

### Requirement: Support task cancellation
The system MUST support cancellation of an in-flight work item.

#### Scenario: Cancel transitions a task to CANCELLED
- **WHEN** a running work item is cancelled
- **THEN** the work item completes with a terminal CANCELLED outcome

### Requirement: Support per-task execution timeouts
The system MUST support a per-task timeout that aborts execution when the timeout is exceeded.

#### Scenario: Task times out
- **WHEN** a work item exceeds its configured execution timeout
- **THEN** execution is aborted and the work item completes with a terminal failure outcome

### Requirement: Support graceful shutdown
The worker pool MUST support a graceful shutdown mode that stops consuming new work and waits for in-flight tasks to finish up to a deadline.

#### Scenario: Graceful shutdown drains in-flight
- **WHEN** graceful shutdown is initiated with a deadline
- **THEN** no new work items are started and the pool waits for in-flight work items until the deadline

### Requirement: Support forced shutdown
The worker pool MUST support a forced shutdown mode that cancels in-flight tasks.

#### Scenario: Forced shutdown cancels in-flight
- **WHEN** forced shutdown is initiated
- **THEN** all in-flight work items are cancelled
