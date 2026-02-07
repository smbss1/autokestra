## 1. Database Schema & Migrations

- [x] 1.1 Create migration script for execution_logs table (id, execution_id, task_id, timestamp, level, source, message, metadata)
- [x] 1.2 Create migration script for execution_audit_events table (id, execution_id, event_type, timestamp, metadata)
- [x] 1.3 Add indexes: idx_logs_execution (execution_id, timestamp), idx_logs_task (task_id, timestamp)
- [x] 1.4 Add index: idx_audit_execution (execution_id, timestamp)
- [x] 1.5 Test migrations with SQLite (verify tables created, indexes exist)
- [x] 1.6 Add rollback migrations for testing

## 2. Log Collection Infrastructure

- [x] 2.1 Create LogCollector class with structured log entry interface (execution_id, task_id, level, source, message, metadata)
- [x] 2.2 Implement log buffering (max 100 entries or 1 second, whichever first)
- [x] 2.3 Implement flush-on-completion for execution termination
- [x] 2.4 Add log level enum (DEBUG, INFO, WARN, ERROR)
- [x] 2.5 Implement batch write to execution_logs table using transactions
- [x] 2.6 Add unit tests for LogCollector (buffering, flushing, transaction handling)

## 3. Execution Engine Log Integration

- [x] 3.1 Integrate LogCollector into Scheduler for execution lifecycle logs
- [x] 3.2 Log execution CREATED event (workflow_id, trigger_type)
- [x] 3.3 Log execution STARTED event (transition to RUNNING)
- [x] 3.4 Log execution COMPLETED/FAILED/CANCELLED events with metadata
- [x] 3.5 Add correlation ID (execution_id) to all scheduler logs
- [x] 3.6 Test scheduler logging (verify logs written for each state transition)

## 4. Worker Pool Log Integration

- [x] 4.1 Integrate LogCollector into WorkerPool task executor
- [x] 4.2 Log task start (task_id, task type, masked inputs)
- [x] 4.3 Log task completion (status, duration, outputs/errors)
- [x] 4.4 Log task retry attempts (attempt number, reason)
- [x] 4.5 Add correlation IDs (execution_id + task_id) to all worker logs
- [x] 4.6 Test worker logging (verify task logs have correct correlation)

## 5. Plugin Runtime Log Integration

- [x] 5.1 Intercept plugin stdout in PluginExecutor
- [x] 5.2 Intercept plugin stderr in PluginExecutor
- [x] 5.3 Parse stdout/stderr line-by-line and create log entries
- [x] 5.4 Tag plugin logs with source=plugin:<namespace>/<plugin>.<action>
- [x] 5.5 Implement 10MB truncation limit per task with warning log
- [x] 5.6 Test plugin log capture (verify stdout/stderr captured correctly)

## 6. Audit Trail Implementation

- [x] 6.1 Create AuditLogger class with event emission interface
- [x] 6.2 Implement audit event write to execution_audit_events table
- [x] 6.3 Ensure audit events written in same transaction as state changes
- [x] 6.4 Emit CREATED event on execution creation
- [x] 6.5 Emit STARTED event on execution start
- [x] 6.6 Emit STATE_CHANGE events for all state transitions (with from/to state in metadata)
- [x] 6.7 Emit COMPLETED/FAILED/CANCELLED events with appropriate metadata
- [x] 6.8 Test audit logger (verify events are immutable, transactional)

## 7. Log Retention & Cleanup

- [x] 7.1 Implement log retention configuration (AUTOKESTRA_LOG_RETENTION_DAYS env var, default 30)
- [x] 7.2 Implement cleanup job that deletes logs older than retention period
- [x] 7.3 Implement incremental cleanup (batches of 1000 rows)
- [x] 7.4 Run cleanup on server startup
- [x] 7.5 Schedule daily cleanup job
- [x] 7.6 Apply same retention to audit events
- [x] 7.7 Test cleanup (verify old logs deleted, recent logs preserved)

## 8. Log Retrieval Query Layer

- [x] 8.1 Create LogStore class with query methods
- [x] 8.2 Implement getLogsByExecution(execution_id, filters) method
- [x] 8.3 Implement getLogsByTask(task_id, filters) method
- [x] 8.4 Support filters: level (array), since (duration), task_id
- [x] 8.5 Implement pagination (fetch in batches of 1000 rows)
- [x] 8.6 Add streaming query support (for --follow mode)
- [x] 8.7 Test log queries (verify indexes used, performance acceptable)

## 9. CLI - workflow execution logs Command

- [x] 9.1 Add `workflow execution logs <execution-id>` command to CLI
- [x] 9.2 Implement basic log retrieval and display (timestamp, level, source, message)
- [x] 9.3 Add --task <task-id> filter support
- [x] 9.4 Add --level <level> filter support (accepts comma-separated levels)
- [x] 9.5 Add --since <duration> filter support (parse 5m, 2h, 1d formats)
- [x] 9.6 Add --follow flag for real-time streaming (poll every 100ms)
- [x] 9.7 Implement follow exit on execution completion
- [x] 9.8 Add --json flag for machine-readable output
- [x] 9.9 Implement log output formatting (color coding, timestamp formatting)
- [x] 9.10 Handle multi-line log messages (indent continuation lines)
- [x] 9.11 Add error handling (execution not found, invalid filters)
- [x] 9.12 Test CLI command (verify all flags work, output formats correct)

