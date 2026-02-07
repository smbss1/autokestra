## 1. Module structure & dependencies

- [ ] 1.1 Create `packages/engine/src/storage` directory structure
- [ ] 1.2 Add `better-sqlite3` dependency to engine package.json
- [ ] 1.3 Create storage module exports in `packages/engine/src/storage/index.ts`

## 2. StateStore interface & types

- [ ] 2.1 Define StateStore interface with CRUD methods for workflows/executions/task runs/attempts
- [ ] 2.2 Define query options types (filters, pagination, sorting)
- [ ] 2.3 Define result types (with total count for pagination)
- [ ] 2.4 Add transaction support to StateStore interface

## 3. SQLite database initialization

- [ ] 3.1 Implement SQLiteStateStore class with better-sqlite3 connection
- [ ] 3.2 Configure WAL mode on database initialization
- [ ] 3.3 Enable foreign key constraints
- [ ] 3.4 Add database path configuration in config schema

## 4. Schema migrations system

- [ ] 4.1 Create migrations directory structure under `packages/engine/src/storage/migrations`
- [ ] 4.2 Implement migration runner with version tracking (schema_version table)
- [ ] 4.3 Create initial migration (001_initial_schema.sql) with workflows/executions/task_runs/attempts/outputs tables
- [ ] 4.4 Add indexes for common queries (executionId, workflowId, state, createdAt)
- [ ] 4.5 Implement migration rollback support
- [ ] 4.6 Add migration status inspection methods

## 5. Workflow persistence

- [ ] 5.1 Implement workflow save method (insert/update)
- [ ] 5.2 Implement workflow retrieval by ID
- [ ] 5.3 Implement workflow list with filtering
- [ ] 5.4 Implement workflow deletion (soft-delete or hard)
- [ ] 5.5 Add tests for workflow CRUD operations

## 6. Execution persistence

- [ ] 6.1 Implement execution create method with initial PENDING state
- [ ] 6.2 Implement execution update method for state transitions
- [ ] 6.3 Implement execution retrieval by ID
- [ ] 6.4 Implement execution list with filters (workflowId, state, date range) and pagination
- [ ] 6.5 Add tests for execution CRUD and queries

## 7. TaskRun persistence

- [ ] 7.1 Implement task run create method linked to execution
- [ ] 7.2 Implement task run update method for state transitions
- [ ] 7.3 Implement task run retrieval by execution ID
- [ ] 7.4 Add tests for task run CRUD operations

## 8. Attempt persistence

- [ ] 8.1 Implement attempt create method with auto-increment attempt number
- [ ] 8.2 Implement attempt retrieval by task run ID
- [ ] 8.3 Add tests for attempt tracking

## 9. Transaction support

- [ ] 9.1 Implement transaction wrapper methods (begin, commit, rollback)
- [ ] 9.2 Add atomic update methods for execution + task runs together
- [ ] 9.3 Add tests for transaction rollback on error
- [ ] 9.4 Add tests for successful multi-record updates

## 10. Crash recovery logic

- [ ] 10.1 Implement recovery query to detect RUNNING/PENDING executions on startup
- [ ] 10.2 Implement logic to transition RUNNING executions to FAILED with CRASH_RECOVERY reason
- [ ] 10.3 Implement logic to re-queue PENDING/WAITING executions
- [ ] 10.4 Add recovery logging and metrics
- [ ] 10.5 Add tests for recovery scenarios

## 11. Integration with execution engine

- [ ] 11.1 Update execution state machine to call StateStore on transitions
- [ ] 11.2 Update scheduler to persist execution creation
- [ ] 11.3 Update worker pool to persist task run state changes
- [ ] 11.4 Add state store initialization in engine startup
- [ ] 11.5 Add crash recovery call in engine startup

## 12. CLI integration

- [ ] 12.1 Update `execution list` command to query StateStore
- [ ] 12.2 Update `execution inspect` command to load from StateStore
- [ ] 12.3 Update `execution logs` command to query StateStore
- [ ] 12.4 Add filtering and pagination support to CLI commands
- [ ] 12.5 Add JSON output formatting for CLI queries

## 13. Configuration

- [ ] 13.1 Add storage configuration schema (type, sqlite.path, retentionDays)
- [ ] 13.2 Add default SQLite path in config.example.yaml
- [ ] 13.3 Add configuration validation for storage settings
- [ ] 13.4 Document storage configuration options

## 14. Performance & indexes

- [ ] 14.1 Add composite index on (workflowId, createdAt) for workflow execution queries
- [ ] 14.2 Add index on (executionId) for task run lookups
- [ ] 14.3 Add index on (state, createdAt) for status filtering
- [ ] 14.4 Run performance tests for common queries on 1000+ records
- [ ] 14.5 Optimize query plans based on test results

## 15. Retention & cleanup

- [ ] 15.1 Implement retention policy query (find old completed executions)
- [ ] 15.2 Implement cascading delete for executions (with task runs/attempts)
- [ ] 15.3 Add scheduled cleanup job or CLI command
- [ ] 15.4 Add tests for retention policy

## 16. Tests

- [ ] 16.1 Add unit tests for SQLiteStateStore methods
- [ ] 16.2 Add integration tests with temporary SQLite database
- [ ] 16.3 Add tests for migration system (up/down, version tracking)
- [ ] 16.4 Add tests for concurrent access scenarios
- [ ] 16.5 Add tests for crash recovery logic
- [ ] 16.6 Add performance benchmarks for common queries
