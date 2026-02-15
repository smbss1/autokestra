## 1. Release Contract & Fixtures

- [x] 1.1 Add a minimal v0.1 quickstart doc and ensure it matches current CLI/server behavior
- [x] 1.2 Add an example workflow fixture (YAML) that exercises a deterministic happy-path
- [x] 1.3 Add a small secrets fixture setup for tests (SecretStore temp DB + one secret)

## 2. End-to-End Smoke Tests (DoD Gate)

- [x] 2.1 Add an integration-style test: start server/engine with temp SQLite and validate `GET /health`
- [x] 2.2 Add an integration-style test: apply workflow (CLI or API) and verify workflow list/describe
- [x] 2.3 Add an integration-style test: trigger an execution and assert it reaches a terminal state
- [x] 2.4 Add an integration-style test: retrieve logs/inspect and assert newest-first + filters + secret masking
- [x] 2.5 Add an integration-style test: restart with same SQLite path and confirm persisted workflows/executions are queryable

## 3. CLI Automation Guarantees

- [x] 3.1 Ensure key list commands support `--json` and output valid JSON on stdout
- [x] 3.2 Ensure errors in `--json` mode return stable error objects and deterministic non-zero exit codes
- [x] 3.3 Provide an installed CLI command path (e.g. package `bin`) so users can run `workflow server start` without `bun packages/cli/dist/index.js ...`
- [x] 3.4 Explore/implement a standalone CLI executable build (e.g. Bun compile) and document trade-offs

## 4. Plugin Sandbox/Permissions Smoke

- [x] 4.1 Add a minimal plugin-path smoke scenario (process and/or Docker container) that demonstrates the out-of-process boundary

## 5. CI/Release Hygiene

- [x] 5.1 Add a single command/doc section for “release gate” (what tests to run locally)
- [x] 5.2 Ensure all DoD smoke tests run in CI within an acceptable runtime budget
