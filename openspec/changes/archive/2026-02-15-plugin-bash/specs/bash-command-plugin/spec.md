## ADDED Requirements

### Requirement: Bash command execution action

The system SHALL provide a plugin action `core/bash.exec` that executes Bash commands in process-isolated plugin runtime.

#### Scenario: Execute single command
- **WHEN** a task uses `type: core/bash.exec` with input `command: "echo hello"`
- **THEN** the plugin executes the command through Bash and returns structured execution output

#### Scenario: Execute inline script
- **WHEN** a task uses `type: core/bash.exec` with multi-line `script` input
- **THEN** the plugin executes the script through Bash and returns structured execution output

### Requirement: Input contract for shell execution

The `core/bash.exec` action MUST support the following input fields: `command` (string) or `script` (string), optional `shell` (`bash` or `sh`), optional `args` (string array), optional `env` (string map), optional `cwd` (string), and optional `timeoutMs` (positive number).

#### Scenario: Reject missing command and script
- **WHEN** both `command` and `script` are absent or empty
- **THEN** task validation fails before execution with a descriptive input error

#### Scenario: Reject invalid timeout
- **WHEN** `timeoutMs` is zero, negative, or non-numeric
- **THEN** task validation fails before execution with a descriptive input error

#### Scenario: Shell selection in v1
- **WHEN** input sets `shell: "bash"` or `shell: "sh"`
- **THEN** plugin uses the selected shell binary for command/script execution

#### Scenario: Reject unsupported shell values
- **WHEN** input sets `shell` to a value other than `bash` or `sh`
- **THEN** task validation fails before execution with a descriptive input error

### Requirement: Working directory default behavior

If `cwd` is not provided, the plugin MUST default execution to the workflow workspace directory.

#### Scenario: Implicit cwd uses workflow workspace
- **WHEN** task omits `cwd`
- **THEN** command/script executes in workflow workspace directory by default

#### Scenario: Explicit cwd override
- **WHEN** task provides `cwd`
- **THEN** plugin resolves and executes in provided directory (subject to runtime constraints)

### Requirement: Structured output contract

The plugin MUST return a JSON object containing `success`, `exitCode`, `durationMs`, `timedOut`, `stdout`, `stderr`, and truncation metadata.

#### Scenario: Successful command output
- **WHEN** command exits with code `0`
- **THEN** output includes `success: true`, `exitCode: 0`, captured stdout/stderr, and measured duration

#### Scenario: Failed command output
- **WHEN** command exits with non-zero code
- **THEN** output includes `success: false`, non-zero `exitCode`, captured stdout/stderr, and task failure is always enforced

### Requirement: Timeout and process termination

The plugin MUST enforce `timeoutMs` and terminate the shell process when timeout is exceeded.

#### Scenario: Command timeout
- **WHEN** command runtime exceeds `timeoutMs`
- **THEN** shell process is terminated, output sets `timedOut: true`, and task is marked failed with timeout reason

### Requirement: Trusted mode unrestricted shell behavior

In trusted mode, `core/bash.exec` MUST allow execution of arbitrary shell commands without built-in command allowlist filtering.

#### Scenario: Arbitrary command permitted in trusted mode
- **WHEN** workflow runs in trusted mode and input command is any valid Bash command
- **THEN** plugin attempts execution without command allowlist rejection

#### Scenario: Runtime/system-level failure still reported
- **WHEN** command cannot execute due to OS/runtime conditions (missing binary, permission denied, etc.)
- **THEN** plugin returns structured failure details and task fails deterministically
