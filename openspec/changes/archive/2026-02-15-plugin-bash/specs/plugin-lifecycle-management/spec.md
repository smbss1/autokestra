## MODIFIED Requirements

### Requirement: Plugin error handling

The runtime MUST handle all plugin errors gracefully and convert them to task failures with appropriate error messages, including process-based shell execution failures.

#### Scenario: Plugin throws error
- **WHEN** plugin action throws an error
- **THEN** task fails with error message extracted from the exception

#### Scenario: Plugin timeout
- **WHEN** plugin action exceeds timeout
- **THEN** task fails with timeout error and plugin instance is cleaned up

#### Scenario: Plugin crash
- **WHEN** plugin causes WASM trap
- **THEN** task fails with crash error and no resource leaks occur

#### Scenario: Shell command exits non-zero
- **WHEN** `core/bash.exec` command exits with non-zero code
- **THEN** runtime reports task failure with structured plugin output including exit code and captured stderr

#### Scenario: Shell process output is invalid JSON
- **WHEN** shell plugin process returns non-JSON stdout payload
- **THEN** runtime fails task with actionable protocol error indicating invalid plugin output contract
