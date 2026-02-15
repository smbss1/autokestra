## Context

Plugin authoring is currently functional but manual: authors must handcraft `plugin.yaml`, runtime-compatible process bootstrap (`stdin`/`stdout` contract), and ad-hoc local testing. This creates slow iteration and late failures discovered only during workflow execution. At the same time, runtime isolation constraints are non-negotiable: plugins continue to execute out-of-process (trusted mode child process, restricted mode Docker) with deterministic I/O and log capture behavior.

## Goals / Non-Goals

**Goals:**
- Reduce time-to-first-plugin with a standard scaffold command and canonical template.
- Provide a local developer loop that executes plugin actions quickly using the same payload envelope as runtime.
- Add preflight validation to fail fast on manifest/action contract issues before server execution.
- Improve SDK ergonomics so plugin authors write business logic instead of transport/runtime boilerplate.
- Keep all improvements compatible with existing plugin execution boundaries and security posture.

**Non-Goals:**
- No change to plugin runtime isolation model (no in-process plugin execution).
- No switch to package.json lifecycle-driven plugin execution (`prestart`/`start`/`poststart`) for runtime invocation in this change; runtime entrypoint remains `bun index.ts`.
- No GUI plugin builder.
- No plugin registry/publishing workflow in this change.
- No change to workflow DSL task type format.

## Decisions

### Decision 1: Add CLI-first authoring workflow (`plugin init`, `plugin validate`, `plugin dev`)
- Rationale: CLI-first is an existing product principle and gives deterministic scriptable behavior.
- Alternatives considered:
  - Editor-only templates: faster to prototype but not scriptable/portable.
  - Runtime-only checks: preserves current behavior but does not improve feedback latency.

### Decision 2: Standardize process bootstrap in SDK, preserve runtime wire contract
- Rationale: Move repeated parsing/dispatch/output patterns to SDK helpers while preserving `{ action, input }` via stdin and JSON output via stdout.
- Alternatives considered:
  - New IPC protocol: higher migration risk and runtime churn.
  - Per-plugin custom bootstrap forever: keeps flexibility but poor consistency and onboarding.

### Decision 3: Preflight validation as local gate, not runtime replacement
- Rationale: Local validation catches issues earlier; runtime validation remains authoritative at execution time.
- Alternatives considered:
  - Runtime-only strictness: too late for fast iteration.
  - Local-only strictness: unsafe if runtime and local validators drift.

### Decision 4: Keep execution mode compatibility explicit in DX tooling
- Rationale: `plugin dev` runs in trusted local process mode for speed, while docs/validation make restricted-mode constraints explicit.
- Alternatives considered:
  - Force Docker for every local run: closer parity but significantly slower feedback loop.

## Risks / Trade-offs

- [Risk] Local dev loop behavior diverges from runtime execution edge cases → Mitigation: share the same payload envelope, manifest validation, and action dispatch logic used by runtime.
- [Risk] Additional CLI commands increase maintenance surface → Mitigation: keep commands narrowly scoped and test contract-level behavior.
- [Risk] Generated templates become stale over time → Mitigation: version templates and validate generated outputs in CI smoke checks.
- [Risk] Over-opinionated SDK reduces flexibility for advanced plugins → Mitigation: keep lower-level escape hatches and treat helpers as optional.

## Migration Plan

1. Introduce new CLI commands behind stable command names with deterministic exit codes.
2. Add SDK helper APIs in backward-compatible manner (no breaking removal of current `defineAction` usage).
3. Add preflight validator integration in CLI and optional CI command examples.
4. Publish canonical first-plugin docs and map old docs to the new path.
5. Roll out incrementally with smoke tests for child-process compatibility and manifest validation parity.

Rollback strategy:
- CLI commands can be disabled/hidden without affecting runtime execution path.
- SDK helpers are additive; existing plugins continue to run unchanged.

## Open Questions

- Should `plugin dev` support optional Docker-backed parity mode from day one, or follow-up change?
- Which schema source should be canonical for local validator and runtime validator to avoid drift?
- Should `plugin init` generate single-action-only starter by default, or multi-action-ready structure?