## 10. Execution Inspection Query Layer

- [x] 10.1 Create ExecutionInspector class
- [x] 10.2 Implement getExecutionOverview(execution_id) method (metadata, status, timestamps)
- [x] 10.3 Implement getTaskDetails(execution_id) method (task list with status, duration)
- [x] 10.4 Implement getTaskInputsOutputs(task_id) method (with secrets masking)
- [x] 10.5 Implement getAuditTrail(execution_id) method
- [x] 10.6 Add timeline generation logic (task start/end times relative to execution)
- [x] 10.7 Test inspection queries (verify efficient joins, no N+1 queries)

## 11. CLI - workflow execution inspect Command

- [x] 11.1 Add `workflow execution inspect <execution-id>` command to CLI
- [x] 11.2 Display execution overview (workflow_id, status, duration, timestamps)
- [x] 11.3 Display task table (task_id, type, status, duration, start/end times)
- [x] 11.4 Add --show-inputs flag to display task inputs (with secrets masked)
- [x] 11.5 Display task outputs and errors for completed tasks
- [x] 11.6 Add --timeline flag for ASCII timeline visualization
- [x] 11.7 Implement timeline rendering (show task parallelism, duration labels)
- [x] 11.8 Add --audit flag to display audit event timeline
- [x] 11.9 Add --json flag for machine-readable output (includes all data)
- [x] 11.10 Handle running executions (show current state, mark running tasks)
- [x] 11.11 Implement output formatting (tables, color coding, human-readable durations)
- [x] 11.12 Add truncation for long values (--no-truncate flag to override)
- [x] 11.13 Test CLI command (verify all flags work, formats correct)

## 12. Execution Data Model Updates

- [x] 12.1 Add log_entry_count field to Execution model
- [x] 12.2 Update log_entry_count on log writes
- [x] 12.3 Add inputs, outputs, error fields to TaskRun model (JSON storage)
- [x] 12.4 Store masked inputs on task start
- [x] 12.5 Store outputs on task success
- [x] 12.6 Store error details on task failure
- [x] 12.7 Calculate and store duration_ms on task completion
- [x] 12.8 Test data model updates (verify fields populated correctly)

## 13. Lifecycle Controls Log Integration

- [x] 13.1 Emit audit event on execution cancellation (type=CANCELLED, metadata with reason)
- [x] 13.2 Emit audit event on execution timeout (type=TIMEOUT, metadata with duration)
- [x] 13.3 Emit STATE_CHANGE audit events for all transitions
- [x] 13.4 Log cancellation requests (level=WARN, message with user/system info)
- [x] 13.5 Log timeout events (level=ERROR, message with timeout details)
- [x] 13.6 Log cancellation propagation to tasks
- [x] 13.7 Test lifecycle event logging (verify audit trail and logs created)

## 14. Performance & Optimization

- [x] 14.1 Verify SQLite WAL mode enabled for log writes
- [x] 14.2 Test log write performance (benchmark with 10k log entries)
- [x] 14.3 Test query performance (benchmark execution with 100+ tasks)
- [x] 14.4 Optimize batch sizes if needed (buffering, pagination)
- [x] 14.5 Add database size monitoring (track execution_logs and audit_events table sizes)
- [x] 14.6 Log WARNING when tables exceed 1GB

## 15. Integration Tests

- [x] 15.1 End-to-end test: create execution → verify logs captured
- [x] 15.2 Test: retrieve logs via CLI for completed execution
- [x] 15.3 Test: stream logs for running execution (--follow)
- [x] 15.4 Test: inspect execution with multiple tasks
- [x] 15.5 Test: plugin stdout/stderr captured correctly
- [x] 15.6 Test: audit trail shows all lifecycle events
- [x] 15.7 Test: log retention cleanup deletes old logs
- [x] 15.8 Test: filtering works (task, level, since)
- [x] 15.9 Test: JSON output format for logs and inspect
- [x] 15.10 Test: secrets masked in task inputs

## 16. Documentation

- [x] 16.1 Document log collection architecture in design docs
- [x] 16.2 Document CLI commands (logs, inspect) with examples
- [x] 16.3 Document configuration options (log retention)
- [x] 16.4 Document log levels and when to use each
- [x] 16.5 Document audit trail structure and use cases
- [x] 16.6 Add troubleshooting guide (common issues, performance tuning)
- [x] 16.7 Update README with observability features

## 17. Error Handling & Edge Cases

- [x] 17.1 Handle missing execution_id gracefully (error message, exit code 1)
- [x] 17.2 Handle invalid filters (level, since format) with clear errors
- [x] 17.3 Handle database write failures (log to stderr, continue execution)
- [x] 17.4 Handle log buffer overflow (flush early, log warning)
- [x] 17.5 Handle plugin log truncation edge cases (very long lines)
- [x] 17.6 Handle concurrent log writes (transaction isolation)
- [x] 17.7 Test all error scenarios (verify graceful degradation)
