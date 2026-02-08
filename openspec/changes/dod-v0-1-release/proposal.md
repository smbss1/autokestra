## Why

We need a crisp, testable Definition of Done for v0.1 so the project can be shipped as a reliable, CLI-first, single-node workflow engine without guesswork or “it works on my machine” gaps.

## What Changes

- Define the v0.1 release acceptance criteria as an explicit, verifiable contract (end-to-end scenarios) covering server start, workflow apply, deterministic execution, persistence, logs/inspect, secrets masking, and plugin execution boundaries.
- Add a small set of release-gating checks (smoke tests + docs checks) so CI can validate the DoD continuously.
- Standardize “how to run v0.1 locally” (config defaults, example workflow(s), and a minimal quickstart) to reduce friction for users and contributors.

## Capabilities

### New Capabilities
- `release-dod-v0-1`: Release-level acceptance criteria and smoke scenarios for shipping v0.1 (CLI-first, SQLite default, secrets safety, plugin sandbox/permissions, observability).

### Modified Capabilities
- (none)

## Impact

- Code: primarily `packages/cli`, `packages/engine`, `packages/server`, plus fixtures/examples.
- Tests: add/extend integration-style smoke tests that exercise the main user journey end-to-end.
- Docs: ensure a v0.1 quickstart exists and remains accurate across releases.
