## 1. SDK Process Ergonomics

- [ ] 1.1 Add SDK helper for plugin definition export (`definePlugin`) with action registry metadata
- [ ] 1.2 Add SDK process bootstrap helper that reads `{ action, input }` from stdin and writes JSON output to stdout
- [ ] 1.3 Add SDK tests for typed action dispatch, unknown action handling, and stdout/stderr contract behavior

## 2. Runtime Contract Alignment

- [ ] 2.1 Update plugin runtime invocation to execute the task-requested action name instead of defaulting to first manifest action
- [ ] 2.2 Add runtime checks/tests for invalid JSON stdout contract failures with actionable error messages
- [ ] 2.3 Ensure runtime and local validation reuse equivalent manifest schema semantics and add parity tests

## 3. CLI Authoring Commands

- [ ] 3.1 Implement `workflow plugin init <name>` to scaffold runtime-compatible starter files (`plugin.yaml`, `index.ts`, minimal project metadata)
- [ ] 3.2 Implement `workflow plugin validate <path>` with deterministic exit codes and actionable validation output
- [ ] 3.3 Implement `workflow plugin dev <path> --action <name> --input <file>` for local action execution using runtime payload envelope
- [ ] 3.4 Add optional watch mode to `plugin dev` with deterministic rerun boundaries and latest-run status

## 4. Templates and Fixtures

- [ ] 4.1 Add versioned scaffold templates for default namespace and explicit namespace use cases
- [ ] 4.2 Add fixture examples for success, manifest failure, and action contract mismatch scenarios
- [ ] 4.3 Add golden-output tests for generated scaffold files to prevent template drift

## 5. Documentation and Onboarding

- [ ] 5.1 Create one canonical first-plugin guide covering scaffold → dev loop → validate → workflow execution
- [ ] 5.2 Add plugin troubleshooting section for manifest/schema errors and stdin/stdout contract failures
- [ ] 5.3 Update CLI reference docs for new plugin commands and JSON/scriptability behavior

## 6. Verification and Release Gate

- [ ] 6.1 Add integration smoke tests for `plugin init`, `plugin validate`, and `plugin dev` in process mode
- [ ] 6.2 Add regression test proving multi-action manifest dispatch uses the referenced task action
- [ ] 6.3 Add release-gate checklist entry ensuring child-process execution model remains unchanged
