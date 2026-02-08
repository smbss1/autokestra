## ADDED Requirements

### Requirement: v0.1 runs locally with a deterministic happy-path
The system MUST support a local, single-node workflow execution happy-path that is fully documented and repeatable.

#### Scenario: Start server and run a workflow locally
- **WHEN** a user starts the server with a valid YAML config
- **THEN** the server starts successfully and exposes `GET /health`
- **WHEN** the user applies an example workflow via CLI or API
- **THEN** the workflow is persisted and can be listed/described
- **WHEN** the user triggers an execution of the workflow
- **THEN** the execution reaches a terminal state (`SUCCESS` or `FAILED`) deterministically given the same inputs

### Requirement: SQLite is the default persistence backend for v0.1
The system MUST use SQLite as the default state store in v0.1 without requiring any external dependency.

#### Scenario: State persists across restart
- **WHEN** the server is stopped and restarted using the same SQLite database path
- **THEN** previously applied workflows and executions are still queryable

### Requirement: CLI supports scriptable output and deterministic exit codes
The CLI MUST be suitable for automation.

#### Scenario: JSON output for list commands
- **WHEN** a user runs list commands with `--json`
- **THEN** the CLI outputs a valid JSON document to stdout

#### Scenario: Deterministic error behavior
- **WHEN** a CLI command fails due to invalid input or missing config
- **THEN** it exits with a non-zero code and prints a stable error message (human) or stable error object (JSON mode)

### Requirement: CLI can be invoked as an installed command (no explicit bun invocation)
The system MUST support invoking the CLI as an installed command so users can run server commands without calling Bun directly.

#### Scenario: Start server from installed CLI command
- **WHEN** a user runs `workflow server start` from their shell
- **THEN** the server starts (or fails) with the same behavior as invoking the CLI entrypoint via Bun

### Requirement: Secrets are never exposed in outputs
The system MUST ensure secrets are not included in workflow storage, execution DTOs, or logs.

#### Scenario: Logs and inspection redact secrets
- **WHEN** an execution references a secret via templating
- **THEN** any log lines and inspection/overview payloads redact or mask the secret value

### Requirement: Observability supports debugging an execution
The system MUST allow users to inspect an execution and retrieve its logs.

#### Scenario: Inspect and retrieve logs
- **WHEN** a user requests execution inspection via CLI or API
- **THEN** they receive execution state, timestamps, and task run state sufficient to diagnose failures
- **WHEN** a user requests execution logs with pagination
- **THEN** the system returns logs ordered newest-first and supports filtering by `taskId` and `level`

### Requirement: Plugin execution runs out-of-process and is permission-checked
The system MUST execute plugin tasks out-of-process (as an OS process and/or a Docker container) and enforce deny-by-default permissions declared by the plugin.

#### Scenario: Plugin runs as an OS process
- **WHEN** a workflow executes a plugin task configured to run as an OS process
- **THEN** the plugin code runs in a separate process and its stdout/stderr are captured as execution logs

#### Scenario: Plugin runs as a Docker container
- **WHEN** a workflow executes a plugin task configured to run as a Docker container
- **THEN** the plugin code runs in a container and its logs are captured as execution logs

#### Scenario: Deny-by-default enforcement
- **WHEN** a plugin attempts an operation without an explicitly granted permission
- **THEN** the operation is denied and the failure is observable (error + audit/log signal)
