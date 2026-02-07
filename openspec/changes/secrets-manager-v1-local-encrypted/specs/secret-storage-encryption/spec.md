## ADDED Requirements

### Requirement: Secret encryption at rest

The system SHALL encrypt all secret values before storing them on disk using AES-256-GCM authenticated encryption.

#### Scenario: Secret is encrypted before storage
- **WHEN** a secret is saved to the store
- **THEN** the secret value is encrypted with AES-256-GCM and only the encrypted value is persisted

#### Scenario: Each secret has unique IV
- **WHEN** multiple secrets are stored
- **THEN** each secret MUST use a unique initialization vector (IV)

#### Scenario: Encrypted secrets include authentication tag
- **WHEN** a secret is encrypted
- **THEN** the authentication tag is stored alongside the encrypted value for integrity verification

### Requirement: Master key derivation

The system SHALL derive an encryption key from a master password or key file using PBKDF2 with at least 100,000 iterations.

#### Scenario: Key derived from environment variable
- **WHEN** AUTOKESTRA_SECRET_KEY environment variable is set
- **THEN** system uses it to derive the encryption key

#### Scenario: Key derived from key file
- **WHEN** AUTOKESTRA_SECRET_KEY is not set and ~/.autokestra/secret.key exists
- **THEN** system uses the key file content to derive the encryption key

#### Scenario: Key file auto-generation
- **WHEN** no key is configured and user runs a secrets command
- **THEN** system generates a random 256-bit key and saves it to ~/.autokestra/secret.key

#### Scenario: Key derivation failure handling
- **WHEN** master key cannot be loaded or derived
- **THEN** system fails with clear error message indicating how to configure the master key

### Requirement: Decryption with integrity check

The system SHALL verify the authentication tag before decrypting secret values to prevent tampering.

#### Scenario: Successful decryption
- **WHEN** an encrypted secret is retrieved with valid authentication tag
- **THEN** system decrypts the value and returns plain text

#### Scenario: Tampered secret detection
- **WHEN** an encrypted secret's data has been modified
- **THEN** decryption fails with integrity check error

#### Scenario: Wrong master key detection
- **WHEN** attempting to decrypt with incorrect master key
- **THEN** decryption fails with authentication error