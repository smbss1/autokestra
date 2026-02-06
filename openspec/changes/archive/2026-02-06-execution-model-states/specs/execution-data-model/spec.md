## ADDED Requirements

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
