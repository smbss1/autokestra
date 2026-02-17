## ADDED Requirements

### Requirement: Docker plugin actions
The system MUST provide a `core/docker` plugin with typed actions `build` and `run` exposed through plugin manifest schemas.

#### Scenario: Workflow resolves docker build action
- **WHEN** a workflow task uses type `core/docker.build`
- **THEN** the plugin runtime dispatches the `build` action with validated input schema

#### Scenario: Workflow resolves docker run action
- **WHEN** a workflow task uses type `core/docker.run`
- **THEN** the plugin runtime dispatches the `run` action with validated input schema

### Requirement: Deterministic docker command execution output
Each `core/docker` action MUST return deterministic execution output including `success`, `exitCode`, `stdout`, `stderr`, `durationMs`, and `timedOut`, and MAY include `invokedCommand` for diagnostics.

#### Scenario: Successful docker action result
- **WHEN** a docker command exits with code `0`
- **THEN** the action output sets `success: true` and includes captured stdout/stderr and duration

#### Scenario: Failed docker action result
- **WHEN** a docker command exits with a non-zero code
- **THEN** the action output sets `success: false` and includes `exitCode` and captured stderr

#### Scenario: Action returns invoked command metadata
- **WHEN** docker action execution completes
- **THEN** output may include `invokedCommand` reflecting the exact command line used

### Requirement: Docker CLI availability validation
The plugin MUST fail with an explicit execution error when Docker CLI is unavailable on the host.

#### Scenario: Docker command not found
- **WHEN** the host cannot resolve the `docker` executable
- **THEN** the action fails with a validation or execution error indicating Docker is required

### Requirement: Docker action input validation
The plugin MUST validate required action inputs before command execution.

#### Scenario: Build action missing required context path
- **WHEN** `core/docker.build` input omits required build context
- **THEN** execution is rejected before invoking Docker CLI

#### Scenario: Run action missing required image
- **WHEN** `core/docker.run` input omits required image name
- **THEN** execution is rejected before invoking Docker CLI

### Requirement: MVP run scope excludes host volume mapping
For the MVP, `core/docker.run` MUST support `image`, optional `command/args`, optional `env`, and timeout controls, and MUST reject host volume mapping inputs.

#### Scenario: Run action receives host volumes input
- **WHEN** `core/docker.run` input includes volume mapping fields
- **THEN** execution is rejected before invoking Docker CLI with an input-validation error

### Requirement: Trusted-mode-only execution for Docker host access
`core/docker` actions MUST execute only when workflow security mode is `trusted` in this change.

#### Scenario: Restricted workflow uses docker action
- **WHEN** a workflow in `restricted` mode invokes `core/docker.*`
- **THEN** execution is denied with a security validation error before command execution
