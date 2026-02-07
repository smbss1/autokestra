## ADDED Requirements

### Requirement: CLI command for log retrieval

The system SHALL provide `workflow execution logs <execution-id>` command to fetch and display logs.

#### Scenario: Basic log retrieval
- **WHEN** user runs `workflow execution logs <execution-id>`
- **THEN** system displays all logs for that execution ordered by timestamp with format: [timestamp] [level] [source] message

#### Scenario: Invalid execution ID
- **WHEN** user provides non-existent execution-id
- **THEN** system exits with code 1 and error message "Execution not found: <execution-id>"

#### Scenario: No logs available
- **WHEN** execution exists but has no logs
- **THEN** system displays "No logs found for execution <execution-id>" and exits with code 0

### Requirement: Log filtering by task

The system SHALL support filtering logs to specific task via --task flag.

#### Scenario: Filter logs by task ID
- **WHEN** user runs `workflow execution logs <execution-id> --task <task-id>`
- **THEN** system displays only logs where task_id = <task-id> ordered by timestamp

#### Scenario: Invalid task ID
- **WHEN** user provides task-id that doesn't exist in execution
- **THEN** system displays "No logs found for task <task-id> in execution <execution-id>" and exits with code 0

### Requirement: Log filtering by level

The system SHALL support filtering logs by severity level via --level flag.

#### Scenario: Filter logs by level
- **WHEN** user runs `workflow execution logs <execution-id> --level ERROR`
- **THEN** system displays only logs where level = ERROR

#### Scenario: Multiple levels accepted
- **WHEN** user runs `workflow execution logs <execution-id> --level WARN,ERROR`
- **THEN** system displays logs where level IN (WARN, ERROR)

#### Scenario: Invalid level value
- **WHEN** user provides invalid level (not DEBUG/INFO/WARN/ERROR)
- **THEN** system exits with code 1 and error message "Invalid log level. Must be one of: DEBUG, INFO, WARN, ERROR"

### Requirement: Log filtering by time range

The system SHALL support filtering logs by time range via --since flag.

#### Scenario: Filter logs by relative time
- **WHEN** user runs `workflow execution logs <execution-id> --since 5m`
- **THEN** system displays logs from last 5 minutes (timestamp > now - 5 minutes)

#### Scenario: Supported time units
- **WHEN** user provides --since with value
- **THEN** system accepts: s (seconds), m (minutes), h (hours), d (days)

#### Scenario: Invalid time format
- **WHEN** user provides invalid --since value
- **THEN** system exits with code 1 and error message "Invalid time format. Examples: 5m, 2h, 1d"

### Requirement: Real-time log streaming

The system SHALL support real-time log streaming for running executions via --follow flag.

#### Scenario: Stream logs for running execution
- **WHEN** user runs `workflow execution logs <execution-id> --follow`
- **THEN** system displays existing logs and polls for new logs every 100ms until execution completes

#### Scenario: Follow exits on execution completion
- **WHEN** streaming logs and execution reaches terminal state
- **THEN** system displays final logs and exits with code 0

#### Scenario: Follow on completed execution
- **WHEN** user runs --follow on already-completed execution
- **THEN** system displays all logs and exits immediately (no streaming)

#### Scenario: Follow with Ctrl+C
- **WHEN** user presses Ctrl+C during --follow
- **THEN** system stops streaming and exits gracefully with code 130

### Requirement: JSON output format

The system SHALL support machine-readable JSON output via --json flag.

#### Scenario: JSON output structure
- **WHEN** user runs `workflow execution logs <execution-id> --json`
- **THEN** system outputs JSON array of log objects with fields: execution_id, task_id, timestamp, level, source, message, metadata

#### Scenario: JSON with filters
- **WHEN** user combines --json with --task or --level or --since
- **THEN** system outputs filtered logs in JSON format

#### Scenario: JSON streaming not supported
- **WHEN** user combines --json with --follow
- **THEN** system exits with code 1 and error message "--json cannot be used with --follow"

### Requirement: Log output formatting

The system SHALL format log output for readability.

#### Scenario: Timestamp formatting
- **WHEN** logs are displayed (non-JSON)
- **THEN** timestamps shown as ISO 8601 format (YYYY-MM-DDTHH:mm:ss.SSSZ)

#### Scenario: Level color coding
- **WHEN** output is to terminal (not piped)
- **THEN** ERROR in red, WARN in yellow, INFO in default, DEBUG in gray

#### Scenario: Source formatting
- **WHEN** displaying logs
- **THEN** source shown as [scheduler] [worker] [plugin:namespace/plugin.action] for clarity

#### Scenario: Multi-line message handling
- **WHEN** log message contains newlines
- **THEN** system indents continuation lines for visual grouping

### Requirement: Performance for large log sets

The system SHALL handle large log volumes efficiently without excessive memory usage.

#### Scenario: Streaming large log output
- **WHEN** execution has >10,000 log entries
- **THEN** system streams logs to stdout (not loading all into memory)

#### Scenario: Query pagination
- **WHEN** fetching logs from database
- **THEN** system queries in batches of 1000 rows to avoid memory spikes
