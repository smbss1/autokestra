## ADDED Requirements

### Requirement: Log capture from execution engine

The system SHALL capture structured logs from the execution engine with correlation IDs linking logs to specific executions.

#### Scenario: Execution start logged
- **WHEN** an execution transitions to RUNNING state
- **THEN** system creates a log entry with execution_id, timestamp, level=INFO, source=scheduler, and message describing the execution start

#### Scenario: Execution completion logged
- **WHEN** an execution transitions to terminal state (SUCCESS, FAILED, CANCELLED)
- **THEN** system creates a log entry with execution_id, final state, duration, and completion reason

#### Scenario: Correlation ID propagates through execution
- **WHEN** any component logs during execution
- **THEN** log entry MUST include the execution_id for queryability

### Requirement: Log capture from task execution

The system SHALL capture structured logs from task workers with task-level correlation.

#### Scenario: Task start logged
- **WHEN** a task begins execution on a worker
- **THEN** system creates log entry with execution_id, task_id, timestamp, level=INFO, source=worker, message with task type and inputs

#### Scenario: Task completion logged
- **WHEN** a task completes (success or failure)
- **THEN** system creates log entry with execution_id, task_id, result status, duration, and outputs/errors

#### Scenario: Task retry logged
- **WHEN** a task is retried due to retry policy
- **THEN** system creates log entry with execution_id, task_id, attempt number, and retry reason

### Requirement: Log capture from plugin runtime

The system SHALL intercept stdout and stderr from plugin child processes (trusted mode) or Docker containers (restricted mode) and structure as log entries.

#### Scenario: Plugin stdout captured
- **WHEN** a plugin writes to stdout (via console.log or direct output)
- **THEN** system captures output line-by-line from the child process/container, creates log entries with source=plugin:<namespace>/<plugin>.<action>, splits multi-line output into separate entries

#### Scenario: Plugin stderr captured
- **WHEN** a plugin writes to stderr (via context.log or console.error)
- **THEN** system captures output from child process/container stderr with appropriate level (DEBUG/INFO/WARN/ERROR based on context.log call), tags with plugin source identifier

#### Scenario: Plugin log truncation
- **WHEN** plugin output exceeds 10MB per task
- **THEN** system truncates with warning log entry indicating truncation occurred

### Requirement: Structured log format

The system SHALL use consistent structured format for all log entries.

#### Scenario: Log entry contains required fields
- **WHEN** any log is created
- **THEN** log entry MUST contain: execution_id, timestamp (Unix ms), level (DEBUG/INFO/WARN/ERROR), source, message

#### Scenario: Log entry contains optional fields
- **WHEN** log is task-specific
- **THEN** log entry MAY contain: task_id, metadata (JSON object for structured data like error stacks)

#### Scenario: Log levels used appropriately
- **WHEN** system creates logs
- **THEN** DEBUG for detailed tracing, INFO for normal operations, WARN for recoverable issues, ERROR for failures

### Requirement: Log buffering for performance

The system SHALL buffer log writes to avoid excessive database writes.

#### Scenario: Logs batched for writes
- **WHEN** logs are generated during execution
- **THEN** system buffers up to 100 log entries or 1 second (whichever comes first) before flushing to database

#### Scenario: Logs flushed on execution completion
- **WHEN** execution reaches terminal state
- **THEN** system immediately flushes all buffered logs for that execution to database
