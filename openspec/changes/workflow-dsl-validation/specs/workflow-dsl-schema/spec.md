## ADDED Requirements

### Requirement: Workflow YAML has a stable top-level structure
The system SHALL define a workflow DSL in YAML with a stable top-level structure suitable for version control and review.

#### Scenario: Valid minimal workflow
- **WHEN** a workflow file contains `id` and a non-empty `tasks` list
- **THEN** the workflow is considered structurally valid

### Requirement: Workflow identifiers are explicit and stable
The workflow DSL SHALL include an explicit `id` field.

#### Scenario: Missing workflow id
- **WHEN** the workflow YAML omits the `id` field
- **THEN** validation fails and the error points to `id`

### Requirement: Workflows can be enabled/disabled
The workflow DSL SHALL support enabling/disabling a workflow via a boolean `enabled` field.

#### Scenario: Disabled workflow
- **WHEN** a workflow YAML sets `enabled: false`
- **THEN** the workflow is accepted but can be treated as inactive by higher-level components

### Requirement: Workflows support triggers
The workflow DSL SHALL support a `trigger` field that describes how the workflow is started.

#### Scenario: Cron trigger
- **WHEN** a workflow YAML defines a cron-based trigger
- **THEN** the workflow is accepted as structurally valid

#### Scenario: Webhook trigger
- **WHEN** a workflow YAML defines a webhook-based trigger
- **THEN** the workflow is accepted as structurally valid

### Requirement: Tasks are plugin-driven and typed
Each task in `tasks` SHALL include an `id` and a `type` using the format `namespace/plugin.action`.

#### Scenario: Valid task type format
- **WHEN** a task type matches the pattern `^[a-z0-9-]+/[a-z0-9-]+\.[a-z0-9-]+$`
- **THEN** the task is accepted as structurally valid

#### Scenario: Invalid task type format
- **WHEN** a task type does not match the required format
- **THEN** validation fails and the error points to `tasks[*].type`

### Requirement: Task dependencies are expressible
Tasks SHALL support declaring dependencies using `needs: [taskId]`.

#### Scenario: Task with dependencies
- **WHEN** a task includes `needs` as a list of task ids
- **THEN** the workflow is accepted as structurally valid

### Requirement: Task retry policy is expressible
Tasks SHALL support an optional `retry` policy containing at least a `max` attempt count and an optional `backoff` definition.

#### Scenario: Task with retry policy
- **WHEN** a task includes a retry configuration with a positive `max`
- **THEN** the workflow is accepted as structurally valid

### Requirement: Workflow YAML SHALL NOT contain secrets
The workflow DSL SHALL NOT allow defining secrets directly inside the workflow YAML.

#### Scenario: Secrets section present
- **WHEN** a workflow YAML contains a top-level `secrets` key
- **THEN** validation fails and the error identifies `secrets` as forbidden
