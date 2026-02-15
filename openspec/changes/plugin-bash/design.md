## Context

Autokestra now has a faster plugin authoring loop (`plugin init`, `plugin dev`, `plugin validate`) and a stable process contract for plugin execution (`stdin` action/input, JSON `stdout` output, `stderr` logs). Users still need a dedicated, explicit plugin for shell-native automation tasks rather than repurposing generic script patterns for every Bash use case.

## Goals / Non-Goals

**Goals:**
- Introduce a first-class `core/bash.exec` action for running Bash commands or inline scripts.
- Keep execution fully compatible with current out-of-process plugin runtime (`bun run index.ts`).
- Return deterministic structured outputs (exit code, duration, timeout, stdout/stderr, truncation flags).
- Align with trusted security mode where unrestricted shell execution is intentionally allowed.

**Non-Goals:**
- No switch to package.json lifecycle execution for plugins.
- No restricted-mode allowlist design in this change (trusted mode is the target behavior).
- No multi-action shell plugin orchestration in v1 (single action `exec` only).
- No replacement of existing `core/script.run` behavior.

## Decisions

### Decision 1: Create dedicated plugin `core/bash.exec`
- Rationale: explicit task type and schema are easier to reason about than overloading existing plugins.
- Alternatives considered:
  - Extend `core/script.run` with bash flags: rejected to avoid widening an already broad contract.
  - Use inline command execution in workflow engine directly: rejected to preserve plugin boundary.

### Decision 2: Support both `command` and `script` input forms
- Rationale: users need quick one-liners and multi-line scripts.
- Alternatives considered:
  - `command` only: too limited for real automation scripts.
  - `script` only: awkward for short operational commands.

### Decision 3: Explicitly allow unrestricted shell commands in trusted mode
- Rationale: user requirement and trusted mode contract already grants full access.
- Alternatives considered:
  - Add allowlist now: deferred to a future restricted hardening change.

### Decision 4: Keep failure semantics strict and structured
- Rationale: shell tasks are noisy and error-prone; outputs must be machine-usable.
- Alternatives considered:
  - Raw passthrough output only: weak automation ergonomics and inconsistent error handling.

### Decision 5: Support shell selection in v1 (`bash` or `sh`)
- Rationale: some environments expose `sh` but not full `bash`; explicit selection improves portability.
- Alternatives considered:
  - Bash-only mode: simpler but less portable.

### Decision 6: Default `cwd` to workflow workspace directory
- Rationale: workflow tasks should run relative to workflow artifacts/checkout outputs by default.
- Alternatives considered:
  - Default to plugin directory: less useful for workflow-driven command execution.

### Decision 7: Non-zero exit code always fails task
- Rationale: deterministic workflow semantics and explicit failure handling.
- Alternatives considered:
  - Optional `allowNonZero`: deferred to possible future extension.

## Risks / Trade-offs

- [Risk] Arbitrary command execution can be dangerous if used in untrusted environments → Mitigation: explicit trusted-mode-only intent in docs/spec and no hidden escalation.
- [Risk] Long-running shell commands may block workers → Mitigation: mandatory timeout support and clear timeout error semantics.
- [Risk] Very large outputs can bloat logs/storage → Mitigation: output truncation with explicit truncation metadata.
- [Risk] Overlap confusion with `core/script.run` → Mitigation: document boundaries and intended use cases for each plugin.

## Migration Plan

1. Add new plugin folder `plugins/bash` with manifest + action implementation.
2. Add tests for success/failure/timeout/truncation and input validation.
3. Add workflow examples demonstrating command and inline script modes.
4. Update docs to position `core/bash.exec` vs `core/script.run`.

Rollback strategy:
- Remove plugin registration and plugin directory; no engine-wide protocol change required.

## Open Questions

- None for v1 scope; shell selection, cwd default, and non-zero exit behavior are now decided.
