## 1. API Server Hardening

- [x] 1.1 Require API key config at startup (refuse to start if empty)
- [x] 1.2 Add auth middleware supporting `Authorization: Bearer` and `X-API-Key`
- [x] 1.2a Ensure `Authorization` header has priority when both are present
- [x] 1.3 Standardize JSON error helper `{ error: { code, message, details? } }`
- [x] 1.4 Ensure `/health` is unauthenticated; keep `/api/v1/*` authenticated
- [x] 1.5 Remove/avoid CORS middleware (no UI in v0.1)

## 2. Configuration

- [x] 2.1 Extend config schema to support API keys (e.g. `server.apiKeys: string[]`)
- [x] 2.2 Update `config.example.yaml` with API key configuration example

## 3. Workflow Endpoints

- [x] 3.1 Implement `GET /api/v1/workflows` (pagination + total)
- [x] 3.2 Implement `GET /api/v1/workflows/:id` (404 when missing)
- [x] 3.3 Implement `PUT /api/v1/workflows/:id` accepting YAML only
- [x] 3.4 Validate workflows via engine loader/validator; return structured diagnostics on 400
- [x] 3.4a Reject workflow apply when URL `:id` does not match YAML `id`
- [x] 3.5 Implement `DELETE /api/v1/workflows/:id` (204 on success)
- [x] 3.6 Implement `PATCH /api/v1/workflows/:id` with `{ enabled: true|false }`

## 4. Execution Endpoints

- [x] 4.1 Implement `GET /api/v1/executions` with `workflowId`, `state`, `limit`, `offset`
- [x] 4.2 Implement `GET /api/v1/executions/:executionId` using engine inspection aggregation
- [x] 4.3 Implement `GET /api/v1/executions/:executionId/logs` with pagination + filters (`taskId`, `level`)
- [x] 4.4 Implement `POST /api/v1/executions/:executionId/cancel` (transition to CANCELLED)

## 5. Engine Integration & Response Shapes

- [x] 5.1 Add server-side wiring to create/initialize engine and reuse `StateStore`
- [x] 5.2 Ensure responses never include secrets (no secret fields; mask where applicable)
- [x] 5.3 Define stable response DTOs for workflows/executions/logs

## 6. Tests

- [x] 6.1 Add auth tests (missing/invalid/valid key)
- [x] 6.2 Add endpoint smoke tests for workflows CRUD
- [x] 6.3 Add endpoint smoke tests for executions list/inspect/logs
- [x] 6.4 Add cancel execution test

## 7. Documentation

- [x] 7.1 Document API v1 endpoints and auth usage in README or server docs
- [x] 7.2 Add example `curl` commands for common operations
