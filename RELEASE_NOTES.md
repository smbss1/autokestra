# Release Notes

## v0.1.0 - Bootstrap Foundations (Unreleased)

This release establishes the foundational architecture and developer experience for Autokestra.

### What's Included

- **Monorepo Structure**: Modular packages (engine, server, cli, plugin-sdk) with clear boundaries
- **Configuration System**: YAML config files with environment variable overrides and validation
- **CLI Skeleton**: Command tree (server/workflow/execution/plugin/config) with JSON output support and deterministic exit codes
- **Developer Tooling**: Bun scripts for build, test, lint, format; CI workflow; ESLint/Prettier config
- **TypeScript Setup**: Type-safe configuration interfaces and error handling

### What's Stubbed

- Workflow execution engine (DAG resolution, task scheduling, state management)
- Plugin runtime (WASM sandboxing, permissions model)
- HTTP API server endpoints
- Persistence layer (SQLite/PostgreSQL storage)
- Secrets management
- Advanced observability (logs, metrics, traces)

### Breaking Changes

None (initial release)

### Migration Guide

No migration needed from previous versions.