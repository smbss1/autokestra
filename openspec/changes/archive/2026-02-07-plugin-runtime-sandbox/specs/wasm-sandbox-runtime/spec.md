## ADDED Requirements

### Requirement: Child process isolation (trusted mode)

In trusted mode, plugins MUST execute in a child process spawned via Bun.spawn(). This provides crash isolation without restricting capabilities.

#### Scenario: Plugin runs in child process
- **WHEN** a plugin action executes in trusted mode
- **THEN** it runs in a separate child process

#### Scenario: Plugin crash isolation
- **WHEN** a plugin crashes or throws an unhandled exception
- **THEN** the child process terminates but the engine continues running
- **AND** the task fails with error details

#### Scenario: Plugin timeout enforcement
- **WHEN** a plugin action runs longer than the configured timeout (default 30s)
- **THEN** the child process is killed and the task fails with timeout error

### Requirement: Docker container isolation (restricted mode)

In restricted mode, plugins MUST execute in Docker containers with security restrictions.

#### Scenario: Network isolation
- **WHEN** a plugin runs in restricted mode
- **THEN** it runs with `--network=none` by default (no network access)

#### Scenario: Filesystem isolation
- **WHEN** a plugin runs in restricted mode
- **THEN** it runs with `--read-only` filesystem
- **AND** only explicitly declared paths are mounted as volumes

#### Scenario: Resource limits
- **WHEN** a plugin runs in restricted mode
- **THEN** it runs with memory limits (`--memory=256m`) and CPU limits (`--cpus=0.5`)

### Requirement: Input/Output communication

The runtime MUST communicate with plugins via stdin/stdout using JSON messages.

#### Scenario: Plugin receives input
- **WHEN** a plugin action starts
- **THEN** it receives input as JSON on stdin

#### Scenario: Plugin returns output
- **WHEN** a plugin action completes
- **THEN** it writes output as JSON to stdout

#### Scenario: Plugin logs
- **WHEN** a plugin uses context.log
- **THEN** log messages are written to stderr (not stdout)

### Requirement: Error handling

Plugin errors MUST be caught and converted to task failures without crashing the engine.

#### Scenario: Plugin throws error
- **WHEN** plugin code throws an error
- **THEN** the error is captured and the task fails with error details

#### Scenario: Plugin exits with non-zero code
- **WHEN** the plugin process exits with a non-zero code
- **THEN** the task fails with the exit code and any stderr output

### Requirement: Plugin runtime interface

The plugin runtime MUST implement a common interface to support multiple execution backends.

#### Scenario: Runtime interface
- **WHEN** the engine needs to execute a plugin
- **THEN** it uses the PluginRuntime interface which can be ProcessRuntime or DockerRuntime

#### Scenario: Runtime selection
- **WHEN** a workflow has `security: restricted`
- **THEN** DockerRuntime is used
- **ELSE** ProcessRuntime is used

### Requirement: Environment variable passing

The runtime MUST pass environment variables to the plugin based on configuration.

#### Scenario: Secrets as environment variables
- **WHEN** a task has secrets configured
- **THEN** those secrets are passed as environment variables to the plugin process

#### Scenario: Trusted mode environment
- **WHEN** a plugin runs in trusted mode
- **THEN** it inherits specified environment variables from the engine

#### Scenario: Restricted mode environment
- **WHEN** a plugin runs in restricted mode
- **THEN** only explicitly declared environment variables are passed to the container
