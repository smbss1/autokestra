## ADDED Requirements

### Requirement: CLI command for execution inspection

The system SHALL provide `workflow execution inspect <execution-id>` command to display detailed execution state.

#### Scenario: Display execution overview
- **WHEN** user runs `workflow execution inspect <execution-id>`
- **THEN** system displays execution metadata: workflow_id, execution_id, status, start_time, end_time (if completed), duration

#### Scenario: Invalid execution ID
- **WHEN** user provides non-existent execution-id
- **THEN** system exits with code 1 and error message "Execution not found: <execution-id>"

### Requirement: Task-level inspection data

The system SHALL display detailed information for each task in the execution.

#### Scenario: Display task list
- **WHEN** inspecting execution
- **THEN** system displays table of tasks with columns: task_id, type, status, duration, start_time, end_time

#### Scenario: Display task dependencies
- **WHEN** task has dependencies (needs field)
- **THEN** system shows which tasks it depends on and dependency resolution status

#### Scenario: Display retry attempts
- **WHEN** task was retried
- **THEN** system shows attempt count and retry reason for each attempt

### Requirement: Task input/output inspection

The system SHALL display task inputs and outputs for debugging.

#### Scenario: Display task inputs
- **WHEN** inspecting execution with --show-inputs flag
- **THEN** system displays resolved inputs for each task (secrets masked as ***SECRET***)

#### Scenario: Display task outputs
- **WHEN** inspecting completed tasks
- **THEN** system displays task outputs (return values from plugins)

#### Scenario: Display task errors
- **WHEN** task failed
- **THEN** system displays error message and stack trace (from metadata)

#### Scenario: Inputs/outputs hidden by default
- **WHEN** user runs inspect without flags
- **THEN** inputs and outputs are NOT displayed (only overview and status) to avoid verbose output

### Requirement: Execution timeline view

The system SHALL provide timeline visualization of task execution.

#### Scenario: Timeline showing task sequence
- **WHEN** user runs `workflow execution inspect <execution-id> --timeline`
- **THEN** system displays ASCII timeline showing when each task started and completed relative to execution start

#### Scenario: Timeline shows parallelism
- **WHEN** multiple tasks ran concurrently
- **THEN** timeline shows overlapping task execution periods

#### Scenario: Timeline with duration labels
- **WHEN** displaying timeline
- **THEN** each task shows duration in human-readable format (e.g., "1.2s", "500ms")

### Requirement: JSON output format for inspection

The system SHALL support machine-readable JSON output via --json flag.

#### Scenario: JSON output structure
- **WHEN** user runs `workflow execution inspect <execution-id> --json`
- **THEN** system outputs JSON object with execution metadata, tasks array (with inputs/outputs/errors), and audit events

#### Scenario: JSON includes all data
- **WHEN** outputting JSON
- **THEN** inputs, outputs, and errors included by default (no --show-inputs needed for JSON)

#### Scenario: JSON timestamp format
- **WHEN** outputting JSON
- **THEN** all timestamps in ISO 8601 format for compatibility

### Requirement: Audit event inspection

The system SHALL display execution audit trail as part of inspection.

#### Scenario: Show audit events
- **WHEN** user runs `workflow execution inspect <execution-id> --audit`
- **THEN** system displays chronological list of audit events (CREATED, STARTED, STATE_CHANGE, COMPLETED/FAILED/CANCELLED)

#### Scenario: Audit events show state transitions
- **WHEN** displaying audit events
- **THEN** STATE_CHANGE events show from_state and to_state

#### Scenario: Audit events include metadata
- **WHEN** audit event has metadata (e.g., cancellation reason)
- **THEN** system displays relevant metadata fields

### Requirement: Live execution inspection

The system SHALL handle inspection of currently-running executions.

#### Scenario: Inspect running execution
- **WHEN** user inspects execution with status=RUNNING
- **THEN** system displays current state with note "Execution in progress" and shows completed tasks plus currently-running tasks

#### Scenario: Running tasks marked clearly
- **WHEN** displaying running execution
- **THEN** tasks with status=RUNNING shown with indicator (e.g., "⏳ RUNNING")

#### Scenario: Duration for running tasks
- **WHEN** displaying running tasks
- **THEN** duration shown as elapsed time since task start (e.g., "running for 2m 30s")

### Requirement: Inspection output formatting

The system SHALL format inspection output for readability.

#### Scenario: Table formatting for tasks
- **WHEN** displaying task list
- **THEN** system uses aligned columns with clear headers

#### Scenario: Status color coding
- **WHEN** output is to terminal (not piped)
- **THEN** SUCCESS in green, FAILED in red, RUNNING in yellow, PENDING in gray

#### Scenario: Human-readable durations
- **WHEN** displaying durations
- **THEN** format as "1m 30s", "500ms", "2.5s" (not raw milliseconds)

#### Scenario: Truncate long values
- **WHEN** task input/output is large (>200 chars)
- **THEN** system truncates with "... (truncated)" unless user specifies --no-truncate

### Requirement: Performance for complex workflows

The system SHALL handle inspection of workflows with many tasks efficiently.

#### Scenario: Efficient data loading
- **WHEN** inspecting execution with >100 tasks
- **THEN** system loads execution metadata and task states in single query (avoid N+1 queries)

#### Scenario: Pagination for large task lists
- **WHEN** workflow has >50 tasks
- **THEN** system displays summary by default, suggests using --task <task-id> for specific task inspection
