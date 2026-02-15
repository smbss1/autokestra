# @autokestra/cli

This package provides the Autokestra CLI.

## Run (dev)

From the repo root:

- Run directly (no build needed):
  - `bun packages/cli/src/cli.ts --help`
  - `bun packages/cli/src/cli.ts server start -c ./config.example.yaml`

## Install a command (`workflow`, `autokestra`, or `cli`)

This repo’s CLI package exposes these bin names:
- `workflow`
- `autokestra`
- `cli`

A common workflow during development is to use a link-style install:

- `cd packages/cli`
- `bun link`

After that, you should be able to run:
- `workflow --help`
- `workflow server start -c ./config.example.yaml`

## Build a standalone executable (optional)

If you want a single-file executable (so you can run `./dist/autokestra ...`):

- `cd packages/cli`
- `bun run build:exe`

Output:
- `packages/cli/dist/autokestra`

Notes / trade-offs:
- The binary is OS/arch-specific (build on Linux for Linux, etc.).
- It increases build time and artifact size, but removes the need to have Bun installed on target machines.

## Plugin Authoring Commands

The CLI provides local plugin DX commands:

- `workflow plugin init <name> [--namespace <ns>] [--dir <path>] [--json]`
- `workflow plugin validate <pluginPath> [--action <name>] [--input <json-file>] [--json]`
- `workflow plugin dev <pluginPath> --action <name> [--input <json-file>] [--watch] [--json]`

Examples:

- `workflow plugin init hello-plugin --namespace core --dir ./plugins`
- `workflow plugin validate ./plugins/hello-plugin --action run --input /tmp/input.json --json`
- `workflow plugin dev ./plugins/hello-plugin --action run --input /tmp/input.json --watch`

For full end-to-end onboarding and troubleshooting, see:

- `docs/plugin-first-plugin.md`
