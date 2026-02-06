
# Workflow Engine – Product Requirements Document (PRD)

## 1. Vision
Build a **self-hosted, lightweight, secure, extensible workflow engine** inspired by **Kestra** and **n8n**, designed for technical teams that want:
- Full self-hosting and control
- Strong security through sandboxed plugins
- High performance on modest hardware (2 CPU / 4 GB RAM)
- Excellent developer experience (YAML DSL + CLI)
- A sustainable plugin ecosystem (WASM + npm)

---

## 2. Target Users
- Backend / Fullstack developers
- Platform / DevOps engineers
- Automation engineers
- Tech teams replacing cron, scripts, and glue services

---

## 3. Non-Goals
- No GUI in v1
- No low-code drag-and-drop editor
- No managed SaaS offering
- No untrusted native code execution

---

## 4. Core Principles
- **CLI-first**
- **Secure by default**
- **Deterministic executions**
- **Zero-trust plugins**
- **Observable and debuggable**
- **Extensible without recompiling core**

---

## 5. Technical Stack (Chosen)

### 5.1 Core Engine
- **Language:** TypeScript
- **Runtime:** Bun
- **HTTP server:** Bun native / Hono
- **CLI:** TypeScript (Commander / Cliffy)
- **YAML parsing:** `yaml`
- **Persistence:** SQLite (default), PostgreSQL (production)

### 5.2 Plugin System
- **Sandbox:** WebAssembly (WASM)
- **Plugin language:** TypeScript (compiled to WASM)
- **Bundling:** esbuild
- **WASM runtime:** Wasmtime / Wasmer
- **Plugin SDK:** `@workflow/plugin-sdk`

### 5.3 Supported Platforms
- Linux (x64, arm64)
- macOS (dev)
- Docker (official image)

---

## 6. Architecture (Chosen)

### 6.1 High-Level Architecture (Monolith Modulaire)

```
CLI
 │
 ▼
Engine Server
 ├─ API
 ├─ Workflow Registry
 ├─ Scheduler
 ├─ Execution Engine
 ├─ Worker Pool
 ├─ Plugin Runtime (WASM)
 ├─ Secrets Manager
 └─ State Store
```

This architecture is intentionally monolithic but **strictly modular**, allowing future separation into workers or distributed nodes.

---

### 6.2 Execution Flow
1. Trigger fires
2. Workflow execution instance is created
3. Scheduler resolves runnable tasks (DAG)
4. Tasks are dispatched to workers
5. Plugins execute in isolated WASM runtimes
6. Outputs are persisted
7. Next tasks are scheduled
8. Execution completes or fails deterministically

---

## 7. Workflow DSL (YAML)

### 7.1 Design Goals
- Human-readable
- Deterministic
- Strongly validated
- DAG-oriented
- Plugin-driven

---

### 7.2 Example 1 – Simple Cron Workflow

```yaml
id: daily_sync
enabled: true

trigger:
  cron: "0 2 * * *"

tasks:
  fetch:
    type: core/http.get
    inputs:
      url: https://api.example.com/data

  save:
    type: core/db.insert
    needs: [fetch]
    inputs:
      table: items
      data: "{{ tasks.fetch.output }}"
```

---

### 7.3 Example 2 – Webhook Trigger

```yaml
id: webhook_pipeline

trigger:
  webhook:
    path: /ingest
    method: POST

tasks:
  notify:
    type: community/slack.send
    inputs:
      channel: alerts
      message: "New payload received"
```

---

### 7.4 Example 3 – Retry & Backoff

```yaml
tasks:
  charge:
    type: payments/stripe.charge
    retry:
      max: 3
      backoff: exponential
```

---

### 7.5 Example 4 – Code-Oriented Task

```yaml
tasks:
  enrich:
    type: core/code
    language: ts
    source: |
      export default (data) => {
        return data.map(x => ({ ...x, ts: Date.now() }));
      }
```

---

## 8. Plugin System

### 8.1 Plugin Manifest
Plugins ship with a `plugin.yaml` defining:
- Metadata (name, version, author)
- Runtime requirements
- Actions and schemas
- Permission declarations

### 8.2 Permissions Model
- Network (allowlist)
- Filesystem (virtualized)
- Environment variables (explicit)
- Plugin-to-plugin calls (controlled)

Plugins have **no permissions by default**.

---

## 9. CLI Specification

### 9.1 Command Tree

```
workflow
├─ server start|stop|status
├─ workflow apply|delete|enable|disable|list|describe
├─ execution list|logs|inspect|cancel
├─ plugin init|build|install|list|remove
└─ config set
```

### 9.2 CLI Requirements
- Scriptable
- JSON output option
- Deterministic exit codes

---

## 10. Configuration

### 10.1 Server Configuration (YAML)

```yaml
server:
  port: 7233

storage:
  type: sqlite
  path: ./data/db.sqlite

execution:
  maxConcurrentWorkflows: 10
  maxConcurrentTasks: 50
```

All settings can be overridden via environment variables.

---

## 11. Worker Pool & Execution State

### 11.1 Execution States
- PENDING
- RUNNING
- WAITING
- SUCCESS
- FAILED
- CANCELLED

### 11.2 Guarantees
- Crash-safe execution
- Retryable tasks
- Resume after restart
- Idempotent transitions

---

## 12. Secrets Management

### 12.1 Principles
- No secrets in workflow YAML
- Runtime injection only
- Strict scoping

### 12.2 Providers
- Local encrypted store (v1)
- Environment variables
- External vault (future)

---

## 13. Plugin Registry

### 13.1 Registry Types
- Official HTTP registry
- GitHub repositories
- Direct URL install

### 13.2 Guarantees
- Immutable versions
- Checksums validation
- Optional signatures

---

## 14. Security & Threat Model

### 14.1 Threats
- Malicious plugins
- SSRF
- Secret leakage
- Supply chain attacks
- YAML injection

### 14.2 Mitigations
- WASM sandbox
- Permission enforcement
- No arbitrary eval
- Strict validation
- Audit logs

---

## 15. Roadmap

### v0.1
- Core engine
- CLI
- YAML workflows
- WASM plugins
- SQLite

### v0.2
- Plugin registry
- PostgreSQL
- Webhooks
- Retry policies

### v1.0
- Stability
- Backward compatibility
- Community plugins
- Production hardening

---

## 16. Success Criteria
- Stable execution under load
- Secure plugin isolation
- Clear CLI UX
- Community adoption
- Low operational overhead

---

**Status:** Draft  
**Owner:** Core Platform  
**Last Updated:** 2026-02-06
