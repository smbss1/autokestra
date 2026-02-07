# @autokestra/server

Minimal HTTP server and API layer for Autokestra.

## Config

The API is **secure-by-default**: all `/api/v1/*` routes require API key auth, and the server refuses to start if no keys are configured.

Example `config.yaml`:

```yaml
server:
  host: 0.0.0.0
  port: 7233
  apiKeys:
    - "dev-local-change-me"

storage:
  type: sqlite
  path: ./data/db.sqlite

execution:
  maxConcurrentWorkflows: 10
  maxConcurrentTasks: 50
```

## Auth

Send either of:

- `Authorization: Bearer <apiKey>`
- `X-API-Key: <apiKey>`

If both are present, `Authorization` takes precedence.

## Endpoints (v0.1)

Public:

- `GET /health`

Authenticated (`/api/v1/*`):

- `GET /api/v1/status`
- `GET /api/v1/workflows` (pagination: `limit`, `offset`)
- `GET /api/v1/workflows/:id`
- `PUT /api/v1/workflows/:id` (YAML only, id must match YAML `id`)
- `PATCH /api/v1/workflows/:id` with `{ "enabled": boolean }`
- `DELETE /api/v1/workflows/:id`
- `GET /api/v1/executions` (filters: `workflowId`, `state`; pagination: `limit`, `offset`)
- `GET /api/v1/executions/:executionId`
- `GET /api/v1/executions/:executionId/logs` (pagination + filters: `taskId`, `level`; newest-first)
- `POST /api/v1/executions/:executionId/cancel`

## Curl examples

Assuming:

- `HOST=http://localhost:7233`
- `API_KEY=dev-local-change-me`

Health (no auth):

```bash
curl -sS "$HOST/health"
```

Status:

```bash
curl -sS -H "Authorization: Bearer $API_KEY" "$HOST/api/v1/status"
```

Apply a workflow (YAML only):

```bash
cat > wf-1.yaml <<'YAML'
apiVersion: v1
id: wf-1
enabled: true
tasks:
  - id: task-1
    type: example/plugin.action
    needs: []
YAML

curl -sS \
  -X PUT \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: text/yaml" \
  --data-binary @wf-1.yaml \
  "$HOST/api/v1/workflows/wf-1"
```

Disable a workflow:

```bash
curl -sS \
  -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}' \
  "$HOST/api/v1/workflows/wf-1"
```

List executions:

```bash
curl -sS -H "Authorization: Bearer $API_KEY" \
  "$HOST/api/v1/executions?limit=50&offset=0"
```

Fetch logs (newest-first) with filters:

```bash
curl -sS -H "Authorization: Bearer $API_KEY" \
  "$HOST/api/v1/executions/exec-123/logs?limit=100&offset=0&taskId=task-1&level=ERROR"
```

Cancel an execution:

```bash
curl -sS -X POST -H "Authorization: Bearer $API_KEY" \
  "$HOST/api/v1/executions/exec-123/cancel"
```
