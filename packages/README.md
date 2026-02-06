# Module Boundaries

## Overview

The project is structured as a monorepo with the following packages:

- `packages/engine`: Core workflow execution logic, state management, DAG resolution
- `packages/server`: HTTP API layer, request handling, authentication stubs
- `packages/cli`: Command-line interface, user commands, output formatting
- `packages/plugin-sdk`: Types and utilities for plugin development

## Dependency Rules

- `engine` has no dependencies on other packages
- `server` depends on `engine` (for workflow logic)
- `cli` depends on `engine` and `server` (for full functionality)
- `plugin-sdk` has no dependencies (standalone SDK)

No circular dependencies allowed. All inter-package communication through well-defined interfaces.