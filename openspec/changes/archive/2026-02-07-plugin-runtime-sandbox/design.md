## Context

The Autokestra workflow engine requires a plugin system that allows third-party code execution. Currently, the engine has a worker pool capable of executing tasks, but no mechanism for loading and running plugin code. The core challenge is executing TypeScript plugin code with optional sandboxing for security-sensitive environments.

**Current state:**
- Worker pool exists (`packages/engine/src/worker/`) with task execution infrastructure
- Task types reference plugins via `type: <namespace>/<plugin>.<action>` but no plugin loading exists
- No plugin SDK or build tooling for plugin authors
- No permission model implementation

**Constraints:**
- Must run on modest hardware (2 CPU / 4GB RAM)
- Bun runtime (not Node.js)
- Must support TypeScript plugins with full npm ecosystem access
- Developer experience prioritized: simple by default, security opt-in

## Goals / Non-Goals

**Goals:**
- Flexible plugin runtime with multiple isolation levels (process, container)
- TypeScript SDK for plugin authors with type-safe action definitions
- Plugin manifest validation for metadata and capability declarations
- Integration with existing worker pool for task dispatch
- Plugin lifecycle management (load, execute, cleanup)
- Optional sandboxing via Docker for security-sensitive environments

**Non-Goals:**
- Plugin registry/distribution (future milestone)
- Plugin versioning and dependency resolution
- Hot-reload of plugins during execution
- Multi-language plugin support (only TypeScript in v1)
- GUI for plugin management
- Plugin-to-plugin communication (v1 - future enhancement)
- WASM-based sandboxing (abandoned - too restrictive for npm ecosystem)
- Connection pooling for database plugins (keep it simple: connect/disconnect per action)

## Decisions

### 1. Plugin Runtime: Child Process + Docker Hybrid

**Decision:** Use child processes (Bun.spawn) by default, with optional Docker isolation for restricted mode.

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    PluginExecutor                       │
│                                                         │
│   interface PluginRuntime {                             │
│     execute(plugin, input): Promise<output>             │
│   }                                                     │
│                        │                                │
│        ┌───────────────┴───────────────┐               │
│        ▼                               ▼               │
│   ┌──────────────┐            ┌──────────────┐        │
│   │ProcessRuntime│            │ DockerRuntime│        │
│   │  (trusted)   │            │ (restricted) │        │
│   └──────────────┘            └──────────────┘        │
└─────────────────────────────────────────────────────────┘
```

**Rationale:**
- Plugins can use any npm package without restrictions
- Child process provides crash isolation and timeout enforcement
- Docker provides full network/filesystem isolation when needed
- No host functions explosion - plugins use their own dependencies
- Developer-friendly: works out of the box, security is opt-in

**Alternatives considered:**
- **WASM (Extism)**: Strong isolation but npm packages don't work, requires host functions for everything
- **Bun Workers**: Too weak isolation (same process), shared memory risks
- **Linux namespaces (unshare)**: Good but Linux-only, complex to implement
- **Firecracker microVMs**: Overkill, high operational complexity

### 2. Plugin SDK Architecture: Action-Based with Context

**Decision:** SDK provides typed action handlers that receive a context object with utilities.

```typescript
// Plugin author interface
import { defineAction } from '@autokestra/plugin-sdk'

export default defineAction({
  async execute(input: TInput, context: PluginContext): Promise<TOutput> {
    // Use any npm package directly
    const { Client } = await import('pg')
    const client = new Client(input.connectionUrl)
    await client.connect()
    const result = await client.query(input.sql)
    await client.end()
    return result.rows
  }
})

