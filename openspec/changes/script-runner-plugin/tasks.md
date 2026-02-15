## 1. Plugin scaffold and manifest

- [ ] 1.1 Update `plugins/script/` manifest and input schema to support only `source.type=local|inline`
- [ ] 1.2 Create `plugins/git-source/` package structure (`index.ts`, `package.json`, `plugin.yaml`)
- [ ] 1.3 Define `core/git-source.checkout` input/output schemas (`repoUrl`, `ref`, `subdir`, auth, `workspacePath`, commit)

## 2. Input validation and source resolution

- [ ] 2.1 Remove git validation branch from `core/script.run` and reject `source.type=git`
- [ ] 2.2 Keep local source workspace resolution with optional `workingDir` in `core/script.run`
- [ ] 2.3 Keep inline source materialization in `core/script.run`
- [ ] 2.4 Keep rejection of unsupported v1 input `startCommand` with explicit validation error

## 3. Private git authentication

- [ ] 3.1 Implement token-based git auth flow in `core/git-source.checkout`
- [ ] 3.2 Implement SSH-based git auth flow in `core/git-source.checkout`
- [ ] 3.3 Add structured error mapping for clone/auth failures in `core/git-source.checkout` (`GIT_AUTH_ERROR`, `GIT_CLONE_ERROR`)

## 4. Runtime and execution orchestration

- [ ] 4.1 Keep runtime selection `auto|bun|tsx` with deterministic fallback behavior in `core/script.run`
- [ ] 4.2 Keep non-project execution path for `entry` and inline script execution
- [ ] 4.3 Keep project mode lifecycle detection for `prestart`, `start`, `poststart`
- [ ] 4.4 Keep lifecycle execution conditional by script existence and flags in strict order

## 5. Install phase and process controls

- [ ] 5.1 Keep optional dependency installation phase in `core/script.run`
- [ ] 5.2 Keep `install.enabled=false` as explicit override in `core/script.run`
- [ ] 5.3 Keep timeout handling across install and execution phases
- [ ] 5.4 Keep stdout/stderr capture and truncation metadata
- [ ] 5.5 Keep final output cap of 1 MiB per stream

## 6. Structured output, logging, and error model

- [ ] 6.1 Update `core/script.run` output contract to remove Git-specific source fields
- [ ] 6.2 Emit phase-level runtime logs with clear start/end and streaming output diagnostics
- [ ] 6.3 Keep structured failure object with categorized codes for script execution

## 7. Tests and documentation

- [ ] 7.1 Update tests to enforce rejection of `source.type=git` in `core/script.run`
- [ ] 7.2 Add tests for `core/git-source.checkout` (public, token, ssh, error mapping)
- [ ] 7.3 Keep lifecycle tests in `core/script.run`
- [ ] 7.4 Keep runtime selection + timeout + truncation tests in `core/script.run`
- [ ] 7.5 Update workflow examples to chain `core/git-source.checkout` then `core/script.run`
