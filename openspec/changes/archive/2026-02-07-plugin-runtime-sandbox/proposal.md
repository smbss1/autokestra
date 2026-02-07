## Why

The workflow engine requires a secure, isolated plugin execution environment to run untrusted third-party code without compromising system security. WASM sandboxing is the foundational capability that enables the zero-trust plugin model, preventing malicious plugins from accessing the host filesystem, network, or secrets without explicit permission grants.

## What Changes

- Introduce WASM-based plugin runtime using Extism (built on Wasmtime) for sandboxed execution
- Create Plugin SDK v1 (`@autokestra/plugin-sdk`) for TypeScript plugin development
- Define plugin manifest schema (`plugin.yaml`) for metadata, actions, and permissions
- Implement permission enforcement layer for network, filesystem, and environment access
- Add plugin lifecycle management (load, execute, unload) with resource limits
- Integrate plugin runtime with the existing worker pool for task execution

## Capabilities

### New Capabilities

- `plugin-manifest-schema`: Defines the structure and validation of plugin.yaml manifest files including metadata, actions, input/output schemas, and permission declarations
- `wasm-sandbox-runtime`: WASM execution environment using Extism, providing memory isolation, resource limits, and host function bindings
- `plugin-permission-model`: Permission system for network allowlists, virtualized filesystem, environment variable access, and plugin-to-plugin communication
- `plugin-sdk-interface`: TypeScript SDK interface for plugin authors including action handlers, context APIs, and type-safe input/output handling
- `plugin-lifecycle-management`: Plugin loading, caching, execution, and cleanup with proper error handling and resource cleanup

### Modified Capabilities

(none - this is a new subsystem)

## Impact

- **New packages**: `packages/plugin-sdk` (SDK for plugin authors), `packages/plugin-runtime` (WASM execution layer)
- **Dependencies**: Add `extism` (WASM runtime), `@aspect-build/aspect-wasm` or `bun-ffi` for WASM bindings
- **Engine integration**: Worker pool must delegate task execution to plugin runtime when task type references a plugin
- **CLI commands**: `workflow plugin init|build|install|list|remove` will depend on these capabilities
- **Build tooling**: Plugin build pipeline (TypeScript → WASM) using esbuild + wasm compilation
