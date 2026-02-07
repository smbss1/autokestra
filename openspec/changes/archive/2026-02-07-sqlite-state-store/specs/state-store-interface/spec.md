## ADDED Requirements

### Requirement: State store provides abstract interface for persistence
The system SHALL define a StateStore interface that abstracts persistence operations for workflows, executions, task runs, and attempts.

#### Scenario: StateStore interface is implemented
- **WHEN** a persistence backend (SQLite, PostgreSQL) is created
- **THEN** it implements the StateStore interface with all required methods

### Requirement: Workflows can be persisted and retrieved
The system SHALL allow workflows to be saved to and loaded from the state store.

#### Scenario: Save workflow
- **WHEN** a workflow is applied via CLI
- **THEN** the workflow definition is persisted to the state store with its ID and metadata

#### Scenario: Retrieve workflow by ID
- **WHEN** a workflow ID is queried
- **THEN** the state store returns the complete workflow definition or null if not found

### Requirement: Executions can be persisted and retrieved
The system SHALL allow executions to be saved to and loaded from the state store.

#### Scenario: Create execution record
- **WHEN** an execution is started
- **THEN** the execution record is persisted with initial state PENDING

#### Scenario: Update execution state
- **WHEN** an execution transitions to a new state
- **THEN** the state store updates the execution record atomically

#### Scenario: Query executions by workflow
- **WHEN** executions are queried for a specific workflow ID
- **THEN** the state store returns all executions for that workflow ordered by creation time

### Requirement: Task runs can be persisted and retrieved
The system SHALL allow task runs to be saved to and loaded from the state store.

#### Scenario: Create task run record
- **WHEN** a task run is created for an execution
- **THEN** the task run record is persisted linked to the execution ID

#### Scenario: Update task run state
- **WHEN** a task run transitions to a new state
- **THEN** the state store updates the task run record atomically

#### Scenario: Query task runs by execution
- **WHEN** task runs are queried for a specific execution ID
- **THEN** the state store returns all task runs for that execution

### Requirement: Attempts can be persisted and retrieved
The system SHALL allow retry attempts to be saved to and loaded from the state store.

#### Scenario: Record new attempt
- **WHEN** a task run is retried
- **THEN** a new attempt record is persisted with incremented attempt number

#### Scenario: Query attempts by task run
- **WHEN** attempts are queried for a task run
- **THEN** the state store returns all attempts ordered by attempt number

### Requirement: State transitions are atomic
The system SHALL ensure that state transitions involving multiple records are atomic.

#### Scenario: Execution and task run updates together
- **WHEN** an execution completes and multiple task runs are finalized
- **THEN** all updates occur within a single transaction or all fail

### Requirement: State store supports filtering and pagination
The system SHALL allow filtering executions by state, workflow ID, and date range with pagination support.

#### Scenario: Filter executions by state
- **WHEN** executions are queried with a state filter (e.g., RUNNING)
- **THEN** only executions in that state are returned

#### Scenario: Paginate execution results
- **WHEN** executions are queried with offset and limit
- **THEN** the state store returns a page of results with total count
