## 1. Workflow model & schema (Valibot)

- [x] 1.1 Define TypeScript workflow model types (Workflow, Trigger, Task, Retry)
- [x] 1.2 Define Valibot schema for workflow top-level structure (id/enabled/trigger/tasks)
- [x] 1.3 Define Valibot schema for trigger variants (cron/webhook) and reject unknown trigger types
- [x] 1.4 Define Valibot schema for tasks (id/type/needs/retry) with strictness on unknown keys
- [x] 1.5 Add validation for task `type` format `namespace/plugin.action`
- [x] 1.6 Add validation rejecting forbidden keys (at least top-level `secrets`)

## 2. Parsing, normalization, and diagnostics

- [x] 2.1 Implement workflow loader from YAML file with clear read errors
- [x] 2.2 Implement YAML parse error handling with actionable message
- [x] 2.3 Implement normalization step into a canonical in-memory workflow object
- [x] 2.4 Preserve and attach source metadata (file path; optionally YAML positions if available)
- [x] 2.5 Reject unknown top-level keys by default (strict parsing/validation)
- [x] 2.6 Add support for optional `version`/`apiVersion` and default versioning
- [x] 2.7 Add validation for unsupported versions with clear supported list

## 3. Semantic validation (DAG & constraints)

- [x] 3.1 Validate `tasks` is non-empty
- [x] 3.2 Validate unique task ids
- [x] 3.3 Validate `needs` references existing task ids
- [x] 3.4 Detect and reject cycles in dependency graph
- [x] 3.5 Produce stable, path-addressable diagnostics for semantic errors

## 4. Plugin-aware validation (optional/late-bound)

- [x] 4.1 Define a plugin registry interface for validation (lookup action schema by `type`)
- [x] 4.2 Implement optional validation that checks task `type` exists when registry is provided
- [x] 4.3 Ensure core DSL validation works without plugin registry

## 5. Tests

- [x] 5.1 Add table-driven tests for YAML loading errors (missing file, invalid YAML)
- [x] 5.2 Add table-driven tests for schema validation failures (missing id, invalid type format, forbidden keys)
- [x] 5.3 Add table-driven tests for DAG validation failures (duplicate ids, unknown needs, cycles)
- [x] 5.4 Add tests for unknown keys rejection behavior
- [x] 5.5 Add tests for version handling (default, unsupported)
- [x] 5.6 Add tests for plugin-registry optional validation behavior

## 6. Integration touchpoints (minimal)

- [x] 6.1 Add engine API entrypoint(s) (e.g., `parseWorkflowFile`, `validateWorkflow`) for CLI/server integration
- [x] 6.2 Wire validation into CLI workflow apply path (fail fast with deterministic exit code)
- [x] 6.3 Document minimal DSL examples and common validation errors