## MODIFIED Requirements

### Requirement: Plugin metadata fields
The manifest MUST include the following metadata fields:
- `name`: kebab-case identifier (e.g., `http-client`)
- `version`: semver string (e.g., `1.0.0`)
- `namespace`: plugin namespace for grouping (e.g., `core`, `community`)
- `description`: human-readable description (optional)
- `author`: author name or organization (optional)
- `license`: SPDX license identifier (optional)
- `runtime.entrypoint`: runtime entrypoint path relative to plugin root for built artifacts (required for registry-distributed artifacts in v0.2)

#### Scenario: Valid plugin identifier format
- **WHEN** a task references `type: core/http.get`
- **THEN** the runtime resolves namespace=`core`, plugin=`http`, action=`get`

#### Scenario: Invalid name format
- **WHEN** plugin.yaml contains `name: "HTTP Client"` (not kebab-case)
- **THEN** manifest validation fails with "name must be kebab-case"

#### Scenario: Declared runtime entrypoint
- **WHEN** plugin.yaml contains `runtime.entrypoint: dist/index.js`
- **THEN** runtime uses `dist/index.js` as plugin process entrypoint

#### Scenario: Invalid runtime entrypoint format
- **WHEN** plugin.yaml contains empty or absolute `runtime.entrypoint`
- **THEN** manifest validation fails with explicit entrypoint format error

#### Scenario: Missing entrypoint in registry artifact
- **WHEN** a registry-distributed plugin manifest omits `runtime.entrypoint`
- **THEN** install fails with an error indicating `runtime.entrypoint` is required for registry artifacts

#### Scenario: Missing entrypoint in legacy local plugin
- **WHEN** a locally discovered legacy plugin manifest omits `runtime.entrypoint`
- **THEN** runtime keeps backward-compatible `index.ts` fallback behavior
