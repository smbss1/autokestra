# Autokestra

A self-hosted, lightweight, secure, and extensible workflow engine inspired by Kestra and n8n.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (latest version recommended)

### Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd autokestra
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Run quality checks:
   ```bash
   bun run lint
   bun run format
   bun run test
   ```

4. Build all packages:
   ```bash
   bun run build
   ```

## Configuration

Autokestra can be configured via a YAML file and environment variables.

### Configuration File

Create a `config.yaml` file based on the [example](config.example.yaml):

```yaml
server:
  port: 7233

storage:
  type: sqlite
  path: ./data/db.sqlite

execution:
  maxConcurrentWorkflows: 10
  maxConcurrentTasks: 50
```

### Environment Variables

All configuration values can be overridden with environment variables using the `WORKFLOW_` prefix:

- `WORKFLOW_SERVER_PORT` - Server port
- `WORKFLOW_SERVER_HOST` - Server host
- `WORKFLOW_STORAGE_TYPE` - Storage type ("sqlite" or "postgresql")
- `WORKFLOW_STORAGE_PATH` - SQLite database path
- `WORKFLOW_STORAGE_HOST` - PostgreSQL host
- `WORKFLOW_STORAGE_PORT` - PostgreSQL port
- `WORKFLOW_STORAGE_DATABASE` - PostgreSQL database name
- `WORKFLOW_STORAGE_USERNAME` - PostgreSQL username
- `WORKFLOW_STORAGE_PASSWORD` - PostgreSQL password
- `WORKFLOW_EXECUTION_MAX_CONCURRENT_WORKFLOWS` - Max concurrent workflows
- `WORKFLOW_EXECUTION_MAX_CONCURRENT_TASKS` - Max concurrent tasks
- `WORKFLOW_EXECUTION_DEFAULT_TIMEOUT_SECONDS` - Default task timeout

Environment variables take precedence over the YAML file.