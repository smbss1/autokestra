## Why

Les workflows doivent pouvoir orchestrer des scripts JavaScript/TypeScript et des projets Node complets sans devoir créer un plugin dédié par repo. Le besoin est prioritaire pour automatiser des jobs existants (locaux ou Git privés) avec un minimum de friction opérationnelle.

## What Changes

- Add a new official plugin `core/script` with action `run` to execute JS/TS from local path or inline content.
- Move Git repository resolution (public/private) into a dedicated plugin `core/git-source`.
- Make `core/script` consume a local workspace path only (direct local path or output produced by `core/git-source`).
- Support both `bun` and `tsx` runtimes, selectable by user input, with `auto` mode.
- Add project execution mode for repositories containing `package.json`, including lifecycle execution of `prestart`, `start`, and `poststart` when scripts exist.
- Add optional dependency installation before execution (`npm`, `pnpm`, `yarn`, or `bun`) with explicit controls.
- Return structured execution output for workflow chaining: exit code, runtime used, lifecycle phase results, stdout/stderr, timeout, and error classification.

## Capabilities

### New Capabilities
- `script-runner-plugin`: Run JS/TS scripts and package-based projects from local and inline sources with optional install/lifecycle handling.
- `git-source-plugin`: Resolve Git repositories (public/private, token/ssh) into local workspaces for downstream tasks.

### Modified Capabilities
- None.

## Impact

- Affected code: `plugins/` (new plugin package), plugin manifest/action schemas, and workflow examples.
- Runtime impact: plugin process execution, optional package manager invocation, lifecycle orchestration, plus git checkout handling isolated in dedicated plugin.
- Security impact: execution of user-specified commands under explicit user control; requires clear logging, timeout handling, and explicit secret-based auth injection in `core/git-source` for private Git.
- Documentation impact: new plugin usage docs and YAML workflow examples for local, inline, and private Git scenarios.
