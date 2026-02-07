## ADDED Requirements

### Requirement: SQLite log storage schema

The system SHALL store logs in SQLite table with efficient indexing for query performance.

#### Scenario: Logs table created on migration
- **WHEN** database migration runs
- **THEN** system creates execution_logs table with columns: id (autoincrement), execution_id, task_id (nullable), timestamp, level, source, message, metadata (nullable JSON)

#### Scenario: Execution index created
- **WHEN** logs table is created
- **THEN** system creates index on (execution_id, timestamp) for efficient execution log queries

#### Scenario: Task index created
- **WHEN** logs table is created
- **THEN** system creates index on (task_id, timestamp) for efficient task log queries

### Requirement: Log persistence with transactions

The system SHALL write logs to SQLite using transactions for consistency.

#### Scenario: Batch log writes
- **WHEN** buffered logs are flushed
- **THEN** system writes all logs in single transaction to ensure atomicity

#### Scenario: Log writes do not block state updates
- **WHEN** execution state changes
- **THEN** state update and associated log writes occur in same transaction but log failures do not rollback state changes (log errors are logged but do not fail execution)

### Requirement: Log retention policy

The system SHALL automatically delete logs older than retention period to prevent unbounded database growth.

#### Scenario: Retention period configurable
- **WHEN** engine starts
- **THEN** system reads AUTOKESTRA_LOG_RETENTION_DAYS environment variable (default: 30 days)

#### Scenario: Cleanup runs on startup
- **WHEN** engine starts
- **THEN** system deletes all logs with timestamp older than retention period

#### Scenario: Cleanup runs daily
- **WHEN** engine has been running for 24 hours
- **THEN** system triggers log cleanup job to delete expired logs

#### Scenario: Cleanup is incremental
- **WHEN** cleanup job runs
- **THEN** system deletes logs in batches of 1000 to avoid long-running transactions

### Requirement: Efficient log queries

The system SHALL support efficient log retrieval by execution_id and task_id.

#### Scenario: Query logs by execution
- **WHEN** user requests logs for execution_id
- **THEN** system uses index to retrieve all logs for that execution ordered by timestamp

#### Scenario: Query logs by task
- **WHEN** user requests logs for specific task_id
- **THEN** system uses index to retrieve task-specific logs ordered by timestamp

#### Scenario: Query logs with time range filter
- **WHEN** user requests logs with --since flag
- **THEN** system filters logs WHERE timestamp > (now - since_duration) using timestamp index

#### Scenario: Query logs with level filter
- **WHEN** user requests logs with --level flag
- **THEN** system filters logs WHERE level = specified_level (post-index filtering acceptable)

### Requirement: Log metadata storage

The system SHALL store structured metadata as JSON for rich debugging information.

#### Scenario: Error stack stored in metadata
- **WHEN** task fails with error
- **THEN** system stores error.stack as JSON in metadata column for detailed debugging

#### Scenario: Task retry attempt stored in metadata
- **WHEN** task is retried
- **THEN** system stores {"attempt": N, "reason": "..."} in metadata column

#### Scenario: Plugin execution context in metadata
- **WHEN** plugin log is captured
- **THEN** system stores {"plugin": "namespace/plugin", "action": "actionName"} in metadata

### Requirement: Database size monitoring

The system SHALL track execution_logs table size to warn operators of storage issues.

#### Scenario: Log storage size available in metrics
- **WHEN** operator queries engine status
- **THEN** system reports execution_logs row count and approximate table size in MB

#### Scenario: Warning on excessive log growth
- **WHEN** execution_logs table exceeds 1GB
- **THEN** system logs WARNING suggesting shorter retention period or log filtering
