## ADDED Requirements

### Requirement: Workflow secret declaration

Workflows SHALL declare required secrets in a `secrets` field listing secret names needed for execution.

#### Scenario: Workflow declares secrets
- **WHEN** workflow YAML contains `secrets: [API_KEY, DATABASE_URL]`
- **THEN** workflow is allowed to access those two secrets during execution

#### Scenario: Empty secrets list
- **WHEN** workflow has `secrets: []` or no secrets field
- **THEN** workflow cannot access any secrets

### Requirement: Pre-execution secret validation

The system SHALL validate that all declared secrets exist before starting workflow execution.

#### Scenario: All secrets available
- **WHEN** workflow declares `secrets: [API_KEY]` and secret exists
- **THEN** workflow execution starts normally

#### Scenario: Missing declared secret
- **WHEN** workflow declares `secrets: [MISSING_KEY]` and secret does not exist
- **THEN** workflow execution fails immediately with error listing missing secrets

#### Scenario: Multiple missing secrets
- **WHEN** workflow declares `secrets: [KEY1, KEY2, KEY3]` and KEY2 and KEY3 are missing
- **THEN** error message lists all missing secrets: "Missing secrets: KEY2, KEY3"

### Requirement: Undeclared secret access prevention

The system SHALL prevent access to secrets not declared in the workflow's secrets list.

#### Scenario: Undeclared secret reference
- **WHEN** workflow does not declare "SECRET_KEY" but task input has `{{ secrets.SECRET_KEY }}`
- **THEN** template resolution fails with error "Secret 'SECRET_KEY' not declared in workflow"

#### Scenario: Declared secret allows access
- **WHEN** workflow declares "API_KEY" and task uses `{{ secrets.API_KEY }}`
- **THEN** template resolves successfully

### Requirement: Workflow-level isolation

Secrets SHALL be scoped to workflows such that each workflow execution only has access to its declared secrets.

#### Scenario: Different workflows with different secrets
- **WHEN** workflow A declares `secrets: [KEY_A]` and workflow B declares `secrets: [KEY_B]`
- **THEN** workflow A cannot access KEY_B and workflow B cannot access KEY_A

#### Scenario: Concurrent workflow executions
- **WHEN** two executions of the same workflow run concurrently
- **THEN** both have access to the same declared secrets without interference