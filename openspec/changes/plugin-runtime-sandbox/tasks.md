## 1. Package Structure & Dependencies

- [x] 1.1 Create `packages/plugin-runtime` directory with `package.json` and `tsconfig.json`
- [x] 1.2 Create `packages/plugin-sdk` directory with `package.json` and `tsconfig.json`
- [x] 1.3 Add runtime selection abstractions (`ProcessRuntime`, `DockerRuntime`) to `plugin-runtime`
- [x] 1.4 Configure `plugin-runtime` exports in `index.ts`
- [x] 1.5 Configure `plugin-sdk` exports in `index.ts`

## 2. Plugin Manifest & Discovery

- [x] 2.1 Define TypeScript types for plugin manifest (`PluginManifest`, `ActionDef`, `Capabilities`)
- [x] 2.2 Create JSON Schema for `plugin.yaml` validation
- [x] 2.3 Implement manifest parser with YAML loading and descriptive errors
- [x] 2.4 Implement plugin resolution using configurable `plugins.paths` (project-local, user-global)
- [x] 2.5 Add tests for manifest parsing and resolution

## 3. Permission Model & Secrets

- [x] 3.1 Document workflow-level permission model (trusted vs restricted)
- [x] 3.2 Implement workflow permission parsing and validation
- [x] 3.3 Implement secret/variable template resolution for task `inputs` ({{ secrets.KEY }}, {{ vars.KEY }})
- [x] 3.4 Add tests covering secret resolution and template edge-cases

## 4. Process & Container Runtimes

- [x] 4.1 Implement `ProcessRuntime` that spawns plugins via `Bun.spawn()` (trusted mode)
- [x] 4.2 Implement `DockerRuntime` that runs plugins in containers with `--network=none` and explicit volume mounts (restricted mode)
- [x] 4.3 Implement timeout and kill behavior for runtimes (default 30s, configurable)
- [x] 4.4 Implement environment/inputs passing (stdin JSON for inputs, env for configured vars)
- [x] 4.5 Add unit tests for runtime execution, timeouts, and error cases

## 5. Plugin SDK - Core Interface

- [x] 5.1 Define `defineAction()` helper and `PluginContext` (logging, secrets via inputs)
- [x] 5.2 Provide examples showing how to read inputs and return outputs
- [x] 5.3 Add tests for SDK usage and type definitions

## 6. Plugin Lifecycle & Manager

- [x] 6.1 Implement `PluginManager` to resolve, validate, and prepare plugin invocations
- [x] 6.2 Implement on-demand plugin invocation (no long-lived caching by default)
- [x] 6.3 Implement optional process pooling later as optimization (spike)
- [x] 6.4 Add tests for plugin resolution and lifecycle

## 7. Plugin Executor

- [x] 7.1 Implement `PluginExecutor` to marshal inputs → runtime → outputs
- [x] 7.2 Convert plugin errors and non-zero exits into engine task failures
- [x] 7.3 Collect execution metrics (duration, exit code, memory if available)
- [x] 7.4 Add tests for invocation success and failure paths

## 8. Worker Pool Integration

- [x] 8.1 Extend worker pool to detect plugin task types (`namespace/plugin.action`)
- [x] 8.2 Route plugin tasks to `PluginExecutor`
- [x] 8.3 Resolve templates for inputs and pass secrets via inputs
- [x] 8.4 Capture plugin outputs and wire to workflow outputs
- [x] 8.5 Add integration tests for end-to-end plugin task execution

## 9. Docker Image Tooling

- [x] 9.1 Implement `workflow plugin build <name>` which auto-generates a Dockerfile if none exists
- [x] 9.2 Use plugin directory Dockerfile if present (custom override)
- [x] 9.3 Document image build and runtime expectations
- [x] 9.4 Add tests for build command (unit test that Dockerfile is produced)

## 10. CLI Plugin Commands

- [x] 10.1 Implement `workflow plugin list` command
- [x] 10.2 Implement `workflow plugin inspect <plugin>` command showing capabilities and recommended permissions
- [x] 10.3 Add security warning for overly broad `security: restricted` permissions
- [x] 10.4 Add tests for CLI commands

## 11. Documentation

- [x] 11.1 Document `plugin.yaml` manifest format and capabilities
- [x] 11.2 Document SDK usage with examples and recommended patterns (secrets via inputs)
- [x] 11.3 Document permission model, trusted vs restricted, and how to enable restricted mode
- [x] 11.4 Document Docker build behavior and custom Dockerfile override

## 12. Examples & Tests

- [x] 12.1 Create example HTTP plugin using the SDK
- [x] 12.2 Add `plugin.yaml` manifest for example plugin
- [x] 12.3 Add build script for example plugin
- [x] 12.4 Add integration test using example plugin (process mode + restricted mode)