export interface PluginContext {
  log: Logger;           // Structured logging
  secrets: SecretReader; // Injected secrets from task config
}
```

**Rationale:**
- Plugins use npm packages directly (axios, pg, ioredis, etc.)
- No host functions - plugins have full JavaScript capabilities
- Context provides only utilities (logging, secrets)
- Type safety for plugin authors
- Easy to test plugins in isolation

**Alternatives considered:**
- **Host functions for everything**: Too restrictive, npm packages don't work
- **Global imports**: Less explicit, harder to provide utilities

### 3. Permission Model: Trusted by Default, Restricted Opt-in

**Decision:** Two execution modes - trusted (default) and restricted (opt-in).

**Mode Trusted (default):**
- No permissions to declare
- Plugins run with full access (network, filesystem, env)
- Simple and fast for development and trusted environments
- Uses ProcessRuntime (child process)

**Mode Restricted (opt-in via workflow or config):**
- Permissions declared in workflow, enforced by Docker isolation
- Full network isolation with `--network=none`
- Filesystem isolation with explicit volume mounts
- Uses DockerRuntime

```yaml
# workflow.yaml - Trusted mode (default, no permissions needed)
name: my-workflow
tasks:
  - type: postgres.query
    config:
      url: ${DATABASE_URL}
      sql: "SELECT * FROM users"

---
# workflow.yaml - Restricted mode (opt-in)
name: secure-workflow
security: restricted

permissions:
  network:
    - "https://api.github.com/*"
  filesystem:
    read: ["/data/input"]
    write: ["/data/output"]

tasks:
  - type: http.get
    config:
      url: https://api.github.com/repos
```

**Plugin manifest capabilities (informative, not enforced by default):**
```yaml
# plugin.yaml
name: postgresql
version: 1.0.0
description: PostgreSQL database operations

# Informative only - describes what the plugin uses
capabilities:
  - postgres
  - network

actions:
  - name: query
    description: Execute a SQL query
```

**Rationale:**
- Developer experience: works out of the box without boilerplate
- Security when needed: opt-in for production/sensitive environments
- Plugin authors don't need to know URLs in advance (e.g., self-hosted databases)
- Core plugins (http, fs, postgres) work for any target without restrictions

### 4. Plugin Structure: TypeScript Package

**Decision:** Plugins are standard TypeScript/JavaScript packages with a manifest.

**Plugin structure:**
```
plugins/postgresql/
├── plugin.yaml          # Manifest with metadata and actions
├── package.json         # npm dependencies (pg, etc.)
├── src/
│   ├── query.ts         # Action implementation
│   └── index.ts         # Action exports
└── dist/                # Compiled JavaScript
```

**Rationale:**
- Standard npm package structure familiar to developers
- Use any npm dependencies without restrictions
- No compilation to WASM - just TypeScript → JavaScript
- Easy to develop, test, and debug

### 5. Plugin Loading: On-Demand Resolution

**Decision:** Plugins resolved and loaded on first task execution.

**Lifecycle:**
1. Task dispatched with `type: namespace/plugin.action`
2. Resolve plugin path from registry/local path
3. Validate manifest
4. Spawn child process or Docker container (based on mode)
5. Execute action, stream input/output via stdio
6. Terminate process after action completes

**Rationale:**
- Simple lifecycle: no caching complexity
- Each execution is isolated (no state leakage)
- Crash in one action doesn't affect others

### 6. Package Structure

**Decision:** Two new packages:
- `packages/plugin-sdk`: Published for plugin authors
- `packages/plugin-runtime`: Internal, handles plugin execution

**plugin-runtime architecture:**
```typescript
interface PluginRuntime {
  execute(plugin: PluginInfo, input: unknown): Promise<unknown>
}

class ProcessRuntime implements PluginRuntime {
  // Bun.spawn() - trusted mode
}

