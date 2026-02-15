## 1. Plugin scaffold and manifest

- [ ] 1.1 Create `plugins/script/` package structure (`index.ts`, `package.json`, `plugin.yaml`)
- [ ] 1.2 Define `core/script.run` manifest input schema for `source`, `projectMode`, `runtime`, `install`, `lifecycle`, `entry`, `args`, `env`, `timeoutMs`
- [ ] 1.3 Define output schema for structured execution result (`success`, runtime, phases, exitCode, duration, logs, error)

## 2. Input validation and source resolution

- [ ] 2.1 Implement validation rules for `source.type=local|git|inline` and required fields per mode
- [ ] 2.2 Implement local source workspace resolution with optional `workingDir`
- [ ] 2.3 Implement inline source materialization into temporary workspace files
- [ ] 2.4 Implement git clone + checkout (`repoUrl`, `ref`, `subdir`) for public repositories
- [ ] 2.5 Reject unsupported v1 input `startCommand` with explicit validation error

## 3. Private git authentication

- [ ] 3.1 Implement token-based git auth flow for private HTTPS repositories
- [ ] 3.2 Implement SSH-based git auth flow using provided private key and optional known_hosts
- [ ] 3.3 Add structured error mapping for clone/auth failures (`GIT_AUTH_ERROR`, `GIT_CLONE_ERROR`)

## 4. Runtime and execution orchestration

- [ ] 4.1 Implement runtime selection `auto|bun|tsx` with deterministic fallback behavior
- [ ] 4.2 Implement non-project execution path for `entry` and inline script execution
- [ ] 4.3 Implement project mode lifecycle detection for `prestart`, `start`, `poststart`
- [ ] 4.4 Execute lifecycle phases conditionally by script existence and flags, preserving strict order

## 5. Install phase and process controls

- [ ] 5.1 Implement optional dependency installation phase (`npm|pnpm|yarn|bun|custom command`)
- [ ] 5.2 Enforce `install.enabled=false` as an explicit override (skip install even when lockfile exists)
- [ ] 5.3 Enforce timeout handling across install and execution phases
- [ ] 5.4 Capture stdout/stderr and truncation metadata for large outputs
- [ ] 5.5 Cap final action output `stdout` and `stderr` to 1 MiB each

## 6. Structured output, logging, and error model

- [ ] 6.1 Produce final output contract with mode, source summary, selected runtime, ordered phase results, and final status
- [ ] 6.2 Emit phase-level runtime logs with clear start/end and execution diagnostics
- [ ] 6.3 Implement structured failure object with categorized codes (`VALIDATION_ERROR`, `SOURCE_ERROR`, `INSTALL_ERROR`, `EXECUTION_ERROR`, `TIMEOUT`, etc.)

## 7. Tests and documentation

- [ ] 7.1 Add unit tests for input validation and source mode branching
- [ ] 7.2 Add tests for lifecycle behavior (missing `prestart`/`poststart`, missing `start`, success path)
- [ ] 7.3 Add tests for runtime selection behavior (`bun`, `tsx`, `auto`)
- [ ] 7.4 Add tests for error classification and timeout handling
- [ ] 7.5 Add workflow examples for local, inline, git private token, and git private ssh usage
- [ ] 7.6 Add tests for output truncation at 1 MiB for stdout and stderr
- [ ] 7.7 Add tests confirming `install.enabled=false` skips install despite lockfile
