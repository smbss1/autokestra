## Context

The workflow engine executes tasks that often require secrets (API keys, database credentials, OAuth tokens). Currently, there is no secure mechanism to store and inject these secrets. Users would be forced to put secrets directly in workflow YAML files or pass them as plain environment variables, both of which are insecure.

**Current state:**
- No secret storage mechanism exists
- Template resolution exists for variables (`{{ vars.KEY }}`) but not secrets
- Logs are not filtered for sensitive values
- Plugin runtime passes inputs directly without secret handling

**Constraints:**
- Must run on modest hardware (single machine, no external secret store)
- Bun runtime (Node.js crypto APIs available)
- Secrets should never be logged or persisted in plain text
- Simple CLI-first interface (no GUI in v1)

## Goals / Non-Goals

**Goals:**
- Store secrets encrypted at rest using strong encryption (AES-256-GCM)
- Support template syntax `{{ secrets.NAME }}` in workflow task inputs
- Provide CLI for secret CRUD operations
- Mask secret values in all log output
- Support environment variable fallback for secrets (e.g., CI/CD)
- Workflow-level secret scoping (workflows declare which secrets they need)

**Non-Goals:**
- External secret stores (Vault, AWS Secrets Manager) - can be added later
- Secret rotation or expiration - v1 is static secrets
- Secret versioning or audit history - v1 is simple key-value
- Fine-grained task-level secret permissions - v1 is workflow-level
- Secret sharing across workflows - each workflow declares its own secrets

## Decisions

### 1. Encryption: AES-256-GCM with PBKDF2 Key Derivation

**Decision:** Use AES-256-GCM for encryption with master key derived from password/key file using PBKDF2 (100,000 iterations).

**Rationale:**
- AES-256-GCM provides authenticated encryption (integrity + confidentiality)
- PBKDF2 is widely supported and sufficient for local key derivation
- Bun/Node.js crypto module has built-in support

**Alternatives considered:**
- **Argon2**: Stronger but requires native bindings (complicates deployment)
- **ChaCha20-Poly1305**: Good alternative but AES-GCM is more standard

### 2. Storage: SQLite with Encrypted Blob Column

**Decision:** Store secrets in SQLite database with encrypted values in a blob column. Schema:
```sql
CREATE TABLE secrets (
  name TEXT PRIMARY KEY,
  encrypted_value BLOB NOT NULL,
  iv BLOB NOT NULL,
  auth_tag BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Rationale:**
- Reuses existing SQLite infrastructure
- Secrets are never in plain text on disk
- Each secret has unique IV (initialization vector)
- Auth tag ensures integrity

**Alternatives considered:**
- **Separate encrypted file per secret**: More secure isolation but complex to manage
- **Single encrypted JSON file**: Simpler but requires full rewrite on every change

### 3. Master Key Configuration

**Decision:** Support three modes (checked in order):
1. Environment variable: `AUTOKESTRA_SECRET_KEY`
2. Key file: `~/.autokestra/secret.key` (auto-generated on first use)
3. Interactive prompt (for `secrets set` commands)

**Rationale:**
- Environment variable is convenient for CI/CD
- Key file is good for local development
- Interactive prompt provides explicit control

**Alternatives considered:**
- **Password-only**: Less convenient (need to type every time)
- **Hardcoded key**: Completely insecure

### 4. Template Resolution: Pre-Execution in Task Executor

**Decision:** Resolve secret templates in `WorkflowTaskExecutor` before passing inputs to plugin runtime. Templates like `{{ secrets.API_KEY }}` are replaced with actual values.

**Architecture:**
```
WorkflowTaskExecutor
  ↓
SecretResolver.resolve(inputs, workflowSecretScope)
  ↓
Plugin receives plain inputs (no template syntax)
```

**Rationale:**
- Plugins never see template syntax
- Secret access is controlled at workflow level
- Easy to add other template types (e.g., `{{ vault.KEY }}`) later

**Alternatives considered:**
- **Resolve in scheduler**: Too early (before execution context)
- **Resolve in plugin**: Plugins shouldn't have direct secret store access

### 5. Secret Masking: Regex-Based Log Filter

**Decision:** Implement a log wrapper that intercepts all log calls and masks known secret values using regex replacement.

**Implementation:**
- Secret store tracks all decrypted values in memory (cleared after execution)
- Log wrapper replaces any occurrence of secret values with `***SECRET***`
- Applied to stdout, stderr, and structured logs

**Rationale:**
- Prevents accidental secret leakage
- Works with existing logging code
- No changes needed in plugins

**Trade-off:** Masking is CPU-intensive if many secrets. Acceptable for v1.

### 6. CLI Commands: Subcommand Group

**Decision:** Add `workflow secrets` subcommand group:
```bash
workflow secrets set <name> [value]      # Prompt if value not provided
workflow secrets get <name>              # Show value (use carefully!)
workflow secrets list                    # List secret names only
workflow secrets delete <name>
```

**Rationale:**
- Consistent with existing CLI structure (`workflow`, `execution`, `plugin`)
- Interactive prompt for `set` avoids shell history leakage
- `get` is dangerous but useful for debugging

### 7. Workflow Secret Scoping

**Decision:** Workflows declare required secrets in YAML:
```yaml
name: my-workflow
secrets:
  - DATABASE_URL
  - API_KEY

tasks:
  - type: postgres.query
    inputs:
      url: {{ secrets.DATABASE_URL }}
```

At execution time, engine validates all declared secrets exist before starting workflow.

**Rationale:**
- Explicit is better than implicit
- Early failure if secrets missing
- Enables future access control features

**Alternatives considered:**
- **Automatic discovery from templates**: More convenient but less explicit
- **No scoping**: Too permissive

## Risks / Trade-offs

**[Risk] Master key compromise exposes all secrets**  
→ Mitigation: Document key security best practices. Future: support external secret stores.

**[Risk] Memory contains decrypted secrets during execution**  
→ Mitigation: Clear secret values immediately after use. Acceptable for v1.

**[Risk] Secret masking regex can be slow with many secrets**  
→ Mitigation: Optimize regex patterns. Monitor performance in real usage.

**[Risk] Users might accidentally commit secret.key file**  
→ Mitigation: Add to .gitignore template. Document in setup guide.

**[Trade-off] No secret rotation in v1**  
→ Users must manually delete and re-add secrets. Document workaround.

**[Trade-off] SQLite secrets table is not human-readable**  
→ CLI provides `list` and `get` commands. This is by design for security.

## Migration Plan

1. **Initial setup**: On first `secrets set` command, generate master key and create secrets table
2. **Existing workflows**: No migration needed (this is a new feature)
3. **Rollback**: Remove secrets table; workflows with secret templates will fail gracefully

## Open Questions

Decisions (resolved):

- Secret namespaces (e.g., `prod/*`, `staging/*`) are deferred to v2. No v1 work required.
- `secrets list` will include metadata columns (`created_at` and `updated_at`). The storage schema and CLI will expose these fields.
- Secret names will NOT be encrypted in v1; only secret values are encrypted. Names are considered non-sensitive metadata.