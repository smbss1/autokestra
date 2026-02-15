## ADDED Requirements

### Requirement: Local plugin preflight validation command

The CLI MUST provide a `workflow plugin validate` command that validates plugin manifest and action contract before runtime execution.

#### Scenario: Valid manifest and action contract
- **WHEN** a user runs validation on a compliant plugin
- **THEN** validation succeeds with exit code 0 and reports all checks passed

#### Scenario: Invalid manifest fails validation
- **WHEN** `plugin.yaml` violates schema requirements
- **THEN** validation fails with deterministic non-zero exit code and actionable error details

### Requirement: Runtime-parity validation scope

Preflight validation MUST check the same manifest and action envelope invariants expected by runtime child-process execution.

#### Scenario: Invalid action envelope behavior
- **WHEN** plugin entrypoint does not accept `{ action, input }` payload contract
- **THEN** validation reports contract mismatch before workflow execution

#### Scenario: Invalid JSON stdout result
- **WHEN** plugin action returns non-JSON output on stdout
- **THEN** validation reports output contract failure with plugin/action context
