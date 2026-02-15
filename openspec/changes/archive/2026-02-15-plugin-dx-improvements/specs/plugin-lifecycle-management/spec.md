## MODIFIED Requirements

### Requirement: Plugin resolution

The runtime MUST resolve plugin references from task types to plugin artifacts and execute the action name referenced by the task type.

#### Scenario: Resolve installed plugin and targeted action
- **WHEN** task references `community/slack.send`
- **THEN** runtime finds plugin at configured plugin directory and invokes action `send`

#### Scenario: Action not found in plugin
- **WHEN** task references `core/http.nonexistent`
- **THEN** task fails with an actionable error indicating action name and plugin identifier

### Requirement: Plugin error handling

The runtime MUST handle plugin process failures gracefully and convert them to task failures with actionable diagnostics.

#### Scenario: Plugin process protocol failure
- **WHEN** plugin process exits successfully but writes invalid JSON to stdout
- **THEN** task fails with protocol/contract error indicating invalid plugin output

#### Scenario: Plugin timeout
- **WHEN** plugin action exceeds timeout
- **THEN** runtime terminates plugin process, records timeout failure, and keeps scheduler state deterministic
