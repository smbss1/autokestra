## ADDED Requirements

### Requirement: CLI scaffold command for plugins

The CLI MUST provide a `workflow plugin init` command that generates a runnable plugin starter with deterministic file layout and defaults.

#### Scenario: Generate default plugin scaffold
- **WHEN** a user runs `workflow plugin init my-plugin`
- **THEN** the CLI creates a plugin directory with `plugin.yaml`, `index.ts`, and minimal project metadata required to run locally

#### Scenario: Generate scaffold with explicit namespace
- **WHEN** a user runs `workflow plugin init my-plugin --namespace community`
- **THEN** the generated `plugin.yaml` includes `namespace: community` and a valid action stub

### Requirement: Scaffold output is runtime-compatible

Generated plugin templates MUST follow the runtime process contract used by plugin execution.

#### Scenario: Generated entrypoint contract
- **WHEN** a generated plugin receives JSON on stdin in the shape `{ "action": "<name>", "input": <value> }`
- **THEN** it dispatches the action and writes valid JSON output to stdout

#### Scenario: Generated logging contract
- **WHEN** generated plugin code emits logs
- **THEN** logs are written in runtime-collectable form to stderr without corrupting stdout result payload
