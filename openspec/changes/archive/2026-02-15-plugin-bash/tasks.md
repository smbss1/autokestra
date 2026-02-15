## 1. Plugin Scaffold and Manifest

- [x] 1.1 Create `plugins/bash` plugin directory with `plugin.yaml` and `index.ts` entrypoint
- [x] 1.2 Define `core/bash.exec` action schema in `plugin.yaml` for command/script, shell (`bash`/`sh`), args, env, cwd, and timeout
- [x] 1.3 Add output schema fields for success, exitCode, stdout/stderr, duration, timeout, and truncation metadata

## 2. Core Bash Execution Implementation

- [x] 2.1 Implement input validation ensuring exactly one of `command` or `script` is provided
- [x] 2.2 Implement shell process execution via child process with support for `shell` selection (`bash`/`sh`) and args/env/cwd
- [x] 2.3 Implement timeout handling with deterministic process termination and timeout result signaling
- [x] 2.4 Implement stdout/stderr capture with truncation safeguards and structured output mapping
- [x] 2.5 Implement default `cwd` resolution to workflow workspace directory when input `cwd` is omitted

## 3. Runtime and Error Semantics Alignment

- [x] 3.1 Ensure plugin output strictly follows JSON stdout contract and stderr logging conventions
- [x] 3.2 Implement non-zero exit handling to return structured failure details and fail task deterministically
- [x] 3.3 Add protocol error handling for invalid/non-JSON stdout output

## 4. Trusted Mode Permission Clarification

- [x] 4.1 Document and test that trusted mode does not apply shell command allowlist restrictions
- [x] 4.2 Add explicit notes/examples showing arbitrary valid Bash commands are accepted in trusted mode

## 5. Testing and Fixtures

- [x] 5.1 Add unit/integration tests for success command, inline script, non-zero exit, timeout, and truncation
- [x] 5.2 Add test fixtures for command input and script input payloads
- [x] 5.3 Add regression test ensuring runtime reports actionable errors for protocol contract violations

## 6. Documentation and Examples

- [x] 6.1 Add workflow examples using `core/bash.exec` for command and script scenarios
- [x] 6.2 Add docs positioning `core/bash.exec` versus `core/script.run` with clear usage guidance
- [x] 6.3 Update release guidance to reiterate child-process execution model remains unchanged
