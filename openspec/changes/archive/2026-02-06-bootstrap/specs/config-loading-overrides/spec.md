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

## IMPLEMENTATION DECISIONS

### Valibot Schema Validation
The configuration validation SHALL use Valibot schemas for type-safe validation with detailed error messages.

#### Storage Configuration Union Types
The storage configuration SHALL use discriminated unions to enforce type-specific requirements:
- **SQLite storage**: requires `type: "sqlite"` and `path: string`
- **PostgreSQL storage**: requires `type: "postgresql"`, `host: string`, and `database: string`

#### Environment Variable Validation
Environment variable overrides SHALL be validated using dedicated Valibot schemas before being applied to the configuration.

### Configuration Schema Structure

```typescript
// Server configuration
interface ServerConfig {
  port: number;        // 1-65535
  host?: string;
}

// Storage configuration (discriminated union)
interface SqliteStorageConfig {
  type: 'sqlite';
  path: string;
}

interface PostgresqlStorageConfig {
  type: 'postgresql';
  host: string;
  port?: number;       // 1-65535
  database: string;
  username?: string;
  password?: string;
}

type StorageConfig = SqliteStorageConfig | PostgresqlStorageConfig;

// Execution configuration
interface ExecutionConfig {
  maxConcurrentWorkflows: number;    // > 0
  maxConcurrentTasks: number;        // > 0
  defaultTimeoutSeconds?: number;    // > 0
}
```

### Environment Variable Mapping

| Configuration Path | Environment Variable | Type | Validation |
|-------------------|---------------------|------|------------|
| `server.port` | `WORKFLOW_SERVER_PORT` | number | 1-65535 |
| `server.host` | `WORKFLOW_SERVER_HOST` | string | any |
| `storage.type` | `WORKFLOW_STORAGE_TYPE` | enum | "sqlite" \| "postgresql" |
| `storage.path` | `WORKFLOW_STORAGE_PATH` | string | any |
| `storage.host` | `WORKFLOW_STORAGE_HOST` | string | any |
| `storage.port` | `WORKFLOW_STORAGE_PORT` | number | 1-65535 |
| `storage.database` | `WORKFLOW_STORAGE_DATABASE` | string | any |
| `storage.username` | `WORKFLOW_STORAGE_USERNAME` | string | any |
| `storage.password` | `WORKFLOW_STORAGE_PASSWORD` | string | any |
| `execution.maxConcurrentWorkflows` | `WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS` | number | > 0 |
| `execution.maxConcurrentTasks` | `WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS` | number | > 0 |
| `execution.defaultTimeoutSeconds` | `WORKFLOW_EXECUTION_DEFAULT_TIMEOUT_SECONDS` | number | > 0 |
