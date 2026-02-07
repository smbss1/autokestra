## ADDED Requirements

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
