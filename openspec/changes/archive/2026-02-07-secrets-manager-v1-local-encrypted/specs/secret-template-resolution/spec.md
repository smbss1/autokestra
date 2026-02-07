## ADDED Requirements

### Requirement: Secret template syntax

The system SHALL support `{{ secrets.NAME }}` template syntax in workflow task inputs for referencing secrets.

#### Scenario: Simple secret reference
- **WHEN** task input contains `{{ secrets.API_KEY }}`
- **THEN** template is replaced with the decrypted value of secret named "API_KEY"

#### Scenario: Multiple secrets in one input
- **WHEN** task input contains `{{ secrets.USER }}:{{ secrets.PASSWORD }}`
- **THEN** both templates are replaced with their respective secret values

#### Scenario: Secret in nested object
- **WHEN** task input is `{ "config": { "token": "{{ secrets.TOKEN }}" } }`
- **THEN** nested template is resolved to secret value

#### Scenario: Secret in array
- **WHEN** task input contains array with `["{{ secrets.KEY1 }}", "{{ secrets.KEY2 }}"]`
- **THEN** all array elements with templates are resolved

### Requirement: Template resolution timing

The system SHALL resolve secret templates immediately before task execution, not at workflow parse time.

#### Scenario: Resolution in task executor
- **WHEN** task is about to execute
- **THEN** WorkflowTaskExecutor resolves templates and passes plain inputs to plugin

#### Scenario: No early resolution
- **WHEN** workflow is loaded or validated
- **THEN** secret templates remain as-is without decryption

### Requirement: Missing secret handling

The system SHALL fail task execution with clear error if a referenced secret does not exist.

#### Scenario: Referenced secret not found
- **WHEN** template references `{{ secrets.MISSING }}`
- **THEN** task fails with error "Secret 'MISSING' not found"

#### Scenario: Secret name with whitespace
- **WHEN** template contains `{{ secrets.MY KEY }}`
- **THEN** system trims whitespace and looks up secret "MY KEY"

### Requirement: Environment variable fallback

The system SHALL support falling back to environment variables for secrets if local secret not found.

#### Scenario: Secret from environment
- **WHEN** secret "API_KEY" not in store but environment variable "API_KEY" exists
- **THEN** template `{{ secrets.API_KEY }}` resolves to environment variable value

#### Scenario: Local secret takes precedence
- **WHEN** secret "API_KEY" exists both in store and environment
- **THEN** template uses the store value (local takes precedence)