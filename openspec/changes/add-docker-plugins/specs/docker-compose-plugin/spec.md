## ADDED Requirements

### Requirement: Docker Compose plugin actions
The system MUST provide a `core/docker-compose` plugin with typed actions `up` and `down` exposed through plugin manifest schemas.

#### Scenario: Workflow resolves compose up action
- **WHEN** a workflow task uses type `core/docker-compose.up`
- **THEN** the plugin runtime dispatches the `up` action with validated input schema

#### Scenario: Workflow resolves compose down action
- **WHEN** a workflow task uses type `core/docker-compose.down`
- **THEN** the plugin runtime dispatches the `down` action with validated input schema

### Requirement: Compose project file targeting
Compose actions MUST support explicit compose file targeting via `files: string[]` for deterministic project resolution.

#### Scenario: Compose uses provided file list
- **WHEN** task input includes `files: ["./docker-compose.yml", "./docker-compose.prod.yml"]`
- **THEN** the action invokes Compose with `-f` arguments in the same order as provided

#### Scenario: Compose rejects missing file input
- **WHEN** required compose files input is missing or empty
- **THEN** execution is rejected before invoking Compose CLI

### Requirement: Deterministic compose command execution output
Each `core/docker-compose` action MUST return deterministic execution output including `success`, `exitCode`, `stdout`, `stderr`, `durationMs`, and `timedOut`, and MAY include `invokedCommand` for diagnostics.

#### Scenario: Successful compose action result
- **WHEN** a compose command exits with code `0`
- **THEN** the action output sets `success: true` and includes captured stdout/stderr and duration

#### Scenario: Failed compose action result
- **WHEN** a compose command exits with a non-zero code
- **THEN** the action output sets `success: false` and includes `exitCode` and captured stderr

#### Scenario: Action returns invoked command metadata
- **WHEN** compose action execution completes
- **THEN** output may include `invokedCommand` reflecting the exact command line used

### Requirement: Compose command resolution order
The plugin MUST resolve compose execution by trying `docker compose` first and MUST fallback to `docker-compose` only when the first option is unavailable.

#### Scenario: Modern compose command available
- **WHEN** host supports `docker compose`
- **THEN** the action executes compose operations through `docker compose`

#### Scenario: Legacy compose binary fallback
- **WHEN** `docker compose` is unavailable and `docker-compose` exists
- **THEN** the action executes compose operations through `docker-compose`

### Requirement: Compose CLI availability validation
The plugin MUST fail with an explicit execution error when Compose support is unavailable (`docker compose` or configured equivalent).

#### Scenario: Compose command not available
- **WHEN** the host cannot execute compose commands
- **THEN** the action fails with a validation or execution error indicating Compose is required

### Requirement: Trusted-mode-only execution for Docker host access
`core/docker-compose` actions MUST execute only when workflow security mode is `trusted` in this change.

#### Scenario: Restricted workflow uses compose action
- **WHEN** a workflow in `restricted` mode invokes `core/docker-compose.*`
- **THEN** execution is denied with a security validation error before command execution
