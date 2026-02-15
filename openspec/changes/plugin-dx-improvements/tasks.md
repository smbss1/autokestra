## 1. SDK Process Ergonomics

- [x] 1.1 Add SDK helper for plugin definition export (`definePlugin`) with action registry metadata
- [x] 1.2 Add SDK process bootstrap helper that reads `{ action, input }` from stdin and writes JSON output to stdout
- [x] 1.3 Add SDK tests for typed action dispatch, unknown action handling, and stdout/stderr contract behavior

## 2. Runtime Contract Alignment

- [x] 2.1 Update plugin runtime invocation to execute the task-requested action name instead of defaulting to first manifest action
- [x] 2.2 Add runtime checks/tests for invalid JSON stdout contract failures with actionable error messages
- [x] 2.3 Ensure runtime and local validation reuse equivalent manifest schema semantics and add parity tests

## 3. CLI Authoring Commands

- [x] 3.1 Implement `workflow plugin init <name>` to scaffold runtime-compatible starter files (`plugin.yaml`, `index.ts`, minimal project metadata)
- [x] 3.2 Implement `workflow plugin validate <path>` with deterministic exit codes and actionable validation output
- [x] 3.3 Implement `workflow plugin dev <path> --action <name> --input <file>` for local action execution using runtime payload envelope
- [x] 3.4 Add optional watch mode to `plugin dev` with deterministic rerun boundaries and latest-run status

## 4. Templates and Fixtures

- [x] 4.1 Add versioned scaffold templates for default namespace and explicit namespace use cases
- [x] 4.2 Add fixture examples for success, manifest failure, and action contract mismatch scenarios
- [x] 4.3 Add golden-output tests for generated scaffold files to prevent template drift

## 5. Documentation and Onboarding

- [x] 5.1 Create one canonical first-plugin guide covering scaffold → dev loop → validate → workflow execution
- [x] 5.2 Add plugin troubleshooting section for manifest/schema errors and stdin/stdout contract failures
- [x] 5.3 Update CLI reference docs for new plugin commands and JSON/scriptability behavior

## 6. Verification and Release Gate

- [x] 6.1 Add integration smoke tests for `plugin init`, `plugin validate`, and `plugin dev` in process mode
- [x] 6.2 Add regression test proving multi-action manifest dispatch uses the referenced task action
- [x] 6.3 Add release-gate checklist entry ensuring child-process execution model remains unchanged
