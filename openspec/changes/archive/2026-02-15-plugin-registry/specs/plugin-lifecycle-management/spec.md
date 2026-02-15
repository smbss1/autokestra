## MODIFIED Requirements

### Requirement: Plugin resolution
The runtime MUST resolve plugin references from task types to installed plugin artifacts. Resolution follows a defined search order and MUST support declared runtime entrypoints.

#### Scenario: Resolve installed plugin
- **WHEN** task references `community/slack.send`
- **THEN** runtime finds active installed plugin artifact for `community/slack`
- **AND** runtime loads plugin from the installed artifact path

#### Scenario: Resolve declared entrypoint
- **WHEN** installed plugin manifest declares `runtime.entrypoint: dist/index.js`
- **THEN** runtime and CLI execute that entrypoint path relative to plugin root

#### Scenario: Backward-compatible fallback entrypoint
- **WHEN** plugin manifest has no declared runtime entrypoint
- **THEN** runtime and CLI fallback to legacy `index.ts` entrypoint behavior

#### Scenario: Remove active version auto-rolls back by default
- **WHEN** user removes an active plugin version and a previous installed version exists
- **THEN** the system automatically activates the previous version

#### Scenario: Remove active version with rollback opt-out
- **WHEN** user removes an active plugin version with `--no-rollback`
- **THEN** the active version is removed without auto-activating a previous version

#### Scenario: Plugin not found
- **WHEN** task references `unknown/nonexistent.action`
- **THEN** task fails with "Plugin not found: unknown/nonexistent" error

#### Scenario: Action not found in plugin
- **WHEN** task references `core/http.nonexistent`
- **THEN** task fails with "Action 'nonexistent' not found in plugin 'core/http'"
