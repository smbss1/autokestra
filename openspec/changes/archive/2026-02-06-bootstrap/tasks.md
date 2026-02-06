## 1. Repo structure & tooling baseline

- [x] 1.1 Define initial module/package layout (engine/server/cli/plugin-sdk) and document boundaries
- [x] 1.2 Add standard Bun scripts (build, test, lint, format) and verify they run from repo root
- [x] 1.3 Add minimal CI workflow running lint + unit tests on PR
- [x] 1.4 Add contributor-facing documentation (README/CONTRIBUTING) for dev setup and common commands

## 2. Configuration loading & env overrides

- [x] 2.1 Define TypeScript config schema/interfaces with discriminated unions for storage types (SQLite/PostgreSQL) using Valibot schemas
- [x] 2.2 Implement config loader for YAML (read/parse) with clear parse/read error messages
- [x] 2.3 Implement deterministic env override mapping and precedence rules (env > YAML) with Valibot validation of env values
- [x] 2.4 Implement config validation using Valibot schemas and deterministic exit code on invalid config
- [x] 2.5 Add table-driven tests covering YAML parsing, env overrides, and validation failures

## 3. CLI skeleton (command tree, JSON output, exit codes)

- [x] 3.1 Choose CLI framework and implement root command with `--help` and version output
- [x] 3.2 Implement top-level command groups: server/workflow/execution/plugin/config (stubs allowed)
- [x] 3.3 Add `--json` output mode for list/describe commands and define stable JSON envelope structure
- [x] 3.4 Define deterministic exit code mapping and apply it consistently across commands
- [x] 3.5 Add CLI tests (smoke tests or snapshots) for help output, JSON validity, and exit codes

## 4. Verification & polish

- [x] 4.1 Ensure lint/test/format pass locally and in CI with a clean checkout
- [x] 4.2 Add example config YAML and document env override examples
- [x] 4.3 Add a minimal release note entry for bootstrap foundations (what’s included / what’s stubbed)
