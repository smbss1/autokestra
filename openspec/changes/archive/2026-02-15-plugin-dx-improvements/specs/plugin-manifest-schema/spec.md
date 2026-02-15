## MODIFIED Requirements

### Requirement: Action definitions

Each action in the manifest MUST define:
- `name`: action identifier (kebab-case)
- `description`: human-readable description
- `input`: JSON Schema for input validation
- `output`: JSON Schema for output validation

#### Scenario: Action with input/output schemas
- **WHEN** an action defines input schema requiring `url` field
- **THEN** tasks calling this action with missing `url` fail input validation before execution

#### Scenario: Action selection aligns with task reference
- **WHEN** task references `type: core/http.get`
- **THEN** runtime selects action `get` from manifest instead of defaulting to the first declared action

### Requirement: Manifest schema validation

The manifest parser MUST validate against a JSON Schema and provide clear error messages for invalid manifests, and local preflight validation MUST use the same schema semantics.

#### Scenario: Schema validation error reporting
- **WHEN** plugin.yaml has `version: "not-semver"`
- **THEN** validation fails with an actionable error indicating semver format is required

#### Scenario: Runtime and local validator parity
- **WHEN** `workflow plugin validate` reports manifest success
- **THEN** runtime manifest loading evaluates the same required fields and accepted structures
