## ADDED Requirements

### Requirement: Plugin loading on demand

The runtime MUST load plugins on first task execution referencing the plugin. Plugins SHALL NOT be loaded at engine startup.

#### Scenario: First task triggers load
- **WHEN** first task with `type: core/http.get` is executed
- **THEN** the `core/http` plugin is loaded, manifest validated, and WASM instantiated

#### Scenario: Unused plugin not loaded
- **WHEN** engine runs workflows that don't use a particular plugin
- **THEN** that plugin is never loaded into memory

### Requirement: Plugin caching

The runtime MUST cache loaded plugin instances for reuse across task executions. Cache entries have configurable TTL.

#### Scenario: Plugin reuse across tasks
- **WHEN** multiple tasks use `core/http.get` in sequence
- **THEN** the same cached plugin instance is reused (WASM module, not state)

#### Scenario: Cache TTL expiration
- **WHEN** a cached plugin is not used for longer than TTL (default: 5 minutes)
- **THEN** the plugin instance is evicted and resources freed

#### Scenario: Cache size limit
- **WHEN** cache reaches maximum entries (configurable)
- **THEN** least recently used plugins are evicted first

### Requirement: Plugin resolution

The runtime MUST resolve plugin references from task types to plugin artifacts. Resolution follows a defined search order.

#### Scenario: Resolve installed plugin
- **WHEN** task references `community/slack.send`
- **THEN** runtime finds plugin at configured plugin directory (`plugins/community/slack/`)

#### Scenario: Plugin not found
- **WHEN** task references `unknown/nonexistent.action`
- **THEN** task fails with "Plugin not found: unknown/nonexistent" error

#### Scenario: Action not found in plugin
- **WHEN** task references `core/http.nonexistent`
- **THEN** task fails with "Action 'nonexistent' not found in plugin 'core/http'"

### Requirement: Plugin execution context

Each action invocation MUST receive a fresh execution context. Context state is not shared between invocations.

#### Scenario: Isolated context per invocation
- **WHEN** same action is called twice in sequence
- **THEN** each invocation receives a fresh context with no shared state

#### Scenario: Context includes execution metadata
- **WHEN** action runs
- **THEN** context includes executionId, taskId, and attempt number

### Requirement: Plugin error handling

The runtime MUST handle all plugin errors gracefully and convert them to task failures with appropriate error messages.

#### Scenario: Plugin throws error
- **WHEN** plugin action throws an error
- **THEN** task fails with error message extracted from the exception

#### Scenario: Plugin timeout
- **WHEN** plugin action exceeds timeout
- **THEN** task fails with timeout error and plugin instance is cleaned up

#### Scenario: Plugin crash
- **WHEN** plugin causes WASM trap
- **THEN** task fails with crash error and no resource leaks occur

### Requirement: Plugin unloading

The runtime MUST support explicit unloading of plugins and automatic cleanup on engine shutdown.

#### Scenario: Manual plugin unload
- **WHEN** admin calls unload for a specific plugin
- **THEN** cached instance is removed and WASM resources freed

#### Scenario: Engine shutdown cleanup
- **WHEN** engine shuts down
- **THEN** all cached plugin instances are unloaded and resources freed

### Requirement: Plugin health monitoring

The runtime MUST track plugin execution metrics for observability.

#### Scenario: Execution metrics
- **WHEN** plugin action completes
- **THEN** metrics are recorded: execution time, memory usage, success/failure

#### Scenario: Error rate tracking
- **WHEN** plugin has high error rate
- **THEN** metrics show error count and rate for alerting
