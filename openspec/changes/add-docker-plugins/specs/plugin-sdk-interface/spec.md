## ADDED Requirements

### Requirement: Plugin SDK npm package usage for core plugins
Core plugins MUST implement runtime entrypoints using `@autokestra/plugin-sdk` imported as an npm package dependency.

#### Scenario: Core plugin imports SDK from npm package
- **WHEN** a core plugin entrypoint is implemented
- **THEN** it imports `definePlugin`, `defineAction`, and process bootstrap helpers from `@autokestra/plugin-sdk`

#### Scenario: Docker plugins follow bash SDK usage pattern
- **WHEN** `core/docker` and `core/docker-compose` plugins are implemented
- **THEN** their entrypoints follow the same SDK usage pattern as `core/bash` (plugin declaration plus process bootstrap) and do not use workspace-internal substitute imports

#### Scenario: Plugin package declares SDK dependency
- **WHEN** a core plugin package manifest is defined
- **THEN** `@autokestra/plugin-sdk` is declared in dependencies with a versioned npm package reference
