## ADDED Requirements

### Requirement: Zero permissions by default

Plugins MUST have no permissions by default. All capabilities (network, filesystem, environment) require explicit permission grants in the plugin manifest.

#### Scenario: Plugin with no permissions declared
- **WHEN** a plugin manifest has no permissions section
- **THEN** all host function calls for network, filesystem, and environment access are denied

#### Scenario: Attempting operation without permission
- **WHEN** a plugin without network permission attempts an HTTP request
- **THEN** the request fails with PermissionDeniedError specifying the missing permission

### Requirement: Network permission allowlist

Network permissions MUST be specified as an allowlist of URL patterns. The runtime SHALL only permit requests to URLs matching the declared patterns.

#### Scenario: Request to allowed URL
- **WHEN** a plugin with `network: ["https://api.example.com/*"]` requests `https://api.example.com/data`
- **THEN** the request is permitted and executed

#### Scenario: Request to disallowed URL
- **WHEN** a plugin with `network: ["https://api.example.com/*"]` requests `https://evil.com/steal`
- **THEN** the request is denied with PermissionDeniedError listing the URL and allowed patterns

#### Scenario: Glob pattern matching
- **WHEN** a plugin has `network: ["https://*.internal.corp/*"]`
- **THEN** requests to `https://api.internal.corp/v1` and `https://db.internal.corp/query` are permitted

### Requirement: Filesystem permission with path restrictions

Filesystem permissions MUST specify read and write paths separately. Access is restricted to declared paths only.

#### Scenario: Read from allowed path
- **WHEN** a plugin with `filesystem.read: ["/data/input"]` reads `/data/input/file.json`
- **THEN** the read operation succeeds

#### Scenario: Write to allowed path
- **WHEN** a plugin with `filesystem.write: ["/data/output"]` writes `/data/output/result.json`
- **THEN** the write operation succeeds

#### Scenario: Access to unauthorized path
- **WHEN** a plugin attempts to read `/etc/passwd` without permission
- **THEN** the operation fails with PermissionDeniedError

#### Scenario: Path traversal prevention
- **WHEN** a plugin with `filesystem.read: ["/data"]` attempts to read `/data/../etc/passwd`
- **THEN** the operation fails as the resolved path is outside allowed scope

### Requirement: Environment variable permission

Environment variable access MUST be explicitly granted per variable name or pattern. Only declared variables are accessible.

#### Scenario: Access to granted environment variable
- **WHEN** a plugin with `env: ["API_KEY"]` reads `API_KEY`
- **THEN** the environment variable value is returned

#### Scenario: Access to pattern-matched variable
- **WHEN** a plugin with `env: ["DEBUG_*"]` reads `DEBUG_MODE` and `DEBUG_LEVEL`
- **THEN** both variables are accessible

#### Scenario: Access to undeclared variable
- **WHEN** a plugin with `env: ["API_KEY"]` attempts to read `DATABASE_URL`
- **THEN** the read returns undefined (not the actual value)

### Requirement: Permission audit logging

All permission checks MUST be logged for security audit purposes, including both granted and denied access attempts.

#### Scenario: Denied access audit log
- **WHEN** a plugin attempts a network request that is denied
- **THEN** an audit log entry is created with plugin ID, action, URL, and denial reason

#### Scenario: Granted access audit log
- **WHEN** a plugin successfully makes a permitted network request
- **THEN** an audit log entry is created with plugin ID, action, and URL (configurable log level)

### Requirement: Permission display for review

The system MUST provide a way to display all permissions a plugin requests before installation.

#### Scenario: Plugin permission summary
- **WHEN** user runs `workflow plugin inspect <plugin>`
- **THEN** all declared permissions are displayed in human-readable format

#### Scenario: Permission warning for sensitive access
- **WHEN** a plugin requests broad permissions like `network: ["*"]`
- **THEN** the display includes a security warning about overly broad permissions