class DockerRuntime implements PluginRuntime {
  // docker run --network=none - restricted mode
}
```

**Rationale:**
- Clear separation of concerns
- SDK can be versioned independently for ecosystem stability
- Runtime implementation details hidden from plugin authors
- Easy to add new runtimes (Podman, Firecracker) later

### 7. Database Plugins: Stateless Actions

**Decision:** Database plugins (PostgreSQL, MongoDB, Redis, etc.) connect and disconnect for each action.

**Example:**
```typescript
// plugins/postgresql/src/query.ts
export default defineAction({
  async execute(input, context) {
    const client = new Client(input.url)
    await client.connect()
    try {
      const result = await client.query(input.sql, input.params)
      return { rows: result.rows }
    } finally {
      await client.end()
    }
  }
})
```

**Rationale:**
- Simple to implement and understand
- No connection pool management complexity
- Each action is fully isolated
- For transactions, use a single action with multiple queries

**Trade-off:** Slight overhead per action, but acceptable for workflow use cases

## Risks / Trade-offs

**[Risk] Child process spawn overhead**
→ Mitigation: ~50ms overhead is acceptable for task-level granularity. Can optimize with process pooling if needed later.

**[Risk] Docker not available in all environments**
→ Mitigation: Docker is optional (restricted mode only). Trusted mode works everywhere.

**[Risk] Malicious plugins in trusted mode**
→ Mitigation: Trusted mode is for development and trusted environments. Use restricted mode for untrusted plugins.

**[Trade-off] No connection pooling for database plugins**
→ Simplifies implementation significantly. Acceptable overhead for workflow use cases where tasks run sequentially.

**[Trade-off] Permissions not enforced by default**
→ Developer experience over security by default. Security available via opt-in restricted mode.

**[Trade-off] No plugin-to-plugin calls in v1**
→ Simplifies architecture significantly. Can add later if needed.

**[Trade-off] TypeScript-only plugins**
→ Covers primary use case. Other languages can be added later.

## Resolved Questions

### Plugin Resolution: Configurable Paths

**Decision:** Plugin names resolve via configurable search paths.

```yaml
# config.yaml
plugins:
  paths:
    - ./plugins              # Project-local plugins
    - ~/.autokestra/plugins  # User global plugins
```

Resolution order: search each path for a directory matching the plugin name.
- `type: postgresql.query` → looks for `postgresql/` directory in each path
- First match wins

### Execution Timeout: 30s Default, Configurable

**Decision:** Default timeout is 30 seconds, configurable per-task and globally.

```yaml
# config.yaml (global default)
plugins:
  defaultTimeout: 60s

# workflow.yaml (per-task override)
tasks:
  - type: ml.inference
    timeout: 5m    # Override for long-running tasks
```

### Secret/Variable Injection: Via Inputs with Template Syntax

**Decision:** Secrets and variables are injected via task inputs using template syntax. The engine resolves templates before passing inputs to plugins.

```yaml
tasks:
  - type: postgres.query
    inputs:
      connectionUrl: {{ secrets.DATABASE_URL }}
      query: "SELECT * FROM users WHERE org = '{{ vars.orgId }}'"
```

**Template namespaces:**
- `{{ secrets.KEY }}` - from secret store (Vault, env, etc.)
- `{{ vars.KEY }}` - from workflow variables
- `{{ env.KEY }}` - from engine environment
- `{{ tasks.taskId.output.field }}` - from another task's output

**Rationale:**
- No environment variable pollution or naming conflicts
- Plugin receives plain inputs, doesn't know about secrets
- Explicit data flow, easy to audit
- Works with any npm package (no special handling needed)

### Docker Image Building: Auto-generated with Custom Override

**Decision:** Autokestra generates a standard Dockerfile by default. If a custom Dockerfile exists in the plugin directory, it is used instead.

```bash
$ workflow plugin build postgresql
# If plugins/postgresql/Dockerfile exists → use it
# Otherwise → generate standard Dockerfile:
#   FROM oven/bun:1.0
#   COPY . /plugin
#   WORKDIR /plugin
#   RUN bun install
#   CMD ["bun", "run", "index.ts"]
```

**Rationale:**
- Simple by default (90% of plugins need no custom Dockerfile)
- Flexible when needed (custom dependencies, multi-stage builds)
