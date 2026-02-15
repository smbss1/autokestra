## MODIFIED Requirements

### Requirement: Trusted mode by default

Plugins MUST run in trusted mode by default, with no permission restrictions. All capabilities (network, filesystem, environment, and shell command execution) are available without explicit grants.

#### Scenario: Plugin in trusted mode
- **WHEN** a workflow runs without `security: restricted`
- **THEN** plugins have full access to network, filesystem, and environment variables

#### Scenario: Plugin uses any npm package
- **WHEN** a plugin imports axios, pg, ioredis, or any npm package
- **THEN** the package works without restrictions

#### Scenario: Bash plugin executes arbitrary command
- **WHEN** `core/bash.exec` runs in trusted mode with command `"rm -rf /tmp/demo"` or any other valid shell command
- **THEN** the permission model does not block execution based on command content
