## ADDED Requirements

### Requirement: Local plugin dev execution command

The CLI MUST provide a `workflow plugin dev` command that executes a selected plugin action locally with fixture input using the same action envelope as runtime.

#### Scenario: Execute plugin action from fixture
- **WHEN** a user runs `workflow plugin dev ./plugins/my-plugin --action run --input ./fixtures/input.json`
- **THEN** the command executes the action with payload `{ action: "run", input: <fixture-json> }` and prints JSON result to stdout

#### Scenario: Surface runtime-style failures
- **WHEN** plugin execution fails during local dev execution
- **THEN** the command exits non-zero and reports a structured error that includes action and failure reason

### Requirement: Optional watch loop for fast feedback

The local dev command MUST support watch mode for repeated execution after source or fixture changes.

#### Scenario: Re-run on source change
- **WHEN** `workflow plugin dev` runs with watch mode enabled and plugin source changes
- **THEN** the command re-executes the same action with the same selected fixture automatically

#### Scenario: Deterministic watch output boundaries
- **WHEN** a watch re-run starts
- **THEN** the command prints a clear run boundary and preserves deterministic success/failure exit behavior for the latest run
