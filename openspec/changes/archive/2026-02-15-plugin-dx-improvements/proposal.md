## Why

Creating a new plugin currently requires too much manual setup (entrypoint protocol, manifest, local test harness), which slows onboarding and increases runtime-only failures. Improving plugin developer experience now will accelerate delivery of core and community plugins while preserving the existing secure out-of-process execution model.

## What Changes

- Add a first-class plugin authoring workflow in CLI for scaffolding and local validation.
- Introduce a local plugin dev loop command to execute plugin actions quickly with fixture inputs using the same stdin/stdout contract as runtime.
- Expand SDK ergonomics with explicit plugin/action definition helpers and standardized process bootstrap utilities.
- Add deterministic preflight checks for plugin manifest and action contract before runtime execution.
- Improve documentation with a single end-to-end “first plugin” path and troubleshooting guidance.

## Capabilities

### New Capabilities
- `plugin-cli-scaffolding`: Generate plugin starter templates and project structure from CLI.
- `plugin-local-dev-loop`: Run plugin actions locally in a fast feedback loop against fixture payloads using runtime-compatible I/O.
- `plugin-preflight-validation`: Validate plugin manifest and action contract locally before server execution.
- `plugin-developer-onboarding`: Provide a canonical first-plugin guide and DX troubleshooting flow.

### Modified Capabilities
- `plugin-sdk-interface`: Add ergonomic authoring primitives (plugin definition and process bootstrap helpers) while preserving typed action handlers.
- `plugin-manifest-schema`: Tighten/clarify schema expectations used by local preflight validation and authoring templates.
- `plugin-lifecycle-management`: Clarify runtime/CLI integration points for authoring and validation workflows without changing process isolation guarantees.

## Impact

- Affected packages: `packages/cli`, `packages/plugin-sdk`, `packages/plugin-runtime`, and docs.
- New CLI surface for plugin authoring and local verification.
- Better alignment between SDK authoring patterns and runtime stdin/stdout execution contract.
- Reduced time-to-first-plugin and earlier detection of invalid manifests or contract mismatches.
