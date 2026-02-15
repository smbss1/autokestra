## MODIFIED Requirements

### Requirement: Action handler interface

The SDK MUST provide a typed interface for defining plugin actions and deterministic action dispatch metadata for process execution.

#### Scenario: Define typed action with explicit identifier
- **WHEN** a plugin author defines an action with input type `{ url: string }` and output type `{ data: any }`
- **THEN** the SDK preserves TypeScript type checking and associates the handler with a stable action identifier used for process dispatch

#### Scenario: Action receives typed input from process envelope
- **WHEN** an action is invoked from payload `{ action: "fetch", input: { url: "https://example.com" } }`
- **THEN** the selected action handler receives typed input with the declared TypeScript contract

### Requirement: Plugin definition export

The SDK MUST provide a way to export plugin definition including metadata, action registry, and runtime bootstrap metadata for the build process.

#### Scenario: Define complete plugin
- **WHEN** plugin author uses `definePlugin({ name, version, namespace, actions })`
- **THEN** build and tooling can extract metadata and generate or validate `plugin.yaml` without manual duplication

#### Scenario: Process bootstrap helper
- **WHEN** plugin author uses SDK bootstrap helper for process mode
- **THEN** the helper reads stdin payload, dispatches by action name, and emits JSON result on stdout while preserving stderr for logs
