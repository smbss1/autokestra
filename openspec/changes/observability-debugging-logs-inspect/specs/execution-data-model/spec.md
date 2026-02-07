## ADDED Requirements

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
