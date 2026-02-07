## ADDED Requirements

### Requirement: Set secret command

The system SHALL provide a `workflow secrets set <name> [value]` command to create or update secrets.

#### Scenario: Set secret with value
- **WHEN** user runs `workflow secrets set API_KEY myvalue123`
- **THEN** secret "API_KEY" is encrypted and stored with value "myvalue123"

#### Scenario: Set secret with interactive prompt
- **WHEN** user runs `workflow secrets set API_KEY` without value
- **THEN** system prompts for value without echoing to terminal

#### Scenario: Update existing secret
- **WHEN** user sets a secret that already exists
- **THEN** old value is overwritten with new encrypted value

#### Scenario: Set empty value
- **WHEN** user runs `workflow secrets set KEY ""`
- **THEN** command fails with error "Secret value cannot be empty"

### Requirement: Get secret command

The system SHALL provide a `workflow secrets get <name>` command to retrieve decrypted secret values.

#### Scenario: Get existing secret
- **WHEN** user runs `workflow secrets get API_KEY`
- **THEN** decrypted value is displayed to terminal

#### Scenario: Get non-existent secret
- **WHEN** user runs `workflow secrets get MISSING`
- **THEN** command fails with error "Secret 'MISSING' not found"

#### Scenario: Security warning on get
- **WHEN** user runs `workflow secrets get`
- **THEN** command displays warning about exposing secrets in terminal

### Requirement: List secrets command

The system SHALL provide a `workflow secrets list` command to show all secret names without values.

#### Scenario: List all secrets
- **WHEN** user runs `workflow secrets list`
- **THEN** output shows secret names, creation dates, and last updated dates

#### Scenario: JSON output format
- **WHEN** user runs `workflow secrets list --json`
- **THEN** output is valid JSON array of secret metadata

#### Scenario: No secrets exist
- **WHEN** no secrets are stored and user runs list
- **THEN** output indicates "No secrets found"

### Requirement: Delete secret command

The system SHALL provide a `workflow secrets delete <name>` command to remove secrets.

#### Scenario: Delete existing secret
- **WHEN** user runs `workflow secrets delete API_KEY`
- **THEN** secret is permanently removed from store

#### Scenario: Delete non-existent secret
- **WHEN** user runs `workflow secrets delete MISSING`
- **THEN** command fails with error "Secret 'MISSING' not found"

#### Scenario: Confirmation prompt
- **WHEN** user runs delete command
- **THEN** system prompts for confirmation before deletion

#### Scenario: Force delete without prompt
- **WHEN** user runs `workflow secrets delete KEY --force`
- **THEN** secret is deleted without confirmation

### Requirement: CLI error handling

All secrets commands SHALL provide clear error messages for common failure cases.

#### Scenario: Master key not configured
- **WHEN** user runs any secrets command and master key is not configured
- **THEN** error explains how to configure AUTOKESTRA_SECRET_KEY or generate key file

#### Scenario: Database connection error
- **WHEN** secrets database cannot be accessed
- **THEN** error indicates database path and permission issue

#### Scenario: Invalid secret name
- **WHEN** secret name contains invalid characters
- **THEN** error lists allowed characters (alphanumeric, underscore, hyphen)