## ADDED Requirements

### Requirement: Execute scripts from local, git, or inline sources
The system SHALL provide a `core/script.run` plugin action that executes JavaScript/TypeScript workloads from one of three source types: local path, git repository, or inline code.

#### Scenario: Execute from local source
- **WHEN** a workflow task calls `core/script.run` with `source.type=local` and a valid local path
- **THEN** the plugin SHALL resolve the local workspace and execute the requested workload in that workspace

#### Scenario: Execute from git source
- **WHEN** a workflow task calls `core/script.run` with `source.type=git` and a valid repository URL
- **THEN** the plugin SHALL clone the repository, checkout the requested ref when provided, and execute in the resolved workspace

#### Scenario: Execute from inline source
- **WHEN** a workflow task calls `core/script.run` with `source.type=inline`, `language`, and `content`
- **THEN** the plugin SHALL materialize the inline source in a temporary workspace and execute it with the selected runtime

### Requirement: Support private git authentication in v1
The system SHALL support private git repositories in `core/script.run` using either token-based HTTPS authentication or SSH authentication.

#### Scenario: Private git using token
- **WHEN** `source.type=git` and `source.auth.method=token` are provided with a valid token
- **THEN** the plugin SHALL authenticate clone/fetch operations using the token and proceed with execution

#### Scenario: Private git using SSH
- **WHEN** `source.type=git` and `source.auth.method=ssh` are provided with a valid private key
- **THEN** the plugin SHALL authenticate clone/fetch operations using SSH credentials and proceed with execution

### Requirement: Support runtime selection bun and tsx
The system SHALL support runtime selection values `bun`, `tsx`, and `auto` for script execution.

#### Scenario: Explicit bun runtime
- **WHEN** input runtime is `bun`
- **THEN** the plugin SHALL execute the workload with Bun and report `bun` as selected runtime in output

#### Scenario: Explicit tsx runtime
- **WHEN** input runtime is `tsx`
- **THEN** the plugin SHALL execute the workload with tsx and report `tsx` as selected runtime in output

#### Scenario: Auto runtime selection
- **WHEN** input runtime is `auto`
- **THEN** the plugin SHALL apply deterministic runtime resolution and report the selected runtime in output

### Requirement: Execute package lifecycle in project mode
The system SHALL support project mode for repositories/workspaces containing `package.json` and execute lifecycle scripts in order: `prestart`, `start`, `poststart`, when each script exists and is enabled by input flags.

#### Scenario: Full lifecycle execution
- **WHEN** `projectMode=true` and scripts `prestart`, `start`, and `poststart` exist
- **THEN** the plugin SHALL execute them sequentially in that order and record phase-level results

#### Scenario: Missing optional lifecycle script
- **WHEN** `projectMode=true` and one of `prestart` or `poststart` does not exist
- **THEN** the plugin SHALL skip the missing script without failing the task and report it as skipped

#### Scenario: Start script missing
- **WHEN** `projectMode=true` and `start` script does not exist
- **THEN** the plugin SHALL fail the task with a structured error indicating missing script

#### Scenario: No custom start command in v1
- **WHEN** `projectMode=true`
- **THEN** the plugin SHALL use only `package.json` lifecycle scripts (`prestart`, `start`, `poststart`) and SHALL NOT accept an alternate `startCommand` input in v1

### Requirement: Optionally install dependencies before execution
The system SHALL allow optional dependency installation prior to execution via supported tools (`npm`, `pnpm`, `yarn`, `bun`) or an explicit custom install command.

#### Scenario: Install enabled
- **WHEN** `install.enabled=true` with a supported tool
- **THEN** the plugin SHALL run the install phase before execution and include the phase result in output

#### Scenario: Install disabled
- **WHEN** `install.enabled=false`
- **THEN** the plugin SHALL skip installation and continue directly to execution

#### Scenario: Install disabled overrides lockfile detection
- **WHEN** `install.enabled=false` and a lockfile is present in the workspace
- **THEN** the plugin SHALL skip installation regardless of lockfile presence

### Requirement: Return structured execution result for workflow chaining
The system SHALL return structured output including success state, source summary, selected runtime, ordered phase results, final exit code, duration, timeout indicator, stdout/stderr, truncation metadata, and structured error information when failed.

#### Scenario: Successful execution output
- **WHEN** execution completes with final exit code 0
- **THEN** output SHALL set `success=true` and include phase and runtime metadata for downstream tasks

#### Scenario: Failed execution output
- **WHEN** execution fails in any phase
- **THEN** output SHALL set `success=false` and include a structured `error` object with code, message, and phase

#### Scenario: Timeout output
- **WHEN** execution exceeds `timeoutMs`
- **THEN** output SHALL set `timedOut=true`, fail the task, and classify the error as `TIMEOUT`

### Requirement: Cap stdout and stderr in final output payload
The system SHALL cap `stdout` and `stderr` in the final action output to a fixed v1 maximum size of 1 MiB per stream and SHALL provide truncation metadata.

#### Scenario: Stdout exceeds output cap
- **WHEN** produced stdout exceeds 1 MiB
- **THEN** output SHALL include only the first 1 MiB of stdout and SHALL mark stdout as truncated

#### Scenario: Stderr exceeds output cap
- **WHEN** produced stderr exceeds 1 MiB
- **THEN** output SHALL include only the first 1 MiB of stderr and SHALL mark stderr as truncated
