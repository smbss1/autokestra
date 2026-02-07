# Plugin Permission Model

## Overview

Autokestra supports two execution modes for plugins: **trusted** (default) and **restricted** (opt-in).

## Trusted Mode (Default)

- No permissions required in workflow
- Plugins run with full access (network, filesystem, environment)
- Simple and fast for development and trusted environments
- Uses ProcessRuntime (child process)

## Restricted Mode (Opt-in)

- Permissions declared in workflow, enforced by Docker isolation
- Full network isolation with `--network=none`
- Filesystem isolation with explicit volume mounts
- Uses DockerRuntime

### Workflow Configuration

```yaml
# Trusted mode (default)
name: my-workflow
tasks:
  - type: postgres.query
    config:
      url: ${DATABASE_URL}
      sql: "SELECT * FROM users"

---
# Restricted mode
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

### Plugin Manifest Capabilities

Capabilities are informative only in trusted mode:

```yaml
plugin.yaml
name: postgresql
version: 1.0.0
description: PostgreSQL database operations

capabilities:
  - postgres
  - network

actions:
  - name: query
    description: Execute a SQL query
```