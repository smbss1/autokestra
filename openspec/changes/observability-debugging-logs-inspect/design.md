## Context

The workflow engine currently tracks execution state transitions (PENDING → RUNNING → SUCCESS/FAILED) and persists task results in the state store. However, there's no structured logging system to capture the detailed flow of execution, debug information, or operational events. Operators need visibility into:

- What happened during task execution (stdout/stderr from plugins)
- Why an execution failed (error messages, stack traces)
- How long each task took (performance debugging)
- What state changes occurred (audit trail)

Current constraints:
- Must work with existing SQLite state store (no new databases)
- CLI-first (no web UI for log viewing in v1)
- Lightweight (modest hardware: 2 CPU / 4GB RAM)
- Plugin logs must be captured from child processes (trusted mode) or Docker containers (restricted mode) without breaking isolation

Stakeholders: developers debugging workflows, operators monitoring production, security teams auditing executions.

## Goals / Non-Goals

**Goals:**
- Capture structured logs from all execution components (scheduler, worker pool, plugin runtime)
- Store logs in SQLite with efficient querying by execution_id and task_id
- Provide CLI commands for log retrieval with filtering (level, task, time range)
- Support real-time log streaming for running executions (tail -f equivalent)
- Capture audit trail of execution lifecycle events
- Include task debugging metadata (inputs, outputs, duration, errors)
- Enable JSON output for programmatic access

**Non-Goals:**
- Web UI for log viewing (CLI only in v1)
- Log aggregation across multiple engine instances (single-node only)
- Advanced log analytics or visualization
- Log forwarding to external systems (e.g., Elasticsearch, Splunk)
- Distributed tracing (correlation within single engine only)

## Decisions

### Decision 1: Store logs in SQLite (same DB as state store)

**Rationale:** Simplifies deployment (no additional database), leverages existing persistence layer, keeps logs co-located with execution state for efficient joins.

**Alternatives considered:**
- File-based logs: Harder to query, rotation complexity, no atomic transactions with state
- Separate log database: Adds operational complexity, requires sync logic
- In-memory only: Loses logs on restart, insufficient for debugging

**Trade-off:** SQLite write performance may limit log throughput on high-volume workloads, but acceptable for v1 single-node constraint.

### Decision 2: Use correlation IDs (execution_id + task_id) for log linking

**Rationale:** Enables efficient querying (index on execution_id), natural grouping for display, supports task-level filtering.

**Schema:**
```sql
CREATE TABLE execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  task_id TEXT,  -- NULL for execution-level logs
  timestamp INTEGER NOT NULL,  -- Unix timestamp (ms)
  level TEXT NOT NULL,  -- DEBUG, INFO, WARN, ERROR
  source TEXT NOT NULL,  -- scheduler, worker, plugin:<name>
  message TEXT NOT NULL,
  metadata TEXT  -- JSON for structured data (e.g., error stack)
);
CREATE INDEX idx_logs_execution ON execution_logs(execution_id, timestamp);
CREATE INDEX idx_logs_task ON execution_logs(task_id, timestamp);
```

**Alternatives considered:**
- Flat file with grep: Not queryable, slow for filtering
- Separate table per execution: Schema explosion, complex cleanup

### Decision 3: Capture plugin logs via stdout/stderr interception

**Rationale:** Plugins are TypeScript modules executed in child processes (trusted mode via Bun.spawn()) or Docker containers (restricted mode with network/filesystem isolation). Logs are written to stdout/stderr and must be intercepted at the runtime boundary, parsed into structured logs with plugin source tag.

**Implementation:** Plugin executor (ProcessRuntime or DockerRuntime) captures stdout/stderr streams from the child process or container, splits by line, timestamps each line, tags with `plugin:<namespace>/<plugin>.<action>`, writes to execution_logs table. Plugin SDK's `context.log` methods write to stderr for structured logging.

**Alternatives considered:**
- Require plugins to use structured logging API only: Breaks simplicity for plugins that just use console.log
- Stream logs to separate file per plugin: Harder to correlate, cleanup complexity
- Embed logging in plugin SDK only: Misses stdout/stderr from plugin dependencies or external commands

### Decision 4: Implement `workflow execution logs` with streaming support

