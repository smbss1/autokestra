## ADDED Requirements

### Requirement: Executions can be cancelled
The system SHALL support requesting cancellation of a running or waiting execution.

#### Scenario: Cancel running execution
- **WHEN** a cancellation is requested for an execution in RUNNING
- **THEN** the execution eventually transitions to CANCELLED

### Requirement: Cancellation is propagated to task runs
The system SHALL propagate cancellation requests to active task runs.

#### Scenario: Cancel propagates to task
- **WHEN** an execution is cancelled
- **THEN** any task run in RUNNING transitions to CANCELLED or FAILED with a cancellation reason

### Requirement: Timeout controls are supported
The system SHALL support applying timeouts at the execution level and task-run level.

#### Scenario: Execution timeout
- **WHEN** an execution exceeds its configured timeout
- **THEN** the execution transitions to FAILED or CANCELLED with a timeout reason

### Requirement: Cancellation requests are idempotent
The system SHALL treat cancellation requests as idempotent.

#### Scenario: Duplicate cancel request
- **WHEN** cancellation is requested multiple times for the same execution
- **THEN** the effective state change occurs at most once and subsequent requests return a consistent result

### Requirement: Lifecycle controls produce inspectable diagnostics
The system SHALL expose enough information to inspect why an execution/task run was cancelled or timed out.

#### Scenario: Inspect cancelled execution
- **WHEN** an execution has transitioned to CANCELLED due to user request
- **THEN** inspection output includes a reason code indicating cancellation and relevant timestamps
