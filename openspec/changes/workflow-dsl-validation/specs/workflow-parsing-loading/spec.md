## ADDED Requirements

### Requirement: Workflows can be loaded from YAML files
The system SHALL load workflows from YAML files and SHALL surface clear error messages when the file cannot be read.

#### Scenario: Missing file
- **WHEN** the user attempts to load a workflow file that does not exist
- **THEN** the system returns an error indicating the file cannot be read

### Requirement: YAML parsing errors are reported clearly
The system SHALL parse YAML and SHALL report parsing errors with enough detail to debug.

#### Scenario: Invalid YAML syntax
- **WHEN** the workflow file contains invalid YAML
- **THEN** the system returns an error indicating a YAML parse failure

### Requirement: Loaded workflows are normalized before validation
The system SHALL normalize parsed YAML into a canonical in-memory representation before performing semantic validation.

#### Scenario: YAML parsed into canonical model
- **WHEN** a workflow is successfully parsed
- **THEN** the system produces a canonical workflow object used as input for validation

### Requirement: Workflow source metadata is preserved
The system SHALL preserve workflow source metadata (at minimum file path, and optionally document position if available) for diagnostics.

#### Scenario: Include file path in diagnostics
- **WHEN** workflow loading or validation fails
- **THEN** the error includes the workflow file path

### Requirement: Unknown top-level keys are rejected by default
The system SHALL reject unknown top-level keys by default to reduce ambiguity and security risk.

#### Scenario: Unknown top-level key
- **WHEN** a workflow YAML contains an unknown top-level key (not in the DSL)
- **THEN** validation fails and reports the unknown key

### Requirement: Workflow DSL supports an optional version field
The system SHALL support an optional version field (e.g. `apiVersion` or `version`) to enable forward-compatible evolution.

#### Scenario: Missing version
- **WHEN** a workflow omits the version field
- **THEN** the workflow is still loadable under the default version

#### Scenario: Unsupported version
- **WHEN** a workflow specifies a version not supported by the engine
- **THEN** validation fails and indicates the supported versions
