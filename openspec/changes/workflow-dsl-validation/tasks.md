## 1. Workflow model & schema (Valibot)

- [ ] 1.1 Define TypeScript workflow model types (Workflow, Trigger, Task, Retry)
- [ ] 1.2 Define Valibot schema for workflow top-level structure (id/enabled/trigger/tasks)
- [ ] 1.3 Define Valibot schema for trigger variants (cron/webhook) and reject unknown trigger types
- [ ] 1.4 Define Valibot schema for tasks (id/type/needs/retry) with strictness on unknown keys
- [ ] 1.5 Add validation for task `type` format `namespace/plugin.action`
- [ ] 1.6 Add validation rejecting forbidden keys (at least top-level `secrets`)

## 2. Parsing, normalization, and diagnostics

- [ ] 2.1 Implement workflow loader from YAML file with clear read errors
- [ ] 2.2 Implement YAML parse error handling with actionable message
- [ ] 2.3 Implement normalization step into a canonical in-memory workflow object
- [ ] 2.4 Preserve and attach source metadata (file path; optionally YAML positions if available)
- [ ] 2.5 Reject unknown top-level keys by default (strict parsing/validation)
- [ ] 2.6 Add support for optional `version`/`apiVersion` and default versioning
- [ ] 2.7 Add validation for unsupported versions with clear supported list

## 3. Semantic validation (DAG & constraints)

- [ ] 3.1 Validate `tasks` is non-empty
- [ ] 3.2 Validate unique task ids
- [ ] 3.3 Validate `needs` references existing task ids
- [ ] 3.4 Detect and reject cycles in dependency graph
- [ ] 3.5 Produce stable, path-addressable diagnostics for semantic errors

## 4. Plugin-aware validation (optional/late-bound)

- [ ] 4.1 Define a plugin registry interface for validation (lookup action schema by `type`)
- [ ] 4.2 Implement optional validation that checks task `type` exists when registry is provided
- [ ] 4.3 Ensure core DSL validation works without plugin registry

## 5. Tests

- [ ] 5.1 Add table-driven tests for YAML loading errors (missing file, invalid YAML)
- [ ] 5.2 Add table-driven tests for schema validation failures (missing id, invalid type format, forbidden keys)
- [ ] 5.3 Add table-driven tests for DAG validation failures (duplicate ids, unknown needs, cycles)
- [ ] 5.4 Add tests for unknown keys rejection behavior
- [ ] 5.5 Add tests for version handling (default, unsupported)
- [ ] 5.6 Add tests for plugin-registry optional validation behavior

## 6. Integration touchpoints (minimal)

- [ ] 6.1 Add engine API entrypoint(s) (e.g., `parseWorkflowFile`, `validateWorkflow`) for CLI/server integration
- [ ] 6.2 Wire validation into CLI workflow apply path (fail fast with deterministic exit code)
- [ ] 6.3 Document minimal DSL examples and common validation errors