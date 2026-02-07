## Why

Workflows require secrets (API keys, database credentials, tokens) but storing them in YAML files is insecure. Secrets must be injected at runtime without persisting them in plain text, with strict scoping to prevent leakage across workflows or executions.

## What Changes

- Introduce encrypted local secret store with key derivation from master password or key file
- Add secret injection mechanism that resolves template syntax (e.g., `{{ secrets.API_KEY }}`) at task execution time
- Implement CLI commands for secret management (`workflow secrets set/get/list/delete`)
- Add secret masking in logs to prevent accidental exposure
- Support environment variable provider as fallback for secrets
- Enforce strict scoping: secrets accessible only to workflows that explicitly declare them

## Capabilities

### New Capabilities

- `secret-storage-encryption`: Local encrypted secret store using AES-256-GCM with key derivation (PBKDF2 or Argon2)
- `secret-template-resolution`: Runtime resolution of secret templates in workflow task inputs before execution
- `secret-scoping`: Workflow-level secret declarations with strict access control
- `secret-masking`: Automatic detection and masking of secret values in logs and error messages
- `secret-cli-management`: CLI commands for creating, reading, updating, and deleting secrets

### Modified Capabilities

(none - this is a new subsystem)

## Impact

- **New package**: `packages/secrets` (secret store implementation)
- **Engine integration**: Template resolver must call secret store during task input preparation
- **CLI commands**: New `workflow secrets` subcommand group
- **Configuration**: Master key/password configuration in config.yaml or environment
- **Dependencies**: Encryption library (e.g., `@noble/ciphers` or built-in crypto)
- **Logging**: All log outputs must pass through masking filter
- **Worker pool**: Task executor receives resolved inputs (no direct secret access)