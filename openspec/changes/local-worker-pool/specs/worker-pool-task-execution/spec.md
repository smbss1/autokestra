## ADDED Requirements

### Requirement: Execute work items with configurable concurrency
The system MUST provide a local worker pool that executes work items with a configurable maximum concurrency.

#### Scenario: In-flight count does not exceed concurrency
- **WHEN** the worker pool concurrency is set to 2 and 3 work items are available
- **THEN** at most 2 work items are executing concurrently

### Requirement: Track in-flight work items
The worker pool MUST track which work items are currently executing (in-flight).

#### Scenario: In-flight tracking updates on start and completion
- **WHEN** a work item starts executing
- **THEN** it is recorded as in-flight

#### Scenario: In-flight tracking clears after completion
- **WHEN** a work item completes successfully or fails
- **THEN** it is removed from the in-flight set

### Requirement: Execute via an abstract task executor contract
The worker pool MUST execute work items through an abstract executor interface that supports cancellation via an abort signal.

#### Scenario: Executor receives abort signal
- **WHEN** a work item is executed by the worker pool
- **THEN** the executor is invoked with an abort signal that can be used to cancel the work

### Requirement: Prevent duplicate execution of the same work item in-process
The worker pool MUST NOT execute the same logical work item more than once concurrently within the same process.

#### Scenario: Duplicate submission is not double-executed
- **WHEN** the same work item id is submitted twice while the first is still in-flight
- **THEN** only one execution occurs in the worker pool
