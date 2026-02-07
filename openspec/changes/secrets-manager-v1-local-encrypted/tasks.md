## 1. Package Setup & Dependencies

- [x] 1.1 Create `packages/secrets` directory with `package.json` and `tsconfig.json`
- [x] 1.2 Add crypto dependencies (use Node.js built-in crypto module)
- [x] 1.3 Configure exports in `index.ts`
- [x] 1.4 Add `@autokestra/secrets` to engine package.json

## 2. Encryption Core

- [x] 2.1 Implement `SecretEncryption` class with AES-256-GCM encryption/decryption
- [x] 2.2 Implement PBKDF2 key derivation (100k iterations, SHA-256)
- [x] 2.3 Add IV generation (unique 12-byte IV per secret)
- [x] 2.4 Implement authentication tag handling
- [x] 2.5 Add unit tests for encryption/decryption round-trip
- [x] 2.6 Add tests for tamper detection (modified ciphertext/tag)

## 3. Master Key Management

- [x] 3.1 Implement `MasterKeyProvider` with environment variable support
- [x] 3.2 Add key file reader (~/.autokestra/secret.key)
- [x] 3.3 Implement key file auto-generation on first use
- [x] 3.4 Add key derivation caching (derive once per session)
- [x] 3.5 Add tests for key resolution order (env → file → generate)

## 4. Secret Store (SQLite)

- [x] 4.1 Create SQLite schema for secrets table (name, encrypted_value, iv, auth_tag, timestamps)
- [x] 4.2 Implement `SecretStore` class with CRUD operations
- [x] 4.3 Add `set(name, value)` method with encryption
- [x] 4.4 Add `get(name)` method with decryption
- [x] 4.5 Add `list()` method (names and metadata only)
- [x] 4.6 Add `delete(name)` method
- [x] 4.7 Add migration script to create secrets table if not exists
- [x] 4.8 Add unit tests for store operations
- [x] 4.9 Add integration tests with temporary database

## 5. Secret Template Resolution

- [x] 5.1 Extend template resolver to support `{{ secrets.NAME }}` syntax
- [x] 5.2 Implement `SecretResolver` class that accesses SecretStore
- [x] 5.3 Add workflow secret scope validation (check declared secrets)
- [x] 5.4 Add environment variable fallback for missing secrets
- [x] 5.5 Handle nested objects and arrays in templates
- [x] 5.6 Add error handling for missing/undeclared secrets
- [x] 5.7 Add unit tests for template resolution
- [x] 5.8 Add tests for scope enforcement

## 6. Workflow Secret Scoping

- [x] 6.1 Add `secrets` field to workflow YAML schema
- [x] 6.2 Implement pre-execution validation (check all declared secrets exist)
- [x] 6.3 Pass secret scope to task executor
- [x] 6.4 Add error reporting for missing declared secrets
- [x] 6.5 Add tests for scope validation

## 7. Worker Pool Integration

- [x] 7.1 Update `WorkflowTaskExecutor` to resolve secret templates before execution
- [x] 7.2 Pass SecretResolver to executor constructor
- [x] 7.3 Add secret resolution step in execute() method
- [x] 7.4 Ensure plugins receive resolved inputs (no templates)
- [x] 7.5 Add integration tests with plugin execution

## 8. Secret Masking

- [x] 8.1 Implement `SecretMasker` class with regex-based value replacement
- [x] 8.2 Create log wrapper that intercepts all log calls
- [x] 8.3 Add secret value tracking (load at execution start, clear at end)
- [x] 8.4 Apply masking to stdout, stderr, and structured logs
- [x] 8.5 Add configuration for mask placeholder (default: "***SECRET***")
- [x] 8.6 Add performance optimization for multiple secrets (compile regex once)
- [x] 8.7 Add unit tests for masking various log formats
- [x] 8.8 Add tests for multiple occurrences and edge cases

## 9. CLI Commands - Secrets Subcommand

- [x] 9.1 Add `workflow secrets` subcommand group to CLI
- [x] 9.2 Implement `secrets set <name> [value]` command
- [x] 9.3 Add interactive prompt for value input (when value not provided)
- [x] 9.4 Implement `secrets get <name>` command with security warning
- [x] 9.5 Implement `secrets list` command with table output
- [x] 9.6 Add `--json` flag for list command
- [x] 9.7 Implement `secrets delete <name>` command with confirmation prompt
- [x] 9.8 Add `--force` flag for delete without confirmation
- [x] 9.9 Add comprehensive error handling for all commands
- [x] 9.10 Add CLI tests for each command

## 10. Error Handling & Validation

- [x] 10.1 Add descriptive error messages for missing master key
- [x] 10.2 Add validation for secret names (alphanumeric, underscore, hyphen only)
- [x] 10.3 Add error handling for database connection failures
- [x] 10.4 Add error handling for decryption failures (wrong key, corrupted data)
- [x] 10.5 Add tests for all error scenarios

## 11. Documentation

- [x] 11.1 Document secret setup and master key configuration
- [x] 11.2 Document workflow secrets declaration syntax
- [x] 11.3 Document CLI commands with examples
- [x] 11.4 Document best practices for key file security
- [x] 11.5 Add migration guide for adding secrets to existing workflows

## 12. Examples & Integration Tests

- [x] 12.1 Create example workflow using secrets
- [x] 12.2 Add end-to-end test: set secret → use in workflow → verify masking
- [x] 12.3 Add test for environment variable fallback
- [x] 12.4 Add test for scope enforcement (undeclared secret access)
- [x] 12.5 Add performance test with many secrets