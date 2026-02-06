## ADDED Requirements

### Requirement: Server configuration can be loaded from a YAML file
The system SHALL load configuration from a YAML file and SHALL surface clear error messages when the file cannot be read or parsed.

#### Scenario: Load a valid YAML configuration file
- **WHEN** the user starts the server with a valid configuration file
- **THEN** the system loads the configuration and uses the configured values

### Requirement: Environment variables override YAML configuration deterministically
The system SHALL support overriding configuration values via environment variables with a documented mapping and deterministic precedence (env overrides YAML).

#### Scenario: Override port using an environment variable
- **WHEN** the YAML configuration sets `server.port` to one value and the corresponding environment variable is set to another
- **THEN** the effective configuration uses the environment variable value

### Requirement: Configuration validation produces actionable diagnostics
The system SHALL validate configuration at startup and SHALL fail fast with a deterministic exit code and an error message that identifies the invalid field(s).

#### Scenario: Invalid configuration value is provided
- **WHEN** the configuration contains an invalid value (wrong type, out-of-range, or unsupported enum)
- **THEN** the process exits without starting the server and reports the invalid field(s)
