## ADDED Requirements

### Requirement: CLI exposes the standard command tree
The system SHALL provide a CLI entrypoint that includes the following top-level command groups: `server`, `workflow`, `execution`, `plugin`, and `config`.

#### Scenario: Display top-level help
- **WHEN** the user runs the CLI with `--help`
- **THEN** help output lists the required command groups

### Requirement: CLI provides JSON output for automation
The system SHALL provide a `--json` option on list/describe-type commands and SHALL output machine-readable JSON that can be parsed without relying on human-formatted text.

#### Scenario: List workflows in JSON
- **WHEN** the user runs `workflow workflow list --json`
- **THEN** the command outputs valid JSON to stdout and exits with status code 0

### Requirement: CLI exit codes are deterministic
The system SHALL define deterministic exit codes for common failure classes (usage error, configuration error, not found, conflict, internal error).

#### Scenario: Invalid command usage
- **WHEN** the user runs a command with invalid arguments
- **THEN** the CLI exits with the documented usage-error exit code
