## ADDED Requirements

### Requirement: Workflow validation fails fast with actionable diagnostics
The system SHALL validate workflows before registering or executing them and SHALL return actionable diagnostics identifying invalid field(s).

#### Scenario: Invalid field includes a path
- **WHEN** a workflow contains an invalid value for a known field
- **THEN** the validation result contains the field path (e.g. `tasks[0].type`) and a human-readable message

### Requirement: Task identifiers are unique
The system SHALL reject workflows where two tasks share the same `id`.

#### Scenario: Duplicate task ids
- **WHEN** two tasks have the same `id`
- **THEN** validation fails and identifies both occurrences as conflicting

### Requirement: Task dependencies reference existing tasks
The system SHALL reject workflows where a task `needs` references a task id that does not exist.

#### Scenario: Unknown dependency
- **WHEN** a task declares `needs: ["missing-task"]` and there is no task with `id: missing-task`
- **THEN** validation fails and points to that `needs` entry

### Requirement: Task dependency graph is acyclic
The system SHALL reject workflows containing dependency cycles.

#### Scenario: Cyclic dependencies
- **WHEN** tasks dependencies form a cycle
- **THEN** validation fails and reports that the DAG contains a cycle

### Requirement: Workflow has at least one runnable task
The system SHALL reject workflows whose `tasks` list is empty.

#### Scenario: Empty tasks list
- **WHEN** a workflow YAML contains `tasks: []`
- **THEN** validation fails and points to `tasks`

### Requirement: Task retry limits are bounded and positive
The system SHALL reject tasks where retry limits are not positive integers.

#### Scenario: Negative retry max
- **WHEN** a task declares `retry.max` as a non-positive value
- **THEN** validation fails and points to `tasks[*].retry.max`

### Requirement: Forbidden keys are rejected for security
The system SHALL reject forbidden keys that would imply secret material or unsafe behavior.

#### Scenario: Forbidden `secrets` key
- **WHEN** the workflow contains `secrets`
- **THEN** validation fails and identifies `secrets` as forbidden

### Requirement: Plugin task type is validated against known plugins when available
The system SHALL support validating task `type` against a registry of known plugins/actions when that registry is available.

#### Scenario: Plugin registry available and type unknown
- **WHEN** validation is performed with a plugin registry and a task `type` is unknown
- **THEN** validation fails and points to `tasks[*].type` as unknown

#### Scenario: Plugin registry not available
- **WHEN** validation is performed without a plugin registry
- **THEN** validation still validates core DSL structure and DAG semantics
