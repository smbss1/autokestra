## ADDED Requirements

### Requirement: Automatic secret value masking

The system SHALL automatically mask secret values in all log output by replacing them with a masked placeholder.

#### Scenario: Secret value in log message
- **WHEN** a log contains the text of a decrypted secret value
- **THEN** the secret value is replaced with "***SECRET***" in the output

#### Scenario: Multiple occurrences of same secret
- **WHEN** a secret value appears multiple times in a log message
- **THEN** all occurrences are masked

#### Scenario: Partial secret match
- **WHEN** log contains a substring of a secret value
- **THEN** the full secret value is masked but substrings are not (to avoid false positives)

### Requirement: Masking scope

Secret masking SHALL apply to all log outputs including stdout, stderr, and structured logs.

#### Scenario: Console logs are masked
- **WHEN** plugin writes secret value to stdout
- **THEN** value is masked before being stored or displayed

#### Scenario: Error messages are masked
- **WHEN** exception message contains secret value
- **THEN** error log has masked value

#### Scenario: Structured logs are masked
- **WHEN** structured log entry has field with secret value
- **THEN** field value is masked in log output

### Requirement: Secret tracking for masking

The system SHALL track all decrypted secret values during execution lifetime for masking purposes.

#### Scenario: Secrets loaded at execution start
- **WHEN** workflow execution begins
- **THEN** all declared secrets are decrypted and added to masking registry

#### Scenario: Secrets cleared after execution
- **WHEN** workflow execution completes (success or failure)
- **THEN** decrypted secret values are cleared from memory

### Requirement: No plain text secret persistence

The system SHALL never persist decrypted secret values to disk or database.

#### Scenario: Execution logs with secrets
- **WHEN** task generates logs containing secret values
- **THEN** logs are masked before being written to database

#### Scenario: Task output with secrets
- **WHEN** task output contains secret value
- **THEN** output is NOT automatically masked (user must handle sensitive outputs)

### Requirement: Masking performance

Secret masking SHALL not significantly degrade logging performance even with many secrets.

#### Scenario: Many secrets performance
- **WHEN** workflow declares 50 secrets
- **THEN** log masking adds less than 10ms overhead per log line

#### Scenario: Long secret values
- **WHEN** secret value is 1KB in size
- **THEN** masking still performs within acceptable limits