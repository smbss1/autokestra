## ADDED Requirements

### Requirement: Interrupted executions are detected on startup
The system SHALL detect executions in non-terminal states on engine startup.

#### Scenario: Detect running executions
- **WHEN** the engine starts
- **THEN** all executions in RUNNING state are identified

#### Scenario: Detect pending executions
- **WHEN** the engine starts
- **THEN** all executions in PENDING or WAITING state are identified

### Requirement: Running executions are transitioned to failed on crash recovery
The system SHALL transition executions in RUNNING state to FAILED with a crash recovery reason code.

#### Scenario: Mark crashed executions as failed
- **WHEN** the engine detects executions in RUNNING state on startup
- **THEN** they are transitioned to FAILED with reasonCode CRASH_RECOVERY

#### Scenario: Crashed execution includes timestamps
- **WHEN** a crashed execution is marked as failed
- **THEN** the endedAt timestamp is set to the recovery time

### Requirement: Pending executions can be re-queued
The system SHALL support re-queueing executions in PENDING or WAITING state after recovery.

#### Scenario: Re-queue pending executions
- **WHEN** the engine recovers pending executions
- **THEN** they are added back to the scheduler queue

#### Scenario: Re-queue respects original priority
- **WHEN** pending executions are re-queued
- **THEN** their original scheduling priority is preserved

### Requirement: Recovery is logged for observability
The system SHALL log all crash recovery actions for observability.

#### Scenario: Log recovered executions
- **WHEN** crash recovery runs
- **THEN** all recovered execution IDs and their new states are logged

#### Scenario: Log recovery summary
- **WHEN** crash recovery completes
- **THEN** a summary of recovered, failed, and re-queued executions is logged

### Requirement: Task runs are recovered consistently
The system SHALL recover task runs consistently with their parent execution.

#### Scenario: Running task runs are marked as failed
- **WHEN** a crashed execution is detected
- **THEN** all its RUNNING task runs are also transitioned to FAILED

#### Scenario: Task run recovery respects state machine
- **WHEN** task runs are recovered
- **THEN** state transitions follow the same rules as normal execution

### Requirement: Recovery is idempotent
The system SHALL ensure recovery operations are idempotent.

#### Scenario: Multiple recovery attempts are safe
- **WHEN** recovery is run multiple times
- **THEN** the same executions are not re-marked or duplicated

#### Scenario: Already terminal executions are skipped
- **WHEN** recovery finds executions in terminal states
- **THEN** they are not modified

### Requirement: Recovery metrics are exposed
The system SHALL expose metrics for crash recovery operations.

#### Scenario: Recovery count metric
- **WHEN** crash recovery runs
- **THEN** the number of recovered executions is recorded as a metric

#### Scenario: Recovery duration metric
- **WHEN** crash recovery completes
- **THEN** the duration of the recovery operation is recorded
