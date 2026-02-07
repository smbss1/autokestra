# execution-data-model Specification

## Purpose
TBD - created by archiving change execution-model-states. Update Purpose after archive.
## Requirements
### Requirement: Execution data model includes stable identifiers
The system SHALL represent each execution with stable identifiers including at least `workflowId` and `executionId`.

#### Scenario: Execution identity
- **WHEN** an execution is created
- **THEN** it is assigned a unique `executionId` and references the owning `workflowId`

### Requirement: Execution data model includes timestamps
The system SHALL capture timestamps for execution lifecycle including at least `createdAt`, `startedAt`, `endedAt`, and `updatedAt`.

#### Scenario: Execution starts
- **WHEN** an execution transitions from PENDING to RUNNING
- **THEN** `startedAt` is set and `updatedAt` is updated

### Requirement: Task runs are modeled explicitly
The system SHALL represent task runs as distinct records linked to an execution and a task identifier.

#### Scenario: Task run linkage
- **WHEN** a task run is created
- **THEN** it references the parent `executionId` and the workflow task `taskId`

### Requirement: Attempts are modeled for retries
The system SHALL represent attempts for a task run to support retries, with attempt numbering and timestamps.

#### Scenario: New attempt created
- **WHEN** a retry is triggered for a task run
- **THEN** a new attempt is created with an incremented attempt number

### Requirement: State changes record reason codes
The system SHALL associate state changes with a machine-readable `reasonCode` and an optional human-readable `message`.

#### Scenario: Execution fails
- **WHEN** an execution transitions to FAILED
- **THEN** the state includes a `reasonCode` and optionally a `message` explaining the failure

### Requirement: Log correlation fields in execution model

The system SHALL add log correlation fields to execution and task run models to support efficient log queries.

#### Scenario: Execution includes log entry count
- **WHEN** execution record is queried
- **THEN** model includes log_entry_count field (updated on log writes) for quick log availability check

#### Scenario: Task run includes log correlation
- **WHEN** task run is created
- **THEN** model includes task_id field that matches log entries for correlation

### Requirement: Task run includes debugging metadata

The system SHALL capture debugging metadata in task run model for inspection.

#### Scenario: Task run stores inputs
- **WHEN** task starts execution
- **THEN** resolved inputs (with secrets masked) are stored in task_run.inputs field as JSON

#### Scenario: Task run stores outputs
- **WHEN** task completes successfully
- **THEN** task outputs are stored in task_run.outputs field as JSON

#### Scenario: Task run stores error details
- **WHEN** task fails
- **THEN** error message and stack trace are stored in task_run.error field as JSON

#### Scenario: Task run tracks duration
- **WHEN** task completes
- **THEN** duration_ms field is calculated (end_time - start_time) for performance analysis

