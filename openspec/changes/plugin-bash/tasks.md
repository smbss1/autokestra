## 1. Plugin Scaffold and Manifest

- [ ] 1.1 Create `plugins/bash` plugin directory with `plugin.yaml` and `index.ts` entrypoint
- [ ] 1.2 Define `core/bash.exec` action schema in `plugin.yaml` for command/script, shell (`bash`/`sh`), args, env, cwd, and timeout
- [ ] 1.3 Add output schema fields for success, exitCode, stdout/stderr, duration, timeout, and truncation metadata

## 2. Core Bash Execution Implementation

- [ ] 2.1 Implement input validation ensuring exactly one of `command` or `script` is provided
- [ ] 2.2 Implement shell process execution via child process with support for `shell` selection (`bash`/`sh`) and args/env/cwd
- [ ] 2.3 Implement timeout handling with deterministic process termination and timeout result signaling
- [ ] 2.4 Implement stdout/stderr capture with truncation safeguards and structured output mapping
- [ ] 2.5 Implement default `cwd` resolution to workflow workspace directory when input `cwd` is omitted

## 3. Runtime and Error Semantics Alignment

- [ ] 3.1 Ensure plugin output strictly follows JSON stdout contract and stderr logging conventions
- [ ] 3.2 Implement non-zero exit handling to return structured failure details and fail task deterministically
- [ ] 3.3 Add protocol error handling for invalid/non-JSON stdout output

## 4. Trusted Mode Permission Clarification

- [ ] 4.1 Document and test that trusted mode does not apply shell command allowlist restrictions
- [ ] 4.2 Add explicit notes/examples showing arbitrary valid Bash commands are accepted in trusted mode

## 5. Testing and Fixtures

- [ ] 5.1 Add unit/integration tests for success command, inline script, non-zero exit, timeout, and truncation
- [ ] 5.2 Add test fixtures for command input and script input payloads
- [ ] 5.3 Add regression test ensuring runtime reports actionable errors for protocol contract violations

## 6. Documentation and Examples

- [ ] 6.1 Add workflow examples using `core/bash.exec` for command and script scenarios
- [ ] 6.2 Add docs positioning `core/bash.exec` versus `core/script.run` with clear usage guidance
- [ ] 6.3 Update release guidance to reiterate child-process execution model remains unchanged
