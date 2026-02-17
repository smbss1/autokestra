## Why

Autokestra n’a pas encore de plugins natifs pour orchestrer des conteneurs alors que beaucoup de workflows DevOps nécessitent des opérations Docker et Docker Compose. Ajouter ces plugins maintenant permet d’automatiser des cas d’usage CI/CD et d’exploitation sans scripts shell ad hoc.

## What Changes

- Add new plugin `core/docker` with actions for Docker CLI operations (MVP: image build and container run).
- Add new plugin `core/docker-compose` with actions for Compose lifecycle operations (MVP: up and down).
- Define stable input/output schemas and error model aligned with existing core plugins (`success`, `exitCode`, `stdout`, `stderr`, `durationMs`, `timedOut`).
- Require plugin implementation to consume `@autokestra/plugin-sdk` from npmjs package import (not workspace-internal relative contracts), with `plugin bash` style usage.
- Add examples/docs for workflow task usage of both plugins.

## Capabilities

### New Capabilities
- `docker-plugin`: Run Docker operations from workflows via `core/docker.*` actions with typed schemas and deterministic outputs.
- `docker-compose-plugin`: Run Docker Compose operations from workflows via `core/docker-compose.*` actions with typed schemas and deterministic outputs.

### Modified Capabilities
- `plugin-sdk-interface`: Clarify and require SDK consumption through npmjs package import (`@autokestra/plugin-sdk`) for plugin authoring, including built-in plugin examples.

## Impact

- Affected code: `plugins/` (new plugin folders), plugin manifests, plugin docs/examples, Docker image plugin inclusion list.
- Affected runtime behavior: workflow tasks can invoke Docker and Compose commands through dedicated core plugins.
- Dependencies/system: host environment must provide Docker engine and Compose CLI plugin or compatible command.
