# First Plugin Guide (CLI-first)

This guide shows the canonical path to create and run your first plugin end-to-end:

1. Scaffold plugin
2. Run local dev loop
3. Validate manifest + process contract
4. Execute through workflow runtime

## Prerequisites

- Bun installed
- Dependencies installed from repo root:
  - `bun install`

## 1) Scaffold a plugin

From repo root:

- `bun packages/cli/src/cli.ts plugin init hello-plugin --namespace core --dir ./plugins`

Generated files:

- `plugins/hello-plugin/plugin.yaml`
- `plugins/hello-plugin/index.ts`
- `plugins/hello-plugin/package.json`

JSON output (script-friendly):

- `bun packages/cli/src/cli.ts plugin init hello-plugin --json`

## 2) Prepare a fixture input

Create an input fixture:

- `cat > /tmp/hello-input.json <<'JSON'`
- `{ "message": "hello from dev loop" }`
- `JSON`

## 3) Run local dev loop

Single run:

- `bun packages/cli/src/cli.ts plugin dev ./plugins/hello-plugin --action run --input /tmp/hello-input.json --json`

Watch mode:

- `bun packages/cli/src/cli.ts plugin dev ./plugins/hello-plugin --action run --input /tmp/hello-input.json --watch`

The command sends `{ action, input }` via stdin and expects JSON output on stdout.

## 4) Validate plugin preflight

- `bun packages/cli/src/cli.ts plugin validate ./plugins/hello-plugin --action run --input /tmp/hello-input.json --json`

Validation checks:

- Manifest schema validity (`plugin.yaml`)
- Runtime-compatible entrypoint (`index.ts` present)
- Action execution via process envelope
- JSON output contract on stdout

## 5) Execute through workflow runtime

Use task type format:

- `type: core/hello-plugin.run`

Then trigger workflow with standard commands:

- `workflow workflow apply <workflow.yaml>`
- `workflow workflow trigger <workflow-id> --follow`

## Troubleshooting

### Manifest validation errors

Symptoms:

- `Invalid manifest ...`

Checks:

- `name` is kebab-case
- `version` is semver (`x.y.z`)
- `namespace` exists
- `actions` contains at least one action with `name`, `description`, `input`, `output`

### Contract mismatch: invalid stdout JSON

Symptoms:

- `Invalid plugin output ... expected JSON on stdout`

Fix:

- Write logs to stderr, not stdout
- Ensure final action result is `process.stdout.write(JSON.stringify(result))`

### Unsupported action

Symptoms:

- `Unsupported action: <name>`

Fix:

- Ensure `--action` matches manifest action name exactly
- Ensure entrypoint dispatches known action names

### Non-zero exit code in dev/validate

Symptoms:

- `Action execution failed ...`

Fix:

- Inspect stderr logs printed by the plugin process
- Re-run with fixture input to isolate failing branch
