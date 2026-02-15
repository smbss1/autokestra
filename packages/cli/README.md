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

## Plugin Distribution Commands (Registry Flow)

The CLI supports registry-style plugin lifecycle commands executed on the server (not on the CLI host):

- `workflow plugin install <source> [--checksum sha256:<hex>] [--registry <url>] [--server <url>] [--api-key <key>] [-c <config>] [--json]`
- `workflow plugin list [--server <url>] [--api-key <key>] [-c <config>] [--json]`
- `workflow plugin remove <namespace/name[@version]|name[@version]> [--no-rollback] [--server <url>] [--api-key <key>] [-c <config>] [--json]`

Supported install sources:

- Official registry reference: `namespace/name@version`
- GitHub release reference: `github:owner/repo@v1.2.3` (immutable tags only)
- Direct URL reference: `url:https://example.com/my-plugin-1.2.3.tgz` (checksum required)

Notes:

- Checksums use `sha256:<hex>` format.
- `install`, `list`, and `remove` call the server API (`/api/v1/plugins/*`) and run against server-side plugin storage.
- Removing an active version rolls back to previous version by default.
- Plugin install state keeps at least 2 versions per plugin (active + previous) for rollback.
