## ADDED Requirements

### Requirement: Trusted mode by default

Plugins MUST run in trusted mode by default, with no permission restrictions. All capabilities (network, filesystem, environment) are available without explicit grants.

#### Scenario: Plugin in trusted mode
- **WHEN** a workflow runs without `security: restricted`
- **THEN** plugins have full access to network, filesystem, and environment variables

#### Scenario: Plugin uses any npm package
- **WHEN** a plugin imports axios, pg, ioredis, or any npm package
- **THEN** the package works without restrictions

### Requirement: Restricted mode opt-in

Workflows MAY opt into restricted mode by setting `security: restricted`. In this mode, permissions are enforced via Docker isolation.

#### Scenario: Enabling restricted mode
- **WHEN** a workflow has `security: restricted`
- **THEN** plugins run in Docker containers with network isolation

#### Scenario: Network isolation in restricted mode
- **WHEN** a plugin runs in restricted mode with `--network=none`
- **THEN** all network requests fail unless explicitly allowed via Docker network config

### Requirement: Workflow-level permission declarations

In restricted mode, permissions SHOULD be declared at the workflow level, not the plugin level. The user controls what resources the workflow can access.

#### Scenario: Workflow declares network permissions
- **WHEN** a workflow has:
  ```yaml
  security: restricted
  permissions:
    network:
      - "https://api.github.com/*"
  ```
- **THEN** only requests matching that pattern are allowed

#### Scenario: Workflow declares filesystem permissions
- **WHEN** a workflow has:
  ```yaml
  security: restricted
  permissions:
    filesystem:
      read: ["/data/input"]
      write: ["/data/output"]
  ```
- **THEN** only those paths are mounted as Docker volumes

### Requirement: Plugin manifest capabilities (informative)

Plugin manifests MAY declare capabilities for documentation purposes. These are informative only and not enforced in trusted mode.

#### Scenario: Plugin declares capabilities
- **WHEN** a plugin manifest has:
  ```yaml
  capabilities:
    - postgres
    - network
  ```
- **THEN** the CLI can display what the plugin uses
- **AND** capabilities are NOT enforced in trusted mode

#### Scenario: Permission display for review
- **WHEN** user runs `workflow plugin inspect <plugin>`
- **THEN** declared capabilities are displayed in human-readable format

### Requirement: Database plugin connection model

Database plugins (PostgreSQL, Redis, MongoDB, etc.) MUST connect and disconnect for each action execution. No connection pooling or persistent connections across actions.

#### Scenario: PostgreSQL query action
- **WHEN** a postgres.query action executes
- **THEN** it connects, executes the query, disconnects, and returns results

#### Scenario: Multiple database actions in workflow
- **WHEN** a workflow has multiple postgres.query tasks
- **THEN** each task creates and closes its own connection

### Requirement: Transaction support via single action

For database transactions, plugins SHOULD provide a dedicated action that executes multiple queries in a single connection.

#### Scenario: Transaction action
- **WHEN** a workflow uses postgres.transaction with multiple queries
- **THEN** all queries run in a single connection with BEGIN/COMMIT
