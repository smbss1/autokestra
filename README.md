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

## Observability

Autokestra provides comprehensive observability features for monitoring workflow executions, debugging issues, and auditing system activity.

### Logging

- **Structured Logging**: All execution events are logged with structured data including execution ID, task ID, timestamp, and metadata
- **Multiple Log Levels**: DEBUG, INFO, WARN, ERROR levels for different verbosity needs
- **Plugin Log Capture**: Plugin stdout/stderr is automatically captured and correlated with executions
- **Log Retention**: Configurable retention policies automatically clean up old logs
- **Secret Masking**: Sensitive data in task inputs is automatically masked in logs

#### Log Levels

- **DEBUG**: Detailed diagnostic information for development/debugging
  - Use for: Internal state changes, detailed execution flow, performance metrics
  - Example: "Task queue size: 5", "Buffer flushed with 10 entries"

- **INFO**: General information about execution progress
  - Use for: Execution lifecycle events, task starts/completions, normal operations
  - Example: "Execution started", "Task completed successfully"

- **WARN**: Warning conditions that don't prevent execution
  - Use for: Deprecated features, performance issues, recoverable errors
  - Example: "Buffer overflow: flushing early", "Slow database query detected"

- **ERROR**: Error conditions that may affect execution
  - Use for: Failed operations, invalid inputs, system errors
  - Example: "Database connection failed", "Plugin execution timeout"

### Audit Trail

- **Lifecycle Events**: Complete audit trail of execution lifecycle (created, started, completed, failed, cancelled, timeout)
- **State Changes**: All execution state transitions are recorded with timestamps
- **Immutable Records**: Audit events cannot be modified or deleted

#### Audit Events

| Event Type | Description | Metadata |
|------------|-------------|----------|
| `CREATED` | Execution was created | `workflowId`, `triggerType` |
| `STARTED` | Execution began running | - |
| `STATE_CHANGE` | Execution state changed | `from`, `to`, `reason` |
| `COMPLETED` | Execution finished successfully | `duration` |
| `FAILED` | Execution failed | `reason`, `message` |
| `CANCELLED` | Execution was cancelled | `reason` |
| `TIMEOUT` | Execution timed out | `duration` |

#### Use Cases

- **Compliance**: Track who triggered executions and when
- **Debugging**: Understand execution flow and state changes
- **Performance Analysis**: Measure execution durations and identify bottlenecks
- **Security**: Monitor for unusual execution patterns
- **Operational Monitoring**: Track system usage and success rates

## Troubleshooting

### Common Issues

#### Execution Not Starting
```bash
# Check execution state
workflow execution inspect exec-123

# View recent logs
workflow execution logs exec-123 --since 5m
```

#### Plugin Execution Failures
```bash
# Check plugin logs
workflow execution logs exec-123 --source plugin

# Inspect task details
workflow execution inspect exec-123 --with-logs
```

#### Database Performance Issues
```bash
# Check log buffer status (look for overflow warnings)
workflow execution logs exec-123 --level WARN --since 1h

# Monitor database size
ls -lh data/db.sqlite
```

#### High Memory Usage
- Reduce log buffer size: `logging.maxBufferSize: 50`
- Enable more aggressive log retention: `logRetentionDays: 7`
- Monitor with: `workflow execution logs --level WARN --grep buffer`

### Performance Tuning

#### Log Collection
- **Buffer Size**: Increase for high-throughput workloads
- **Flush Interval**: Decrease for real-time monitoring needs
- **Retention**: Shorter retention reduces storage but limits historical analysis

#### Database
- **WAL Mode**: Enabled by default for concurrent access
- **Indexes**: Automatic on execution_id, timestamp, level
- **Cleanup**: Run periodic cleanup to maintain performance

### Log Analysis Examples

```bash
# Find slow executions
workflow execution list --state SUCCESS --json | jq '.executions[] | select(.duration > 300000)'

# Count errors by task
workflow execution logs exec-123 --level ERROR --json | jq -r '.[] | .taskId' | sort | uniq -c

# Monitor plugin performance
workflow execution logs --source plugin --since 1h --json | jq '.[] | .metadata.duration' | awk '{sum+=$1} END {print sum/NR "ms average"}'
```

### CLI Commands

```bash
# List executions
workflow execution list --workflow my-workflow --state SUCCESS

# Inspect execution details
workflow execution inspect exec-123 --with-logs --with-audit

# View execution logs with filtering
workflow execution logs exec-123 --level ERROR --since 1h --task-id task-1

# Stream logs in real-time
workflow execution logs exec-123 --follow

# JSON output for scripting
workflow execution inspect exec-123 --json --pretty
```

### Configuration

```yaml
# Log retention (default: 30 days)
logRetentionDays: 30

# Log collection settings
logging:
  maxBufferSize: 100      # Max log entries to buffer before flush (default: 100)
  flushIntervalMs: 1000   # How often to flush buffered logs (default: 1000ms)

# Execution settings
execution:
  maxConcurrentWorkflows: 10
  maxConcurrentTasks: 50
  defaultTimeoutSeconds: 300
```

#### Environment Variables

- `WORKFLOW_LOG_RETENTION_DAYS` - Log retention period in days
- `WORKFLOW_LOGGING_MAX_BUFFER_SIZE` - Log buffer size
- `WORKFLOW_LOGGING_FLUSH_INTERVAL_MS` - Log flush interval

### Log Sources

- **scheduler**: Execution lifecycle events
- **worker**: Task execution events  
- **plugin:{executionId}/{taskId}**: Plugin-specific logs
### Log Sources

- **scheduler**: Execution lifecycle events
- **worker**: Task execution events  
- **plugin:{executionId}/{taskId}**: Plugin-specific logs
- **system**: Internal system events

## CLI Reference

### Execution Management

#### List Executions
```bash
# List all executions
workflow execution list

# Filter by workflow
workflow execution list --workflow my-workflow

# Filter by state
workflow execution list --state RUNNING

# Limit results
workflow execution list --limit 10 --offset 20

# JSON output
workflow execution list --json --pretty
```

#### Inspect Execution
```bash
# Basic execution info
workflow execution inspect exec-123

# Include logs and audit trail
workflow execution inspect exec-123 --with-logs --with-audit

# Limit log output
workflow execution inspect exec-123 --with-logs --logs-limit 50

# JSON output
workflow execution inspect exec-123 --json --pretty
```

#### View Logs
```bash
# View all logs for execution
workflow execution logs exec-123

# Filter by log level
workflow execution logs exec-123 --level ERROR WARN

# Filter by time (last 5 minutes, 2 hours, 1 day)
workflow execution logs exec-123 --since 5m
workflow execution logs exec-123 --since 2h
workflow execution logs exec-123 --since 1d

# Filter by task
workflow execution logs exec-123 --task-id task-1

# Filter by source
workflow execution logs exec-123 --source plugin

# Search logs containing pattern
workflow execution logs exec-123 --grep "error"

# Stream logs in real-time
workflow execution logs exec-123 --follow

# Limit results
workflow execution logs exec-123 --limit 100 --offset 50

# JSON output
workflow execution logs exec-123 --json --pretty
```

#### Cleanup Executions
```bash
# Dry run - see what would be deleted
workflow execution cleanup --days 7 --dry-run

# Delete old executions
workflow execution cleanup --days 7 --states SUCCESS FAILED

# JSON output
workflow execution cleanup --days 7 --json
```