**CLI interface:**
```bash
# Basic retrieval
workflow execution logs <execution-id>

# Filtering
workflow execution logs <execution-id> --task <task-id> --level ERROR --since 5m

# Real-time streaming
workflow execution logs <execution-id> --follow

# JSON output
workflow execution logs <execution-id> --json
```

**Streaming implementation:** Poll execution_logs table for new rows (query `WHERE timestamp > last_seen`), display incrementally. Exit when execution reaches terminal state (SUCCESS/FAILED/CANCELLED).

**Alternatives considered:**
- WebSocket streaming: Requires server component, out of scope for CLI-first v1
- Server-sent events: Same complexity as WebSocket

### Decision 5: Store audit events in separate table

**Rationale:** Audit trail has different schema (event_type, before/after state) and query patterns (timeline view). Separate table keeps logs table optimized for text search.

**Schema:**
```sql
CREATE TABLE execution_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- CREATED, STARTED, STATE_CHANGE, COMPLETED, FAILED, CANCELLED
  timestamp INTEGER NOT NULL,
  metadata TEXT NOT NULL  -- JSON with event-specific data (e.g., {from: "RUNNING", to: "FAILED"})
);
CREATE INDEX idx_audit_execution ON execution_audit_events(execution_id, timestamp);
```

**Alternatives considered:**
- Store audit events in execution_logs: Pollutes log stream with system events
- No separate audit trail: Loses immutable record of state transitions

### Decision 6: Implement log retention policy

**Rationale:** Prevent unbounded database growth. Logs are debugging tools, not permanent records.

**Policy:** Delete logs older than 30 days (configurable via `AUTOKESTRA_LOG_RETENTION_DAYS`). Run cleanup on server startup and daily thereafter.

**Alternatives considered:**
- No retention: Database grows indefinitely
- Retention by execution count: Hard to reason about, uneven storage usage
- Separate archive storage: Adds complexity, out of scope for v1

## Risks / Trade-offs

**[Risk: SQLite write contention on high-volume logging]**
→ **Mitigation:** Batch log writes (flush every 100 logs or 1 second), use WAL mode (already enabled), accept that extreme throughput may require external log store in future.

**[Risk: Plugin log interception breaks on stderr-heavy plugins]**
→ **Mitigation:** Buffer plugin output (max 10MB per task), truncate with warning if exceeded. Document best practice: plugins should log to stdout sparingly.

**[Risk: Log streaming may miss logs on fast executions]**
→ **Mitigation:** Polling interval of 100ms should catch most logs. If execution completes during poll, final fetch retrieves all remaining logs.

**[Trade-off: No distributed tracing]**
→ **Accept:** Single-node engine doesn't need distributed correlation. Can add OpenTelemetry later if multi-node deployment is supported.

**[Trade-off: Text-based log messages (not fully structured)]**
→ **Accept:** Full structured logging (every field as JSON) would complicate plugin SDK. Text messages with optional metadata JSON strikes balance between usability and queryability.

**[Risk: Audit events could drift from actual state if not transactional]**
→ **Mitigation:** Write audit event in same transaction as state change. State store already uses transactions for state updates.

## Migration Plan

**Deployment steps:**
1. Add new tables (execution_logs, execution_audit_events) via migration script
2. Update execution engine to emit logs and audit events
3. Deploy CLI with new `logs` and `inspect` commands
4. No breaking changes to existing APIs or data models

**Rollback strategy:**
- New tables are additive (no schema changes to existing tables)
- If issues arise, can drop new tables and continue with existing state tracking
- CLI commands gracefully handle missing tables (warn user to run migrations)

**No data migration required:** This is a new capability, no existing data to migrate.

## Open Questions

1. **Should logs be encrypted at rest?** 
   - Logs may contain sensitive data (plugin inputs/outputs). Consider encrypting `message` and `metadata` columns if secrets leak into logs.
   - Defer to security review: add encryption if required, otherwise accept that SQLite file permissions are sufficient.

2. **How to handle log correlation for retried tasks?**
   - If a task is retried (retry policy), should logs use the same task_id or a unique attempt_id?
   - Proposal: Use task_id + attempt number in metadata field (`{"attempt": 2}`) to group retries while preserving individual attempt logs.

3. **Should `workflow execution inspect` show live state or snapshot?**
   - For running executions, should it query current state (live) or show last snapshot?
   - Proposal: Always show current state (query state_store + execution_logs), note in output if execution is still running.
