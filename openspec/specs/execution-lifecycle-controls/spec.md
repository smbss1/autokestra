# execution-lifecycle-controls Specification

## Purpose
TBD - created by archiving change execution-model-states. Update Purpose after archive.
## Requirements
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

### Requirement: Lifecycle events emit audit trail entries

The system SHALL emit audit events for all execution lifecycle transitions to support observability.

#### Scenario: Cancellation emits audit event
- **WHEN** execution is cancelled (user-requested or timeout)
- **THEN** system creates audit event with type=CANCELLED, metadata={cancelled_by, reason, pending_task_count}

#### Scenario: Timeout emits audit event
- **WHEN** execution times out
- **THEN** system creates audit event with type=TIMEOUT, metadata={timeout_duration, elapsed_time, reason_code}

#### Scenario: State transitions emit audit events
- **WHEN** execution transitions between states (PENDING→RUNNING, RUNNING→SUCCESS, etc.)
- **THEN** system creates audit event with type=STATE_CHANGE, metadata={from_state, to_state, timestamp}

### Requirement: Lifecycle controls produce structured logs

The system SHALL log lifecycle control actions (cancel, timeout) with correlation IDs.

#### Scenario: Cancellation logged
- **WHEN** cancellation is requested
- **THEN** system creates log entry with execution_id, level=WARN, message="Execution cancelled by <user/system>", metadata={reason}

#### Scenario: Timeout logged
- **WHEN** execution or task times out
- **THEN** system creates log entry with execution_id (and task_id if task-level), level=ERROR, message describing timeout

#### Scenario: Cancellation propagation logged
- **WHEN** cancellation propagates to task runs
- **THEN** system creates log entry for each task with execution_id, task_id, message="Task cancelled due to execution cancellation"

