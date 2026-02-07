# execution-audit-trail Specification

## Purpose
Define requirements for recording and querying an immutable execution audit trail for lifecycle events and debugging.

## Requirements

### Requirement: Audit event capture for execution lifecycle

The system SHALL capture immutable audit events for all execution state transitions.

#### Scenario: Execution created event
- **WHEN** new execution is created
- **THEN** system creates audit event with type=CREATED, timestamp, metadata={workflow_id, trigger_type}

#### Scenario: Execution started event
- **WHEN** execution transitions to RUNNING
- **THEN** system creates audit event with type=STARTED, timestamp

#### Scenario: Execution state change event
- **WHEN** execution state changes (e.g., RUNNING → FAILED)
- **THEN** system creates audit event with type=STATE_CHANGE, metadata={from_state, to_state, reason}

#### Scenario: Execution completed event
- **WHEN** execution reaches SUCCESS state
- **THEN** system creates audit event with type=COMPLETED, timestamp, metadata={duration, task_count}

#### Scenario: Execution failed event
- **WHEN** execution reaches FAILED state
- **THEN** system creates audit event with type=FAILED, timestamp, metadata={error_message, failed_task_id}

#### Scenario: Execution cancelled event
- **WHEN** execution is cancelled by user
- **THEN** system creates audit event with type=CANCELLED, timestamp, metadata={cancelled_by, reason}

### Requirement: Audit event storage

The system SHALL store audit events in SQLite table with immutability guarantees.

#### Scenario: Audit events table created
- **WHEN** database migration runs
- **THEN** system creates execution_audit_events table with columns: id (autoincrement), execution_id, event_type, timestamp, metadata (JSON)

#### Scenario: Audit events indexed by execution
- **WHEN** audit table is created
- **THEN** system creates index on (execution_id, timestamp) for efficient chronological queries

#### Scenario: Audit events are append-only
- **WHEN** audit event is written
- **THEN** no UPDATE or DELETE operations allowed on audit events (enforced by application logic)

### Requirement: Audit event querying

The system SHALL support efficient retrieval of audit events for inspection.

#### Scenario: Query audit events by execution
- **WHEN** inspection command requests audit trail
- **THEN** system retrieves all audit events for execution_id ordered by timestamp

#### Scenario: Audit events included in JSON output
- **WHEN** user runs `workflow execution inspect <execution-id> --json`
- **THEN** JSON output includes "audit_events" array with all events

#### Scenario: Audit events filtered by type
- **WHEN** system queries for specific event types (e.g., only STATE_CHANGE)
- **THEN** query uses WHERE event_type = filter efficiently

### Requirement: Audit event metadata structure

The system SHALL store event-specific metadata as JSON for rich audit trail.

#### Scenario: CREATED event metadata
- **WHEN** execution is created
- **THEN** metadata includes: workflow_id, trigger_type (cron/webhook/manual)

#### Scenario: STATE_CHANGE event metadata
- **WHEN** state changes
- **THEN** metadata includes: from_state, to_state, reason (optional)

#### Scenario: FAILED event metadata
- **WHEN** execution fails
- **THEN** metadata includes: error_message, failed_task_id, stack_trace (optional)

#### Scenario: CANCELLED event metadata
- **WHEN** execution is cancelled
- **THEN** metadata includes: cancelled_by (user/system), reason (optional), pending_task_count

### Requirement: Audit event transactionality

The system SHALL write audit events atomically with state changes.

#### Scenario: State change and audit event in same transaction
- **WHEN** execution state is updated
- **THEN** corresponding audit event is written in same database transaction to ensure consistency

#### Scenario: Audit event write failure does not block execution
- **WHEN** audit event write fails (rare)
- **THEN** state change proceeds (audit is best-effort) and error is logged

### Requirement: Audit event retention

The system SHALL apply same retention policy to audit events as logs.

#### Scenario: Audit events cleaned with logs
- **WHEN** log retention cleanup runs
- **THEN** system also deletes audit events older than retention period (30 days default)

#### Scenario: Audit event count tracked
- **WHEN** operator queries engine status
- **THEN** system reports execution_audit_events row count for capacity planning

### Requirement: Audit trail security

The system SHALL protect audit events from tampering.

#### Scenario: No programmatic deletion of audit events
- **WHEN** application code attempts to delete individual audit events
- **THEN** system prevents deletion (only bulk cleanup by retention policy allowed)

#### Scenario: No modification of audit events
- **WHEN** application code attempts to update audit event
- **THEN** system prevents modification (append-only guarantee)

#### Scenario: Audit events survive execution deletion
- **WHEN** execution is deleted via CLI
- **THEN** audit events for that execution remain until retention policy cleanup (provides historical record)
