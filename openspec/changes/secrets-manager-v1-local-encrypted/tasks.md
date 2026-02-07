## 1. Package Setup & Dependencies

- [ ] 1.1 Create `packages/secrets` directory with `package.json` and `tsconfig.json`
- [ ] 1.2 Add crypto dependencies (use Node.js built-in crypto module)
- [ ] 1.3 Configure exports in `index.ts`
- [ ] 1.4 Add `@autokestra/secrets` to engine package.json

## 2. Encryption Core

- [ ] 2.1 Implement `SecretEncryption` class with AES-256-GCM encryption/decryption
- [ ] 2.2 Implement PBKDF2 key derivation (100k iterations, SHA-256)
- [ ] 2.3 Add IV generation (unique 12-byte IV per secret)
- [ ] 2.4 Implement authentication tag handling
- [ ] 2.5 Add unit tests for encryption/decryption round-trip
- [ ] 2.6 Add tests for tamper detection (modified ciphertext/tag)

## 3. Master Key Management

- [ ] 3.1 Implement `MasterKeyProvider` with environment variable support
- [ ] 3.2 Add key file reader (~/.autokestra/secret.key)
- [ ] 3.3 Implement key file auto-generation on first use
- [ ] 3.4 Add key derivation caching (derive once per session)
- [ ] 3.5 Add tests for key resolution order (env → file → generate)

## 4. Secret Store (SQLite)

- [ ] 4.1 Create SQLite schema for secrets table (name, encrypted_value, iv, auth_tag, timestamps)
- [ ] 4.2 Implement `SecretStore` class with CRUD operations
- [ ] 4.3 Add `set(name, value)` method with encryption
- [ ] 4.4 Add `get(name)` method with decryption
- [ ] 4.5 Add `list()` method (names and metadata only)
- [ ] 4.6 Add `delete(name)` method
- [ ] 4.7 Add migration script to create secrets table if not exists
- [ ] 4.8 Add unit tests for store operations
- [ ] 4.9 Add integration tests with temporary database

## 5. Secret Template Resolution

- [ ] 5.1 Extend template resolver to support `{{ secrets.NAME }}` syntax
- [ ] 5.2 Implement `SecretResolver` class that accesses SecretStore
- [ ] 5.3 Add workflow secret scope validation (check declared secrets)
- [ ] 5.4 Add environment variable fallback for missing secrets
- [ ] 5.5 Handle nested objects and arrays in templates
- [ ] 5.6 Add error handling for missing/undeclared secrets
- [ ] 5.7 Add unit tests for template resolution
- [ ] 5.8 Add tests for scope enforcement

## 6. Workflow Secret Scoping

- [ ] 6.1 Add `secrets` field to workflow YAML schema
- [ ] 6.2 Implement pre-execution validation (check all declared secrets exist)
- [ ] 6.3 Pass secret scope to task executor
- [ ] 6.4 Add error reporting for missing declared secrets
- [ ] 6.5 Add tests for scope validation

## 7. Worker Pool Integration

- [ ] 7.1 Update `WorkflowTaskExecutor` to resolve secret templates before execution
- [ ] 7.2 Pass SecretResolver to executor constructor
- [ ] 7.3 Add secret resolution step in execute() method
- [ ] 7.4 Ensure plugins receive resolved inputs (no templates)
- [ ] 7.5 Add integration tests with plugin execution

## 8. Secret Masking

- [ ] 8.1 Implement `SecretMasker` class with regex-based value replacement
- [ ] 8.2 Create log wrapper that intercepts all log calls
- [ ] 8.3 Add secret value tracking (load at execution start, clear at end)
- [ ] 8.4 Apply masking to stdout, stderr, and structured logs
- [ ] 8.5 Add configuration for mask placeholder (default: "***SECRET***")
- [ ] 8.6 Add performance optimization for multiple secrets (compile regex once)
- [ ] 8.7 Add unit tests for masking various log formats
- [ ] 8.8 Add tests for multiple occurrences and edge cases

## 9. CLI Commands - Secrets Subcommand

- [ ] 9.1 Add `workflow secrets` subcommand group to CLI
- [ ] 9.2 Implement `secrets set <name> [value]` command
- [ ] 9.3 Add interactive prompt for value input (when value not provided)
- [ ] 9.4 Implement `secrets get <name>` command with security warning
- [ ] 9.5 Implement `secrets list` command with table output
- [ ] 9.6 Add `--json` flag for list command
- [ ] 9.7 Implement `secrets delete <name>` command with confirmation prompt
- [ ] 9.8 Add `--force` flag for delete without confirmation
- [ ] 9.9 Add comprehensive error handling for all commands
- [ ] 9.10 Add CLI tests for each command

## 10. Error Handling & Validation

- [ ] 10.1 Add descriptive error messages for missing master key
- [ ] 10.2 Add validation for secret names (alphanumeric, underscore, hyphen only)
- [ ] 10.3 Add error handling for database connection failures
- [ ] 10.4 Add error handling for decryption failures (wrong key, corrupted data)
- [ ] 10.5 Add tests for all error scenarios

## 11. Documentation

- [ ] 11.1 Document secret setup and master key configuration
- [ ] 11.2 Document workflow secrets declaration syntax
- [ ] 11.3 Document CLI commands with examples
- [ ] 11.4 Document best practices for key file security
- [ ] 11.5 Add migration guide for adding secrets to existing workflows

## 12. Examples & Integration Tests

- [ ] 12.1 Create example workflow using secrets
- [ ] 12.2 Add end-to-end test: set secret → use in workflow → verify masking
- [ ] 12.3 Add test for environment variable fallback
- [ ] 12.4 Add test for scope enforcement (undeclared secret access)
- [ ] 12.5 Add performance test with many secrets