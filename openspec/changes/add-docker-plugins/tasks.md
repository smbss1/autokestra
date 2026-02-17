## 1. Plugin Scaffolding

- [ ] 1.1 Create `plugins/docker/` with `package.json`, `plugin.yaml`, `index.ts`, and core execution module.
- [ ] 1.2 Create `plugins/docker-compose/` with `package.json`, `plugin.yaml`, `index.ts`, and core execution module.
- [ ] 1.3 Declare `@autokestra/plugin-sdk` as npm dependency in both plugin package manifests, matching the `plugins/bash` usage pattern.

## 2. Docker Plugin Implementation (`core/docker`)

- [ ] 2.1 Define manifest actions `build` and `run` with strict input/output JSON schemas.
- [ ] 2.2 Implement input validation and command construction for `docker build` (context path + optional build options).
- [ ] 2.3 Implement input validation and command construction for `docker run` (image + command/args/env options) and reject host volume mappings for MVP.
- [ ] 2.4 Implement deterministic output mapping (`success`, `exitCode`, `stdout`, `stderr`, `durationMs`, `timedOut`) plus optional `invokedCommand`, and explicit error for missing Docker CLI.
- [ ] 2.5 Enforce trusted-mode-only execution guard for `core/docker.*` actions.

## 3. Docker Compose Plugin Implementation (`core/docker-compose`)

- [ ] 3.1 Define manifest actions `up` and `down` with strict input/output JSON schemas.
- [ ] 3.2 Implement compose command resolution order (`docker compose` first, `docker-compose` fallback) and execution with explicit `files: string[]` targeting support.
- [ ] 3.3 Implement deterministic output mapping (`success`, `exitCode`, `stdout`, `stderr`, `durationMs`, `timedOut`) plus optional `invokedCommand`, and explicit error for missing Compose support.
- [ ] 3.4 Enforce trusted-mode-only execution guard for `core/docker-compose.*` actions.

## 4. Tests and Validation

- [ ] 4.1 Add unit tests for docker plugin input validation and error classification.
- [ ] 4.2 Add unit tests for docker plugin rejection of host volume mapping inputs in MVP.
- [ ] 4.3 Add unit tests for docker-compose plugin input validation (`files` non-empty) and command resolution fallback behavior.
- [ ] 4.4 Add tests verifying timeout handling, trusted-mode guard, and deterministic output shape (including optional `invokedCommand`) for both plugins.

## 5. Integration and Documentation

- [ ] 5.1 Update core plugin image inclusion defaults/documentation to include `docker` and `docker-compose` where appropriate.
- [ ] 5.2 Add workflow examples demonstrating `core/docker.build`, `core/docker.run`, `core/docker-compose.up`, and `core/docker-compose.down`.
- [ ] 5.3 Document host prerequisites (Docker engine and Compose availability) and troubleshooting guidance.
- [ ] 5.4 Create a follow-up OpenSpec change to introduce explicit `docker-host-access` permission model if security policy requires restricted-mode support.
