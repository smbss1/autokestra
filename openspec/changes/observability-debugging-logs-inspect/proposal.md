## Why

As the workflow engine executes tasks, users need visibility into what's happening, why failures occur, and how to debug issues. Currently, the engine has execution state tracking but lacks comprehensive log aggregation, structured inspection commands, and debugging tools. Without these capabilities, developers struggle to diagnose failures, understand execution flow, and troubleshoot production issues. This change delivers the observability foundation required for operational confidence.

## What Changes

- Add structured log collection for workflow executions, tasks, and plugin invocations
- Implement `workflow execution logs <execution-id>` CLI command with filtering and streaming
- Implement `workflow execution inspect <execution-id>` CLI command showing detailed execution state
- Add log storage layer with SQLite-based persistence and retention policies
- Implement log correlation between workflow → execution → tasks → plugin calls
- Add real-time log streaming for running executions (follow mode)
- Implement task-level debugging metadata (inputs, outputs, duration, error traces)
- Add audit trail for execution lifecycle events (created, started, completed, failed, cancelled)
- Expose JSON output format for all inspection commands (machine-readable)

## Capabilities

### New Capabilities
- `execution-log-collection`: Structured log capture from workflow engine, task executor, and plugin runtime with correlation IDs
- `execution-log-storage`: SQLite-based log persistence with retention policies and efficient querying
- `execution-log-retrieval`: CLI command to fetch, filter, and stream logs for executions and tasks
- `execution-inspection`: CLI command to inspect detailed execution state, task outputs, and debugging metadata
- `execution-audit-trail`: Immutable audit log of execution lifecycle transitions and state changes

### Modified Capabilities
- `execution-data-model`: Add log correlation fields (execution_id, task_id, timestamp, level, message) to support log queries
- `execution-lifecycle-controls`: Emit audit events for all state transitions to support observability

## Impact

**Code Areas:**
- Execution engine: Add structured logging with correlation IDs
- Worker pool: Capture task-level logs and outputs
- Plugin runtime (ProcessRuntime/DockerRuntime): Intercept plugin stdout/stderr from child processes/containers and structure as logs
- State store: Extend with logs table and audit_events table
- CLI: New commands under `workflow execution logs|inspect`

**New Dependencies:**
- Log formatting library (for structured output)
- Potentially log rotation utilities (if implementing file-based logs)

**Database Schema:**
- New `execution_logs` table (execution_id, task_id, timestamp, level, source, message)
- New `execution_audit_events` table (execution_id, event_type, timestamp, metadata)

**APIs:**
- Internal log collection API for engine components
- CLI commands for log retrieval and inspection
