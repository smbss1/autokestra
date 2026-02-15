## Why

Plugin distribution is currently local-first and expects source-style plugin folders, which does not scale for disk usage and reproducible installs. We need a registry-based install flow that distributes built artifacts with immutable versions, checksum verification, and a declared runtime entrypoint so plugins can run without per-plugin `node_modules`.

## What Changes

- Add plugin registry installation flows for official HTTP registry, GitHub release/repository sources, and direct URL sources.
- Add CLI lifecycle commands for remote plugin management: `workflow plugin install`, `workflow plugin list`, and `workflow plugin remove`.
- Define immutable plugin distribution artifacts (build output bundle) with mandatory checksum verification and local cache.
- Add rollback-friendly local install layout that keeps previous installed versions for quick revert.
- Introduce declared runtime entrypoint support (e.g. `dist/index.js`) so runtime/CLI do not require source-style `index.ts`.

## Capabilities

### New Capabilities
- `plugin-registry-distribution`: Resolve, fetch, cache, and install immutable plugin artifacts from supported registry source types with reproducible behavior.

### Modified Capabilities
- `plugin-lifecycle-management`: Extend plugin lifecycle to include install/list/remove semantics and rollback-aware installed version handling.
- `plugin-manifest-schema`: Add declared runtime entrypoint metadata used by executor/CLI to launch built plugin artifacts.

## Impact

- Affected packages: `packages/cli`, `packages/plugin-runtime`, `packages/engine` (plugin execution wiring), and plugin docs/examples.
- CLI surface adds install/remove and evolves list to return installed artifact metadata (source, version, checksum, active/rollback state).
- Runtime process execution changes from fixed `index.ts` assumption to manifest-declared entrypoint resolution with backward-compatible fallback.
- Distribution changes reduce disk usage by eliminating per-plugin `node_modules` in installed artifacts and relying on bundled build outputs.
