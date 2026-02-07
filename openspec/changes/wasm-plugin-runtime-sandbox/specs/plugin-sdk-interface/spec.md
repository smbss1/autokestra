## ADDED Requirements

### Requirement: Action handler interface

The SDK MUST provide a typed interface for defining plugin actions. Each action receives validated input and a context object with permitted capabilities.

#### Scenario: Define a simple action
- **WHEN** a plugin author defines an action with input type `{ url: string }` and output type `{ data: any }`
- **THEN** the SDK provides type checking and the runtime validates inputs before execution

#### Scenario: Action receives typed input
- **WHEN** an action is invoked with `{ url: "https://example.com" }`
- **THEN** the action handler receives the input with correct TypeScript types

### Requirement: Plugin context capabilities

The SDK MUST provide a context object to actions that contains only the capabilities granted by permissions. Missing permissions result in missing capabilities.

#### Scenario: Context with network permission
- **WHEN** a plugin has network permission
- **THEN** `context.http` is available with `get`, `post`, `put`, `delete` methods

#### Scenario: Context without network permission
- **WHEN** a plugin has no network permission
- **THEN** `context.http` is undefined or throws immediately on access

#### Scenario: Context with filesystem permission
- **WHEN** a plugin has filesystem read permission
- **THEN** `context.fs.read()` is available for allowed paths

### Requirement: HTTP client interface

The SDK MUST provide a typed HTTP client through `context.http` when network permission is granted.

#### Scenario: HTTP GET request
- **WHEN** action calls `context.http.get(url, options)`
- **THEN** the SDK makes an HTTP GET request and returns typed response

#### Scenario: HTTP request with headers
- **WHEN** action calls `context.http.post(url, { headers, body })`
- **THEN** the request includes specified headers and body

#### Scenario: HTTP response handling
- **WHEN** HTTP request completes
- **THEN** response includes status, headers, and parsed body (JSON if applicable)

### Requirement: Logging interface

The SDK MUST provide a logging interface through `context.log` for all plugins regardless of permissions.

#### Scenario: Plugin logging
- **WHEN** action calls `context.log.info("Processing item", { id: 123 })`
- **THEN** the log entry is captured and associated with the execution

#### Scenario: Log levels
- **WHEN** plugin uses `context.log.debug/info/warn/error`
- **THEN** logs are categorized by level for filtering

### Requirement: Input/output validation

The SDK MUST validate action inputs against the declared schema before execution and validate outputs after execution.

#### Scenario: Invalid input rejected
- **WHEN** action is called with input not matching schema
- **THEN** execution fails with validation error before action code runs

#### Scenario: Output validation
- **WHEN** action returns output not matching declared schema
- **THEN** execution fails with output validation error

### Requirement: Secret access interface

The SDK MUST provide a way to access secrets through `context.secrets` when secrets are configured for the task.

#### Scenario: Access configured secret
- **WHEN** task config includes `secrets: { apiKey: "vault:api-key" }` and action calls `context.secrets.get("apiKey")`
- **THEN** the secret value is returned

#### Scenario: Access unconfigured secret
- **WHEN** action calls `context.secrets.get("unknown")`
- **THEN** undefined is returned (no error)

### Requirement: Plugin definition export

The SDK MUST provide a way to export plugin definition including metadata and actions for the build process.

#### Scenario: Define complete plugin
- **WHEN** plugin author uses `definePlugin({ name, version, actions })`
- **THEN** the build process can extract metadata and generate plugin.yaml

#### Scenario: Action registration
- **WHEN** plugin author defines actions using `defineAction<TInput, TOutput>(handler)`
- **THEN** input/output types are used to generate JSON schemas
