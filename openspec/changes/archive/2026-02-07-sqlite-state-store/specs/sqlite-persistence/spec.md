## ADDED Requirements

### Requirement: SQLite database is initialized on startup
The system SHALL initialize a SQLite database file at the configured path on first startup.

#### Scenario: First startup creates database
- **WHEN** the engine starts with no existing SQLite database
- **THEN** a new database file is created at the configured path

#### Scenario: Existing database is reused
- **WHEN** the engine starts with an existing SQLite database
- **THEN** the existing database is opened and used

### Requirement: SQLite database uses WAL mode
The system SHALL enable Write-Ahead Logging (WAL) mode for the SQLite database.

#### Scenario: WAL mode is enabled
- **WHEN** the SQLite database is initialized
- **THEN** WAL mode is enabled for improved concurrency and crash recovery

### Requirement: Database schema matches execution model
The system SHALL define SQLite tables for workflows, executions, task_runs, attempts, and outputs.

#### Scenario: Tables are created
- **WHEN** migrations are applied
- **THEN** all required tables exist with correct columns and types

#### Scenario: Foreign keys are enforced
- **WHEN** a record references another table (e.g., task_run references execution)
- **THEN** foreign key constraints are enforced

### Requirement: Indexes are created for common queries
The system SHALL create indexes on frequently queried columns.

#### Scenario: Execution lookup by ID
- **WHEN** an execution is queried by executionId
- **THEN** the query uses an index for fast lookup

#### Scenario: Execution filtering by state and date
- **WHEN** executions are filtered by state and createdAt
- **THEN** composite indexes are used for efficient filtering

### Requirement: Transactions ensure consistency
The system SHALL use SQLite transactions for all multi-record operations.

#### Scenario: State transition with multiple updates
- **WHEN** an execution and its task runs are updated together
- **THEN** all updates occur within a single SQLite transaction

#### Scenario: Transaction rollback on error
- **WHEN** an error occurs during a multi-record update
- **THEN** the transaction is rolled back and no partial changes are committed

### Requirement: Connection pooling is configured
The system SHALL configure connection pooling for SQLite with appropriate limits.

#### Scenario: Connection pool is initialized
- **WHEN** the SQLite state store is created
- **THEN** a connection pool is initialized with configured size

### Requirement: Query performance meets targets
The system SHALL execute common queries within acceptable time limits on modest hardware.

#### Scenario: Execution lookup is fast
- **WHEN** an execution is queried by ID
- **THEN** the query completes in under 10ms

#### Scenario: List executions is responsive
- **WHEN** executions are listed with pagination
- **THEN** the query completes in under 100ms for 1000 total records
