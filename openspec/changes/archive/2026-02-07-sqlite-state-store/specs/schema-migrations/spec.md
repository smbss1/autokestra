## ADDED Requirements

### Requirement: Schema version is tracked in the database
The system SHALL maintain a schema_version table to track the current migration version.

#### Scenario: Schema version table is created
- **WHEN** migrations are initialized
- **THEN** a schema_version table is created with version and applied_at columns

#### Scenario: Current version is queryable
- **WHEN** the current schema version is queried
- **THEN** the latest version number from schema_version is returned

### Requirement: Migrations are applied incrementally
The system SHALL apply pending migrations in sequential order.

#### Scenario: Apply pending migrations
- **WHEN** the engine starts and detects pending migrations
- **THEN** migrations are applied in order from current version to latest

#### Scenario: Skip already applied migrations
- **WHEN** a migration version is already in schema_version
- **THEN** that migration is skipped

### Requirement: Migration files are versioned sequentially
The system SHALL use sequential numeric versions for migration files.

#### Scenario: Migration files have sequential numbers
- **WHEN** migration files are listed
- **THEN** they are numbered sequentially (001, 002, 003...)

#### Scenario: Migration order is deterministic
- **WHEN** migrations are applied
- **THEN** they execute in ascending numeric order

### Requirement: Each migration can be rolled back
The system SHALL support rollback migrations for each forward migration.

#### Scenario: Down migration exists for each up migration
- **WHEN** a migration is created
- **THEN** both up and down migration scripts are provided

#### Scenario: Rollback reverts changes
- **WHEN** a rollback is executed
- **THEN** the down migration script reverts the changes from the up migration

### Requirement: Migration failures are handled safely
The system SHALL handle migration failures without corrupting the database.

#### Scenario: Failed migration rolls back
- **WHEN** a migration fails during execution
- **THEN** the transaction is rolled back and the version is not recorded

#### Scenario: Error details are logged
- **WHEN** a migration fails
- **THEN** detailed error information is logged for debugging

### Requirement: Migrations are executed in transactions
The system SHALL execute each migration within a transaction.

#### Scenario: Successful migration is committed
- **WHEN** a migration completes successfully
- **THEN** the transaction is committed and version is recorded

#### Scenario: Failed migration does not commit
- **WHEN** a migration encounters an error
- **THEN** the transaction is rolled back and database state is unchanged

### Requirement: Migration status is inspectable
The system SHALL provide CLI commands to inspect migration status.

#### Scenario: List applied migrations
- **WHEN** migration status is queried
- **THEN** all applied migrations are listed with timestamps

#### Scenario: Check for pending migrations
- **WHEN** pending migrations are checked
- **THEN** the list of unapplied migrations is returned
