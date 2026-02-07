## ADDED Requirements

### Requirement: Plugin manifest structure

Every plugin SHALL have a `plugin.yaml` manifest file at its root that defines metadata, actions, and permissions. The manifest MUST be validated before a plugin can be loaded.

#### Scenario: Valid manifest with all required fields
- **WHEN** a plugin.yaml contains name, version, and at least one action
- **THEN** the manifest validation passes and plugin can be loaded

#### Scenario: Missing required fields
- **WHEN** a plugin.yaml is missing name, version, or actions
- **THEN** the manifest validation fails with a descriptive error listing missing fields

### Requirement: Plugin metadata fields

The manifest MUST include the following metadata fields:
- `name`: kebab-case identifier (e.g., `http-client`)
- `version`: semver string (e.g., `1.0.0`)
- `namespace`: plugin namespace for grouping (e.g., `core`, `community`)
- `description`: human-readable description (optional)
- `author`: author name or organization (optional)
- `license`: SPDX license identifier (optional)

#### Scenario: Valid plugin identifier format
- **WHEN** a task references `type: core/http.get`
- **THEN** the runtime resolves namespace=`core`, plugin=`http`, action=`get`

#### Scenario: Invalid name format
- **WHEN** plugin.yaml contains `name: "HTTP Client"` (not kebab-case)
- **THEN** manifest validation fails with "name must be kebab-case"

### Requirement: Action definitions

Each action in the manifest MUST define:
- `name`: action identifier (kebab-case)
- `description`: human-readable description
- `input`: JSON Schema for input validation
- `output`: JSON Schema for output validation

#### Scenario: Action with input/output schemas
- **WHEN** an action defines input schema requiring `url` field
- **THEN** tasks calling this action with missing `url` fail input validation before execution

#### Scenario: Action execution with valid inputs
- **WHEN** a task provides inputs matching the action's input schema
- **THEN** the action executes and output is validated against output schema

### Requirement: Permission declarations

The manifest MUST declare all permissions the plugin requires. Plugins have zero permissions by default.

#### Scenario: Plugin declaring network permission
- **WHEN** plugin.yaml contains `permissions.network: ["https://api.example.com/*"]`
- **THEN** plugin can make HTTP requests only to matching URLs

#### Scenario: Plugin without permission declaration
- **WHEN** plugin.yaml has no permissions section
- **THEN** plugin runs with no network, filesystem, or environment access

### Requirement: Manifest schema validation

The manifest parser MUST validate against a JSON Schema and provide clear error messages for invalid manifests.

#### Scenario: Schema validation error reporting
- **WHEN** plugin.yaml has `version: "not-semver"`
- **THEN** validation fails with "version must be valid semver (e.g., 1.0.0)"

#### Scenario: Unknown fields warning
- **WHEN** plugin.yaml contains fields not in the schema
- **THEN** validation passes but logs a warning about unknown fields
