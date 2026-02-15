## Why

Teams need a simple way to execute Bash commands and scripts directly in workflows for automation tasks that are already shell-native. Adding a dedicated Bash plugin now reduces workaround complexity and leverages the new plugin DX workflow (`plugin init`, `plugin dev`, `plugin validate`) for fast delivery.

## What Changes

- Add a new core plugin action `core/bash.exec` to run shell commands or inline Bash scripts.
- Define deterministic input/output contract for shell execution (exit code, stdout/stderr, timeout, duration, truncation).
- Support working directory, argument list, environment variables, and execution timeout controls.
- Keep runtime integration aligned with existing plugin process contract (`stdin` payload, JSON `stdout` result, logs on `stderr`).
- In trusted mode, explicitly allow unrestricted shell command execution for this plugin.

## Capabilities

### New Capabilities
- `bash-command-plugin`: Provide a first-class plugin capability for running Bash commands/scripts in workflows with structured outputs and failure semantics.

### Modified Capabilities
- `plugin-permission-model`: Clarify trusted-mode behavior for shell execution (full command execution allowed, no additional allowlist enforcement).
- `plugin-lifecycle-management`: Ensure runtime behavior and errors for process-based Bash plugin execution are explicit and testable.

## Impact

- Affected code: `plugins/` (new `bash` plugin), `packages/plugin-runtime` (execution/error semantics compatibility), and docs/examples.
- Workflow users gain a direct shell automation task type without routing through generic script-runner patterns.
- Security posture remains explicit: unrestricted command execution is limited to trusted mode and documented as a deliberate choice.
